import os
import sys
from pathlib import Path


def get_nexus_home() -> Path:
    """
    Returns the Nexus data directory, in priority order:

      1. ``$NEXUS_HOME`` env var — set by the install.sh launcher script,
         or by the user for a custom location.
      2. Platform default:
         - Windows  → %APPDATA%\\nexus  (e.g. C:\\Users\\You\\AppData\\Roaming\\nexus)
         - macOS    → ~/.nexus  (same as Linux; matches install.sh behaviour)
         - Linux    → ~/.nexus

    All callers should use this function rather than constructing paths directly
    so that cross-platform support is handled in one place.
    """
    env = os.environ.get("NEXUS_HOME")
    if env:
        return Path(env)

    if sys.platform == "win32":
        appdata = os.environ.get("APPDATA") or str(Path.home() / "AppData" / "Roaming")
        return Path(appdata) / "nexus"

    # macOS and Linux both use ~/.nexus to keep parity with install.sh
    return Path.home() / ".nexus"
