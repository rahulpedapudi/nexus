from app.services import settings_service
from fastapi import APIRouter, Query

router = APIRouter(prefix="/settings")


@router.get("/gateways")
def get_gateways(
    filter: str = Query(default="all", pattern="^(all|enabled)$")
):
    """
    Returns the list of gateways.

    Args:
        filter (str): The filter to apply to the gateways

    Returns:
        list: The list of gateways
    """
    return settings_service.list_gateways(filter)


@router.get("/gateways/status")
def get_status():
    """
    Returns the status of the gateways.

    Returns:
        dict: The status of the gateways
    """
    return settings_service.get_status()


@router.post("/gateway/enable/{gateway}")
async def enable_gateway(gateway: str):
    """
    Enables a gateway.

    Args:
        gateway (str): The name of the gateway

    Returns:
        dict: The status of the gateway
    """
    return await settings_service.enable_gateway(gateway)


@router.post("/gateway/disable/{gateway}")
async def disable_gateway(gateway: str):
    """
    Disables a gateway.

    Args:
        gateway (str): The name of the gateway

    Returns:
        dict: The status of the gateway
    """
    return await settings_service.disable_gateway(gateway)
