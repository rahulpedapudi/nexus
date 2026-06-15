from app.schemas.message import MessageCreate
from app.services import chat_service
from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
from fastapi import HTTPException

from app.models.user import User
from app.models.message import Message
from app.services import auth_service
from app.db.database import SessionLocal
import re
from markdown_it import MarkdownIt
from markdown_it.token import Token

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

        # elif tok.type == 'softbreak':
        #     result.append('\n')

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

        elif tok.type == 'bullet_list_open':
            pass
        elif tok.type == 'ordered_list_open':
            pass
        elif tok.type == 'list_item_open':
            result.append('• ')
        elif tok.type == 'list_item_close':
            result.append('\n')

        elif tok.type == 'paragraph_open':
            pass
        elif tok.type == 'paragraph_close':
            result.append('\n\n')

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


class NexusBot:
    def __init__(self, token: str):
        self.app = Application.builder().token(token).build()
        self._register_handlers()

    def get_db(self):
        return SessionLocal()

    def _register_handlers(self):
        self.app.add_handler(CommandHandler("start", self.handle_start))
        self.app.add_handler(CommandHandler("help", self.handle_help))
        self.app.add_handler(CommandHandler("link", self.handle_link))
        self.app.add_handler(MessageHandler(
            filters.TEXT & ~filters.COMMAND, self.handle_message))

    # TODO: need better handlers.
    async def handle_link(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        db = self.get_db()

        args = context.args
        if not args:
            await update.message.reply_text("Get your link token from the web dashboard.")
            return

        token = args[0]
        telegram_id = str(update.effective_user.id)

        try:
            auth_service.link_telegram(token, telegram_id, db=db)
            await update.message.reply_text("Linked! You're all set.")
        except HTTPException as e:
            await update.message.reply_text(f"Couldn't link: {e.detail}")
        finally:
            db.close()

    async def handle_start(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        await update.message.reply_text(
            "Hey! I'm Nexus. Send me a message to get started."
        )

    async def handle_help(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        await update.message.reply_text(
            "Hey! I'm Nexus. Send me a message to get started."
        )

    async def handle_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        user_message = update.message.text
        telegram_user_id = update.effective_user.id

        with SessionLocal() as db:
            user = db.query(User).filter(
                User.telegram_id == str(telegram_user_id)).first()

        if not user:
            await update.message.reply_text(
                "You're not linked yet. Sign up at nexus.app and connect your Telegram."
            )
            return

        response = await self.process_message(str(telegram_user_id), user_message, user)

        formatted = md_to_markdownv2(response)

        try:
            await update.message.reply_text(formatted, parse_mode=ParseMode.MARKDOWN_V2)
        except Exception as e:
            # LLM sometimes forgets to escape — fall back to plain text

            await update.message.reply_text(response)


    async def process_message(self, telegram_user_id: str, user_message: str, user:User) -> str:
        #llm pipeline 
        db = self.get_db()
        try: 
            response = chat_service.chat(
                MessageCreate(
                    content=user_message,
                    telegram_user_id=telegram_user_id,
                    source="telegram"
                ),
                db,
                current_user=user
            )
            return response.content
        except HTTPException as e:
            if e.status_code == 400 and "API key" in e.detail:
                return "API key not found. Set it up at nexus.app."
            else:
                return "Internal Server Error"
        
        finally:
            db.close()
 