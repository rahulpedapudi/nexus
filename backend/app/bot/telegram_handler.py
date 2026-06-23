from telegram.request import HTTPXRequest
import re
import time

from app.schemas.message import MessageCreate
from app.services import chat_service
from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
from fastapi import HTTPException

from app.models.user import User
from app.services import auth_service
from app.db.database import SessionLocal
from markdown_it import MarkdownIt
from markdown_it.token import Token
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.models.platform_identities import PlatformIdentity

# ── Markdown → MarkdownV2 converter ──────────────────────────────────────────

md = MarkdownIt()

ESCAPE_CHARS = r'_*[]()~`>#+-=|{}.!\\'


def escape_v2(text: str) -> str:
    return re.sub(r'([' + re.escape(ESCAPE_CHARS) + r'])', r'\\\1', text)


def tokens_to_mdv2(tokens: list[Token]) -> str:
    result = []
    i = 0
    while i < len(tokens):
        tok = tokens[i]

        if tok.type == 'inline' and tok.children:
            result.append(tokens_to_mdv2(tok.children))

        elif tok.type == 'text':
            result.append(escape_v2(tok.content))

        elif tok.type == 'hardbreak':
            result.append('\n\n')

        elif tok.type == 'strong_open':
            result.append('*')
        elif tok.type == 'strong_close':
            result.append('*')

        elif tok.type == 'em_open':
            result.append('_')
        elif tok.type == 'em_close':
            result.append('_')

        elif tok.type == 'code_inline':
            result.append(f'`{tok.content}`')

        elif tok.type == 'fence':
            lang = tok.info.strip()
            result.append(f'```{lang}\n{tok.content}```\n')

        elif tok.type in ('bullet_list_open', 'ordered_list_open', 'paragraph_open'):
            pass
        elif tok.type == 'list_item_open':
            result.append('• ')
        elif tok.type == 'list_item_close':
            result.append('\n')
        elif tok.type == 'paragraph_close':
            result.append('\n')

        elif tok.type == 'blockquote_open':
            result.append('>')
        elif tok.type == 'blockquote_close':
            result.append('\n')

        elif tok.type == 'hr':
            result.append(escape_v2('---') + '\n')

        i += 1

    return ''.join(result)


def md_to_markdownv2(text: str) -> str:
    tokens = md.parse(text)
    return tokens_to_mdv2(tokens).strip()


# ── Streaming constants ──────────────────────────────────────────────────────
# Telegram limits bots to ~20 edits/min. Draft updates are cheaper but we
# still throttle to avoid network noise and stay well within limits.

DRAFT_INTERVAL_SECS = 0.5   # minimum seconds between draft updates
MIN_NEW_CHARS = 8           # skip update if fewer new chars than this


# ── Bot class ─────────────────────────────────────────────────────────────────

