import asyncio
import logging
from typing import Callable


logger = logging.getLogger(__name__)


class GatewayManager:
    def __init__(self):
        # stores running background tasks, format: {gateway_name: background_task}
        self._tasks: dict[str, asyncio.Task] = {}
        # stores starter functions, format: {gateway_name: starter_function(token)}
        self._starters: dict[str, Callable] = {}
        # stores disabler functions, format: {gateway_name: disabler_function}
        self._disablers: dict[str, Callable] = {}

    def register(self, name: str, starter: Callable, disabler: Callable):
        """
        Registers a new gateway. should register in main.py

        Args:
            name (str): The name of the gateway (e.g., "telegram", "discord").
            starter (Callable): The function to start the gateway. It should accept a token string.
            disabler (Callable): The function to stop the gateway. It takes no arguments and should return a coroutine.
        """
        self._starters[name] = starter
        self._disablers[name] = disabler
        logger.info(f"Gateway {name} registered")

    # Starts a gateway
    async def enable(self, name: str, token: str):
        """
        Enables a gateway.

        Args:
            name (str): The name of the gateway.
            token (str): The token for the gateway.
        """

        # checking if the background task is already running
        if name in self._tasks and not self._tasks[name].done():
            logger.info(f"Gateway {name} already running")
            return False

        # checking if the gateway has a starter function
        if name not in self._starters:
            raise ValueError(f"Gateway {name} not registered")

        logger.info(f"Enabling gateway: {name}")

        # creating a background task for the gateway
        task = asyncio.create_task(self._starters[name](
            token=token), name=f"gateway.{name}")

        # adding task to the _tasks dict
        self._tasks[name] = task

    async def disable(self, name: str):
        """
        Disables a gateway.

        Args:
            name (str): The name of the gateway.
        """

        # getting the background task for the gateway
        task = self._tasks.get(name)

        # checking if the background task is running
        if task and not task.done():
            logger.info(f"Stopping gateway: {name}")

            # cancelling the background task
            task.cancel()
            try:
                await asyncio.wait_for(asyncio.shield(task), timeout=5)
            except (asyncio.CancelledError, asyncio.TimeoutError):
                pass

        # removing the task from the _tasks dict
        self._tasks.pop(name, None)

        # calling the gateway specific disable function for cleanup
        await self._disablers[name]()
        logger.info(f"Gateway {name} disabled")

    def status(self) -> dict[str, str]:
        """
        Returns the gateways which are currently running.

        Returns:
            dict[str, str]: A dictionary containing the status of running gateways.
        """
        return {
            name: "running" if task else "stopped"
            for name, task in self._tasks.items()
        }

    # to stop all gateways - used when server is shutting down
    async def shutdown(self):
        """Stop all gateways — call from lifespan cleanup."""
        for name in list(self._tasks.keys()):
            await self.disable(name)


# instance of gateway manager, singleton pattern
gateway_manager = GatewayManager()
