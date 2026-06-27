import json
import os
from pathlib import Path
import logging


logger = logging.getLogger(__name__)


class CredentialStore:
    def __init__(self) -> None:
        self.path = Path.home() / ".nexus"
        self.file_path = self.path / "credentials.json"

        logger.info("Loading credentials...")
        logger.info(self.file_path)

        self._load()

    def _load(self) -> None:
        try:
            with open(self.file_path, "r") as file:
                self.data = json.load(file)
        except FileNotFoundError:
            raise FileNotFoundError(
                "No credentials found. Please run the setup wizard.")
        except json.JSONDecodeError:
            raise ValueError(
                "Corrupted credentials file. Please run the setup wizard.")

    def _write(self) -> None:
        try:
            os.makedirs(self.path, exist_ok=True)
            with open(self.file_path, "w") as file:
                json.dump(self.data, file, indent=2)
        except IOError as e:
            raise Exception(f"Failed to write to credentials file: {str(e)}")

    def get(self, key: str) -> str | None:
        try:
            return self.data.get(key)
        except Exception as e:
            raise Exception(f"Failed to get credential: {str(e)}")

    def set(self, key: str, value: str) -> None:
        try:
            self.data[key] = value
        except Exception as e:
            raise Exception(f"Failed to set credential: {str(e)}")
        self._write()
