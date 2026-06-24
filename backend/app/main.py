from contextlib import asynccontextmanager
import asyncio
import os
from dotenv import load_dotenv
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from app.db.database import Base, engine
from app.bot.telegram_handler import NexusBot
from app.bot.discord_handler import DiscordBot
from app.core.logging import setup_logging
from app.api.routes import auth, chat, conversations, keys, memory, task, integrations
from app.worker.reminder import reminder_loop

# Register tools
from app.agent.tools import tasks, memories
from app.agent.tools.integrations.google import calendar

tasks.register()
memories.register()
calendar.register()

load_dotenv()
setup_logging()


bot = NexusBot(token=os.getenv("TELEGRAM_TOKEN"))
discord_bot = DiscordBot(token=os.getenv("DISCORD_TOKEN"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    discord_task = asyncio.create_task(discord_bot.start())
    reminder_task = asyncio.create_task(
        reminder_loop(discord_client=discord_bot.client)
    )
    webhook_url = os.getenv("WEBHOOK_URL")
    if webhook_url:
        await bot.app.bot.set_webhook(url=f"{webhook_url}/webhook")
    else:
        # local dev — start polling in background
        await bot.app.initialize()
        await bot.app.start()
        await bot.app.updater.start_polling()
    yield
    reminder_task.cancel()
    await discord_bot.stop()
    discord_task.cancel()
    await bot.app.updater.stop()
    await bot.app.stop()


app = FastAPI(lifespan=lifespan)

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

app.include_router(
    router=keys.router,
    prefix="/keys",
    tags=["keys"]
)

app.include_router(
    router=memory.router,
    prefix="/memory",
    tags=["memory"]
)

app.include_router(
    router=task.router,
    prefix="/task",
    tags=["task"]
)

app.include_router(
    router=integrations.router,
    tags=["integrations"]
)

# @app.post("/webhook")
# async def telegram_webhook(request: Request):
#     data = await request.json()
#     update = Update.de_json(data, bot.app.bot)
#     await bot.app.process_update(update)
#     return {"ok": True}


@app.head("/")
def test():
    return Response(status_code=200)


@app.get("/health")
def health():
    return {"status": "ok"}
