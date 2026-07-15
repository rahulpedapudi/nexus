"""
Morning Digest
==============
Background task that fires at 07:00 (server local time) every day and
pushes a personalised digest to every user who has a linked Telegram
identity.

Digest sections (each skipped gracefully if the integration is not
configured or errors out):
  📅  Today's Google Calendar events
  ✅  Todoist tasks due today / overdue
  📧  Unread Gmail threads
"""

import asyncio
import logging
from datetime import datetime

from sqlalchemy.orm import Session, joinedload

from app.db.database import SessionLocal
from app.models.platform_identities import PlatformIdentity

logger = logging.getLogger(__name__)

# ── Target hour (server local time) ──────────────────────────────────────────
DIGEST_HOUR = 22   # 7:00 AM


# ── Formatting helpers ────────────────────────────────────────────────────────

def _fmt_time(iso: str) -> str:
    """Return HH:MM from an ISO-8601 datetime string, or the raw string."""
    try:
        return datetime.fromisoformat(iso).strftime("%H:%M")
    except Exception:
        return iso


def _format_digest(events: list, tasks: list, emails: list) -> str:
    """
    Build a Telegram-safe (plain text) digest message from the three data
    sources.  Uses Unicode symbols for visual structure without relying on
    MarkdownV2 parsing.
    """
    today = datetime.now().strftime("%A, %d %B %Y")
    lines = [f"🌅 Good morning! Here's your digest for {today}.\n"]

    # ── Calendar ──────────────────────────────────────────────────────────────
    lines.append("━━━━━━━━━━━━━━━━━━━━━━")
    lines.append("📅  Today's Schedule")
    lines.append("━━━━━━━━━━━━━━━━━━━━━━")
    if events is None:
        lines.append("  ⚠️  Calendar not connected.")
    elif not events:
        lines.append("  ✨  No events today — enjoy the free time!")
    else:
        for ev in events:
            start = _fmt_time(ev.get("start", ""))
            end = _fmt_time(ev.get("end",   ""))
            title = ev.get("summary", "(No title)")
            lines.append(f"  • {start}-{end}  {title}")

    lines.append("")

    # ── Todoist ───────────────────────────────────────────────────────────────
    lines.append("━━━━━━━━━━━━━━━━━━━━━━")
    lines.append("✅  Tasks")
    lines.append("━━━━━━━━━━━━━━━━━━━━━━")
    if tasks is None:
        lines.append("  ⚠️  Todoist not connected.")
    elif not tasks:
        lines.append("  🎉  No pending tasks — you're all caught up!")
    else:
        # Priority labels: p1 = 🔴, p2 = 🟠, p3 = 🟡, p4 = ⚪
        _PRIORITY = {4: "🔴", 3: "🟠", 2: "🟡", 1: "⚪"}
        for task in tasks:
            prio = _PRIORITY.get(task.get("priority", 1), "⚪")
            title = task.get("content", "(No title)")
            due = task.get("due_date", "")
            due_label = f"  [{due}]" if due else ""
            lines.append(f"  {prio} {title}{due_label}")

    lines.append("")

    # ── Gmail ─────────────────────────────────────────────────────────────────
    lines.append("━━━━━━━━━━━━━━━━━━━━━━")
    lines.append("📧  Unread Emails")
    lines.append("━━━━━━━━━━━━━━━━━━━━━━")
    if emails is None:
        lines.append("  ⚠️  Gmail not connected.")
    elif not emails:
        lines.append("  📭  Inbox zero — nothing unread!")
    else:
        for email in emails[:10]:   # cap at 10 for readability
            sender = email.get("from", "Unknown")
            subject = email.get("subject", "(No subject)")
            # Trim long sender strings to just the name portion
            if "<" in sender:
                sender = sender.split("<")[0].strip().strip('"')
            lines.append(f"  • {subject}")
            lines.append(f"    ↳ from {sender}")

    lines.append("")
    lines.append("Have a great day! 🚀")
    return "\n".join(lines)


# ── Per-user digest ───────────────────────────────────────────────────────────

