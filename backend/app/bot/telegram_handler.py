from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
from fastapi import HTTPException

from app.models.user import User
from app.services import auth_service
from app.db.database import SessionLocal


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

        # pass to your agent core
        response = await self.process_message(telegram_user_id, user_message)
        await update.message.reply_text(response)

    async def process_message(self, user_id: int, message: str) -> str:
        # this is where your FastAPI agent logic gets called
        # call your LLM pipeline, tool router, memory, etc.
        return "I got your message!"
