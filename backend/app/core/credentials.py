import json
import logging
from pathlib import Path

from app.core.paths import get_nexus_home

logger = logging.getLogger(__name__)


class CredentialStore:
    """
    A class to manage credentials for the application.
    """

    def __init__(self) -> None:
        # Path to the credentials file — resolved via get_nexus_home() so that
        # $NEXUS_HOME is honoured and Windows / macOS paths work correctly.
        self.path = get_nexus_home()
        self.file_path = self.path / "credentials.json"

    def load_credentials(self) -> dict:
        """ 
        Loads the credentials from the file; (.nexus/credentials.json)
        Returns an empty dict if file doesn't exist
        """
        if not self.file_path.exists():
            # not creating the directory here, because it will be created during the setup phase.
            return {}
        return json.loads(self.file_path.read_text())

    # TODO: implement merge logic
    def save_credentials(self, data: dict) -> None:
        """
        Saves the credentials to the file; (.nexus/credentials.json)
        OVERWRITES THE FILE!!! ALWAYS PASS THE FULL DICTIONARY IN ARGUMENT!!!

        Args:
            data (dict): The credentials to save
        """
        try:
            self.file_path.write_text(json.dumps(data, indent=2))
        except Exception as e:
            raise Exception(f"Failed to save credentials: {str(e)}")

    def get(self, key: str) -> str | list[str] | None:
        """
        Returns the value of a key from the credentials file.

        Args:
            key (str): The key to get

        Returns:
            str | list[str] | None: The value of the key, None if key doesn't exist
        """
        creds = self.load_credentials()
        return creds.get(key, None)

    def set(self, key: str, value: str) -> None:
        """
        Sets the value of a key in the credentials file.

        Args:
            key (str): The key to set
            value (str): The value to set
        """
        try:
            creds = self.load_credentials()
            creds[key] = value
            self.save_credentials(creds)
        except Exception as e:
            raise Exception(f"Failed to set credential: {str(e)}")

    # Format:
    # "gateway_name": {
    #     "token": "token"
    # }
    def get_gateway_token(self, gateway: str) -> str | None:
        """
        Returns the token of a gateway.

        Args:
            gateway (str): The name of the gateway

        Returns:
            str | None: The token of the gateway, None if key doesn't exist
        """
        creds = self.load_credentials()
        return creds.get(gateway, {}).get("token", None)

    def is_gateway_enabled(self, gateway: str) -> bool:
        """
        Returns True if the gateway is enabled.

        Args:
            gateway (str): The name of the gateway

        Returns:
            bool: True if the gateway is enabled, False otherwise
        """
        creds = self.load_credentials()
        return (gateway in creds.get("enabled_gateways", []))


# singleton instance
creds_store = CredentialStore()
