# app/bot/discord_bot.py
from discord import app_commands
from sqlalchemy import select
from sqlalchemy.orm import joinedload
import discord
import logging

from app.models.platform_identities import PlatformIdentity
from app.schemas.message import MessageCreate
from app.db.database import SessionLocal
from app.services import auth_service
from app.services import chat_service


logger = logging.getLogger(__name__)

class DiscordBot:
    def __init__(self, token: str):
        intents = discord.Intents.default()
        intents.message_content = True
        self.client = discord.Client(intents=intents)
        self.token = token
        self.tree = app_commands.CommandTree(self.client)
        self._register_handlers()

    def get_db(self):
        return SessionLocal()

    async def start(self):
        await self.client.start(self.token)

    async def stop(self):
        await self.client.close()

    def _register_handlers(self):
        @self.client.event
        async def on_ready():
            print(f"Discord bot logged in as {self.client.user}")
            await self.tree.sync()

        @self.tree.command(name="start", description="Get started with Nexus")
        async def start(interaction: discord.Interaction):
            await interaction.response.send_message("Welcome! Use /link <token> to connect.")

        @self.tree.command(name="link", description="Link your Nexus account")
        async def link(interaction: discord.Interaction, token: str):
            with self.get_db() as db:
                auth_service.link_platform(token, "discord", str(interaction.user.id), db)
            await interaction.response.send_message("✅ Linked!")

        @self.client.event
        async def on_message(message):
            if message.author == self.client.user:
                return

            platform_user_id = str(message.author.id)  # convert to str for consistency
            text = message.content
        
            # only respond to DMs, or mentions in servers
            is_dm = isinstance(message.channel, discord.DMChannel)
            is_mentioned = self.client.user in message.mentions

            if not (is_dm or is_mentioned):
                return

            async with message.channel.typing():
                reply = await self.handle_message(platform_user_id, message)
                await message.channel.send(reply)

    async def handle_message(self, platform_user_id: str, message: discord.Message) -> str:
        logger.info(platform_user_id)

        with self.get_db() as db:
            identity = (
                db.execute(
                    select(PlatformIdentity)
                    .where(PlatformIdentity.platform == "discord")
                    .where(PlatformIdentity.platform_id == platform_user_id)
                    .options(joinedload(PlatformIdentity.user))
                )
                .scalar_one_or_none()
            )           
        if not identity:
            return "You are not linked. Please link your account using /link"
        
        with self.get_db() as db:
            llm_response = await chat_service.chat(
                data=MessageCreate(
                    content=message.content,
                    source="discord",
                    discord_user_id=platform_user_id,
                ),
                db=db,
                current_user=identity.user,
            )
        
        return llm_response
    