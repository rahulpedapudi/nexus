from contextlib import asynccontextmanager
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import create_extensions
from app.bot.gateway_manager import gateway_manager
from app.core.credentials import creds_store
from app.bot.telegram_handler import start_telegram, stop_telegram
from app.bot.discord_handler import start_discord, stop_discord
from app.core.logging import setup_logging
from app.api.routes import auth, chat, conversations, keys, memory, task, integrations, settings


# Register tools
from app.agent.tools import tasks, memories
from app.agent.tools.integrations.google import calendar

tasks.register()
memories.register()
calendar.register()

setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_extensions()

    # registering the available gateways to the gateway manager
    gateway_manager.register(
        "telegram", start_telegram, stop_telegram)
    gateway_manager.register(
        "discord", start_discord, stop_discord)

    # get the list of gateways that are enabled to run at startup automatically; gets the list from the credentials.json file
    enabled_gateways = creds_store.get("ENABLED_GATEWAYS")

    # start all the gateways that are enabled and has token, raise exception if token not found for any enabled gateway
    if enabled_gateways:
        for gateway in enabled_gateways:
            token = creds_store.get_gateway_token(gateway)
            if token:
                await gateway_manager.enable(gateway, token)
            else:
                raise Exception(f"Token not found for gateway: {gateway}")
        yield
        # cleanup on shutdown
        await gateway_manager.shutdown()
    else:
        # No gateways enabled
        yield


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

app.include_router(
    router=settings.router,
    tags=["settings"]
)


@app.head("/")
def test():
    return Response(status_code=200)


@app.get("/health")
def health():
    return {"status": "ok"}