async def _fetch_calendar(db: Session, user) -> list | None:
    """Return today's calendar events, or None on error / not connected."""
    try:
        from app.agent.tools.integrations.google.calendar import get_calendar_service
        from app.services.google.google_calendar_service import fetch_today_events
        service = get_calendar_service(db, user.id)
        return await asyncio.to_thread(fetch_today_events, service)
    except Exception as exc:
        logger.warning(
            "Digest: calendar fetch failed for user %s: %s", user.id, exc)
        return None


async def _fetch_tasks(db: Session, user) -> list | None:
    """Return today's + overdue Todoist tasks, or None on error / not connected."""
    try:
        from app.services.todoist.todoist_service import fetch_tasks
        return await asyncio.to_thread(fetch_tasks, db, user, "today | overdue")
    except Exception as exc:
        logger.warning(
            "Digest: todoist fetch failed for user %s: %s", user.id, exc)
        return None


async def _fetch_emails(db: Session, user) -> list | None:
    """Return unread Gmail threads from last 24 h, or None on error / not connected."""
    try:
        from app.agent.tools.integrations.google.gmail import get_gmail_service
        from app.services.google.gmail_service import list_email_metadata
        service = get_gmail_service(db, user.id)
        return await asyncio.to_thread(
            list_email_metadata, service, "is:unread", 15
        )
    except Exception as exc:
        logger.warning(
            "Digest: gmail fetch failed for user %s: %s", user.id, exc)
        return None


async def send_digest(bot, db: Session, user, telegram_chat_id: str) -> None:
    """Fetch all three sources concurrently and push the digest message."""
    events, tasks, emails = await asyncio.gather(
        _fetch_calendar(db, user),
        _fetch_tasks(db, user),
        _fetch_emails(db, user),
    )

    text = _format_digest(events, tasks, emails)

    try:
        await bot.send_message(telegram_chat_id, text)
        logger.info("Digest sent to Telegram user %s", telegram_chat_id)
    except Exception as exc:
        logger.error("Digest: failed to send to %s: %s", telegram_chat_id, exc)


# ── Background loop ───────────────────────────────────────────────────────────

async def digest_loop() -> None:
    """
    Runs forever.  At DIGEST_HOUR (server local time) it queries every
    PlatformIdentity row with platform == "telegram" and sends each linked
    user their morning digest.

    The Telegram bot singleton is resolved lazily on each digest run, so
    this loop is safe to start before (or even without) a Telegram gateway.
    """
    from app.bot.telegram_handler import get_bot_instance   # lazy import avoids circular deps

    logger.info("Digest loop started (fires daily at %02d:00).", DIGEST_HOUR)
    fired_today: str | None = None   # tracks the date string we last fired on

    while True:
        now = datetime.now()
        today_str = now.strftime("%Y-%m-%d")

        if now.hour == DIGEST_HOUR and fired_today != today_str:
            fired_today = today_str
            bot = get_bot_instance()

            if bot is None:
                logger.info(
                    "Digest: Telegram bot not running, skipping today's digest.")
                await asyncio.sleep(90)
                continue

            logger.info("Digest: firing for date %s", today_str)

            with SessionLocal() as db:
                identities = (
                    db.query(PlatformIdentity)
                    .filter(PlatformIdentity.platform == "telegram")
                    .options(joinedload(PlatformIdentity.user))
                    .all()
                )

            for identity in identities:
                if identity.user is None:
                    continue
                # Open a fresh session per user to avoid cross-session issues
                with SessionLocal() as user_db:
                    try:
                        await send_digest(
                            bot,
                            user_db,
                            identity.user,
                            identity.platform_id,
                        )
                    except Exception as exc:
                        logger.error(
                            "Digest: unhandled error for user %s: %s",
                            identity.user.id, exc,
                        )

            # Sleep past the current minute so we don't fire again this hour
            await asyncio.sleep(90)
        else:
            # Poll every 30 seconds — lightweight, no external calls
            await asyncio.sleep(30)
