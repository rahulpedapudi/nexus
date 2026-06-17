"""
app/worker/reminder.py

Asyncio-based reminder loop — no Redis, no Celery.
Runs as a background task inside the FastAPI lifespan.

Every POLL_INTERVAL seconds it:
  1. Queries tasks where remind_at <= now() AND reminded = false AND done = false
  2. For each due task, sends a notification via every linked channel (Telegram, Discord)
  3. Marks the task as reminded = true
  4. If the task is recurring, bumps remind_at to the next occurrence
"""

import asyncio
import logging
import os
from datetime import datetime, UTC, timedelta

import httpx
from sqlalchemy.orm import Session, joinedload

from app.db.database import SessionLocal
from app.models.tasks import Task
from app.models.user import User
from app.models.platform_identities import PlatformIdentity

logger = logging.getLogger(__name__)

# How often to poll the DB for due reminders (seconds)
POLL_INTERVAL = 60

TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
TELEGRAM_API = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}"


# ── Notification dispatchers ──────────────────────────────────────────────────

async def _send_telegram(telegram_id: str, snapshot: dict) -> None:
    """Send a reminder message to the user's Telegram chat."""
    lines = [f"⏰ *Reminder*: {snapshot['title']}"]
    if snapshot.get("note"):
        lines.append(f"_{snapshot['note']}_")
    if snapshot.get("due_date"):
        lines.append(f"📅 Due: {snapshot['due_date'].strftime('%d %b %Y %I:%M %p')}")
    text = "\n".join(lines)

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{TELEGRAM_API}/sendMessage",
                json={
                    "chat_id": telegram_id,
                    "text": text,
                    "parse_mode": "Markdown",
                },
            )
            resp.raise_for_status()
            logger.info(f"Telegram reminder sent to {telegram_id} for task '{snapshot['title']}'")
    except Exception as exc:
        logger.error(f"Failed to send Telegram reminder to {telegram_id}: {exc}")


async def _send_discord(discord_user_id: str, snapshot: dict, discord_client) -> None:
    """Send a reminder DM to the user's Discord account."""
    lines = [f"⏰ **Reminder**: {snapshot['title']}"]
    if snapshot.get("note"):
        lines.append(f"*{snapshot['note']}*")
    if snapshot.get("due_date"):
        lines.append(f"📅 Due: {snapshot['due_date'].strftime('%d %b %Y %I:%M %p')}")
    text = "\n".join(lines)

    try:
        user = await discord_client.fetch_user(int(discord_user_id))
        dm = await user.create_dm()
        await dm.send(text)
        logger.info(f"Discord reminder sent to {discord_user_id} for task '{snapshot['title']}'")
    except Exception as exc:
        logger.error(f"Failed to send Discord reminder to {discord_user_id}: {exc}")


# ── Recurrence logic ──────────────────────────────────────────────────────────

def _next_remind_at(task: Task) -> datetime | None:
    """Calculate the next remind_at for a recurring task. Returns None if not recurring."""
    if not task.recurring or not task.remind_at:
        return None

    base = task.remind_at
    if task.recurring == "daily":
        return base + timedelta(days=1)
    if task.recurring == "weekly":
        return base + timedelta(weeks=1)
    if task.recurring == "monthly":
        # Naive month bump — same day next month
        month = base.month + 1
        year = base.year + (month - 1) // 12
        month = (month - 1) % 12 + 1
        try:
            return base.replace(year=year, month=month)
        except ValueError:
            # e.g. Jan 31 → Feb 28
            import calendar
            last_day = calendar.monthrange(year, month)[1]
            return base.replace(year=year, month=month, day=last_day)

    return None


# ── Core poll function ────────────────────────────────────────────────────────

async def _process_due_tasks(discord_client=None) -> None:
    """
    Query and process all tasks that are now due.
    Runs inside its own DB session that is closed before any async I/O.
    """
    now = datetime.now(UTC)

    # Plain-Python snapshot extracted while session is open — no ORM objects escape.
    # Each entry: {"task_title", "task_note", "task_due_date", "channels": [{"platform", "platform_id"}]}
    due_snapshots: list[dict] = []

    with SessionLocal() as db:
        tasks = (
            db.query(Task)
            .filter(
                Task.remind_at <= now,
                Task.reminded == False,  # noqa: E712
                Task.done == False,      # noqa: E712
            )
            .options(
                joinedload(Task.user).joinedload(User.identities)
            )
            .all()
        )

        for task in tasks:
            # Extract everything we need as plain Python values while session is open
            channels = [
                {"platform": identity.platform, "platform_id": identity.platform_id}
                for identity in task.user.identities
            ]
            due_snapshots.append({
                "title": task.title,
                "note": task.note,
                "due_date": task.due_date,
                "channels": channels,
            })

        # Mark as reminded + handle recurrence while session is still open
        for task in tasks:
            next_at = _next_remind_at(task)
            if next_at:
                task.remind_at = next_at
                task.reminded = False   # reset so it fires again next cycle
            else:
                task.reminded = True

        db.commit()

    # 2. Dispatch notifications (async I/O, outside DB session)
    # Everything here is plain Python — no SQLAlchemy objects, no lazy loading.
    for snapshot in due_snapshots:
        for channel in snapshot["channels"]:
            platform = channel["platform"]
            platform_id = channel["platform_id"]

            if platform == "telegram" and TELEGRAM_TOKEN:
                await _send_telegram(platform_id, snapshot)

            elif platform == "discord" and discord_client:
                await _send_discord(platform_id, snapshot, discord_client)


# ── Background loop ───────────────────────────────────────────────────────────

async def reminder_loop(discord_client=None) -> None:
    """
    Infinite loop that polls for due tasks every POLL_INTERVAL seconds.
    Pass the discord.Client instance so DMs can be sent.
    Designed to be started with asyncio.create_task() inside FastAPI lifespan.
    """
    logger.info(f"Reminder loop started — polling every {POLL_INTERVAL}s")
    while True:
        try:
            await _process_due_tasks(discord_client=discord_client)
        except Exception as exc:
            # Never let the loop die — log and continue
            logger.error(f"Reminder loop error: {exc}", exc_info=True)
        await asyncio.sleep(POLL_INTERVAL)