class NexusBot:
    def __init__(self, token: str):
        request = HTTPXRequest(
            read_timeout=30, write_timeout=30, connect_timeout=10)
        updater_request = HTTPXRequest(
            read_timeout=30, write_timeout=30, connect_timeout=10)

        self.app = (
            Application.builder()
            .token(token)
            .request(request)
            .get_updates_request(updater_request)
            .build()
        )
        self._register_handlers()

    def get_db(self):
        return SessionLocal()

    def _register_handlers(self):
        self.app.add_handler(CommandHandler("start", self.handle_start))
        self.app.add_handler(CommandHandler("help", self.handle_help))
        self.app.add_handler(CommandHandler("link", self.handle_link))
        self.app.add_handler(MessageHandler(
            filters.TEXT & ~filters.COMMAND, self.handle_message))

    # ── /link command ─────────────────────────────────────────────────────────

    async def handle_link(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        db = self.get_db()
        args = context.args
        if not args:
            await update.message.reply_text("Get your link token from the web dashboard.")
            return

        token = args[0]
        telegram_id = str(update.effective_user.id)

        try:
            # auth_service.link_telegram(token, telegram_id, db=db)
            auth_service.link_platform(token, "telegram", telegram_id, db=db)
            await update.message.reply_text("Linked! You're all set.")
        except HTTPException as e:
            await update.message.reply_text(f"Couldn't link: {e.detail}")
        finally:
            db.close()

    # ── /start and /help ──────────────────────────────────────────────────────

    async def handle_start(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        await update.message.reply_text(
            "Hey! I'm Nexus. Send me a message to get started."
        )

    async def handle_help(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        await update.message.reply_text(
            "Hey! I'm Nexus. Send me a message to get started."
        )

    # ── Main message handler ──────────────────────────────────────────────────

    async def handle_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        user_message = update.message.text
        platform_user_id = str(update.effective_user.id)

        with SessionLocal() as db:
            identity = (
                db.execute(
                    select(PlatformIdentity)
                    .where(PlatformIdentity.platform == "telegram")
                    .where(PlatformIdentity.platform_id == platform_user_id)
                    .options(joinedload(PlatformIdentity.user))
                )
                .scalar_one_or_none()
            )

        if not identity:
            await update.message.reply_text(
                "You're not linked yet. Sign up at nexus.app and connect your Telegram."
            )
            return

        await self._stream_reply(update, user_message, platform_user_id, identity.user)

    # ── Streaming reply ───────────────────────────────────────────────────────

    async def _stream_reply(
        self,
        update: Update,
        user_message: str,
        telegram_user_id: str,
        user: User,
    ) -> None:
        """
        Stream the LLM response using Telegram's sendMessageDraft API:

          1. A unique draft_id is created for this response.
          2. As tokens arrive, bot.send_message_draft() is called (throttled)
             to show the user a live ephemeral preview of the accumulating text.
          3. When the LLM finishes, bot.send_message() is called with the
             fully-formatted response — this persists the message and
             automatically dismisses the draft preview.

        Intermediate draft updates use plain text to avoid MarkdownV2 parse
        errors on incomplete token sequences. The final sendMessage uses
        full Markdown formatting.
        """
        chat_id = update.effective_chat.id
        bot = context = self.app.bot

        # Show typing indicator immediately
        await bot.send_chat_action(chat_id=chat_id, action="typing")

        # Unique draft_id for this streaming response
        draft_id = int(time.time() * 1000) & 0x7FFFFFFF

        db = self.get_db()
        accumulated = ""
        last_draft_time = 0.0
        last_draft_len = 0

        try:
            async for event in chat_service.stream_events(
                MessageCreate(
                    content=user_message,
                    telegram_user_id=telegram_user_id,
                    source="telegram",
                ),
                db,
                current_user=user,
            ):
                event_type = event["type"]

                if event_type == "delta":
                    accumulated += event["text"]
                    now = time.monotonic()
                    new_chars = len(accumulated) - last_draft_len
                    elapsed = now - last_draft_time

                    # Throttle draft updates
                    if elapsed >= DRAFT_INTERVAL_SECS and new_chars >= MIN_NEW_CHARS:
                        await bot.send_message_draft(
                            chat_id=chat_id,
                            draft_id=draft_id,
                            text=accumulated + "▍",
                        )
                        last_draft_time = now
                        last_draft_len = len(accumulated)

                elif event_type == "done":
                    full_text = event.get("full_text", accumulated)
                    formatted = md_to_markdownv2(full_text)
                    try:
                        # sendMessage persists the message and dismisses the draft
                        await bot.send_message(
                            chat_id=chat_id,
                            text=formatted,
                            parse_mode=ParseMode.MARKDOWN_V2,
                        )
                    except Exception:
                        # Fall back to plain text if markdown parsing fails
                        await bot.send_message(
                            chat_id=chat_id,
                            text=full_text,
                        )

                elif event_type == "error":
                    detail = event.get("detail", "Something went wrong.")
                    if "API key" in detail:
                        await bot.send_message(
                            chat_id=chat_id,
                            text="API key not found. Set it up at nexus.app.",
                        )
                    else:
                        await bot.send_message(
                            chat_id=chat_id,
                            text=f"Error: {detail}",
                        )
                    return

        except Exception:
            await bot.send_message(
                chat_id=chat_id,
                text="An unexpected error occurred.",
            )
        finally:
            db.close()
