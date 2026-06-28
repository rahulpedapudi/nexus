from fastapi import HTTPException

from app.core.credentials import creds_store
from app.bot.gateway_manager import gateway_manager


def list_gateways(filter: str) -> dict[str, list[str]]:
    """
    Returns the list of gateways based on the filter.

    Args:
        filter (str): The filter to apply to the gateways

    Returns:
        dict[str, list[str]]: The list of gateways
    """
    creds = creds_store.load_credentials()

    if filter == "all":
        # this is a static list of all available gateways
        # TODO: need to make this dynamic, by fetching available gateways from the gateway manager
        return {"gateways": ["telegram", "discord"]}
    if filter == "enabled":
        # the list of gateways that are enabled fetched from the credentials.json file
        return {"gateways": creds.get("ENABLED_GATEWAYS")}


def get_status():
    """
    Returns running gateways.
    """
    return gateway_manager.status()


async def enable_gateway(gateway: str):
    """
    Enables a gateway.

    Args:
        gateway (str): The name of the gateway to enable
    """
    # get the token for the gateway from the credentials.json file, raise exception if token is not found.
    token = creds_store.get_gateway_token(gateway.lower())
    if not token:
        raise HTTPException(status_code=404, detail="Gateway token not found")
    try:
        # delegating the task to the gateway manager to enable the gateway.
        await gateway_manager.enable(gateway, token)

        # update the credentials.json file to mark the gateway as enabled
        gateways = creds_store.get("ENABLED_GATEWAYS")

        # creating ENABLED_GATEWAYS key if it doesn't exist
        if not gateways:
            creds_store.set("ENABLED_GATEWAYS", [gateway])

        # adding the gateway to the list if it's not already there
        elif gateway not in gateways:
            gateways.append(gateway)
            creds_store.set("ENABLED_GATEWAYS", gateways)

        return {"status": f"{gateway} running"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def disable_gateway(gateway: str):
    """
    Disables a gateway.

    Args:
        gateway (str): The name of the gateway to disable
    """
    try:
        # delegating the task to the gateway manager to disable the gateway.
        await gateway_manager.disable(gateway.lower())

        # update the credentials.json file to mark the gateway as disabled
        gateways = creds_store.get("ENABLED_GATEWAYS")
        if gateway in gateways:
            gateways.remove(gateway)
            creds_store.set("ENABLED_GATEWAYS", gateways)

        return {"status": f"{gateway} stopped"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def set_llm(provider: str):
    try:
        creds_store.set("LLM_PROVIDER", provider)
        return {"status": f"{provider} set as LLM provider"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def get_llm():
    return {"llm": creds_store.get("LLM_PROVIDER")}
