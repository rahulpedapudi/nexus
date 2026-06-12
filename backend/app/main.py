import os
from dotenv import load_dotenv
from fastapi import FastAPI, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from app.db.database import Base, engine
from telegram import Update
from app.bot.telegram_handler import NexusBot

from app.api.routes import auth, chat, conversations

load_dotenv()

app = FastAPI()
bot = NexusBot(token=os.getenv("TELEGRAM_TOKEN"))

app.add_middleware(
    CORSMiddleware,
    max_age=0,
    # Allows specific origins (use ["*"] for all)
    allow_origins=["*"],
    allow_credentials=True,  # Allows cookies and authentication headers
    # Allows all HTTP methods (GET, POST, etc.)
    allow_methods=["*"],
    allow_headers=["*"],  # Allows all headers
)

Base.metadata.create_all(bind=engine)

app.include_router(
    router=auth.router,
    prefix="/auth",
    tags=["Auth"]
)

app.include_router(
    router=chat.router,
    tags=["chat"]
)

app.include_router(
    router=conversations.router,
    prefix="/conversations",
    tags=["conversations"]  
)

@app.on_event("startup")
async def startup():
    # set webhook on startup (production)
    # e.g. https://nexus.yourdomain.com/webhook
    webhook_url = os.getenv("WEBHOOK_URL")
    if webhook_url:
        await bot.app.bot.set_webhook(url=f"{webhook_url}/webhook")
    else:
        # local dev — start polling in background
        await bot.app.initialize()
        await bot.app.start()
        await bot.app.updater.start_polling()


@app.post("/webhook")
async def telegram_webhook(request: Request):
    data = await request.json()
    update = Update.de_json(data, bot.app.bot)
    await bot.app.process_update(update)
    return {"ok": True}


@app.head("/")
def test():
    return Response(status_code=200)
