# Nexus

A self-hosted personal AI agent. Runs on your VPS or home server. Talks to you via Telegram, Discord, or a web UI. Remembers things, manages tasks, checks your calendar, and can be extended with custom tools and skills.

You own the data. You control the model. No cloud required.

---

## What it does

- **Chat** — conversational AI via Telegram, Discord, or the web UI
- **Memory** — remembers context across conversations using pgvector semantic search
- **Tasks & reminders** — create todos and reminders, get notified via your bot
- **Calendar & Gmail** — read and act on your Google Calendar and Gmail
- **Todoist** — sync and manage tasks
- **Custom context** — shape Nexus's personality, knowledge, and behavior via local markdown files

---

## Quick install

### macOS / Linux

```bash
curl -fsSL https://raw.githubusercontent.com/rahulpedapudi/nexus/main/install.sh | bash
```

### Windows

Open an **elevated (Admin) PowerShell** prompt and run:

```powershell
irm https://raw.githubusercontent.com/rahulpedapudi/nexus/main/install.ps1 | iex
```

Requires: **Git**, **Docker** (installed automatically if missing), **Node.js 20+** (installed automatically if missing).

After install:

```
Web UI  →  http://localhost:3000
API     →  http://localhost:8421

Run `nexus` to open the terminal UI
```

---

## How it works

```text
~/.nexus/  (or %USERPROFILE%\.nexus\ on Windows)
  .env              ← your secrets and config (generated on install)
  context/
    SOUL.md         ← Nexus's personality and tone
    DIRECTIVES.md   ← hard rules and constraints
  data/
    pgdata/         ← Postgres data (pgvector)
  logs/
```

The `context/` files are plain markdown. Edit them directly to customize how Nexus behaves. Nexus reads them on every request — no restart needed.

---

## Requirements

| Requirement                   | Notes                            |
| ----------------------------- | -------------------------------- |
| Docker + Compose plugin       | Auto-installed by install script |
| Node.js 20+                   | Auto-installed by install script |
| A Groq or OpenRouter API key  | For the LLM                      |
| A Google API key              | For embeddings (Gemini)          |
| Telegram or Discord bot token | Optional — for bot access        |


---

## Integrations

Integrations are configured through the TUI (`nexus` → Integrations) or via the web UI. Available integrations:

- **Google Calendar** — read events, create reminders
- **Gmail** — read and summarize emails
- **Todoist** — manage tasks
- **Telegram** — chat with Nexus via bot
- **Discord** — chat with Nexus via bot

---

## Customizing Nexus

Edit the files in `~/.nexus/context/` (on Windows: `%USERPROFILE%\.nexus\context\`) directly:

**`SOUL.md`** — Nexus's identity. How it speaks, what it values, its tone.

**`DIRECTIVES.md`** — Hard rules. Things Nexus must or must never do. Takes precedence over everything else.

Changes take effect immediately — no restart needed.

---

## Uninstall

### macOS / Linux

```bash
# stop and remove containers
nexus.sh stop
docker compose -f ~/.nexus/repo/compose.yaml down --volumes

# remove everything
rm -rf ~/.nexus
sudo rm /usr/local/bin/nexus
```

### Windows

```powershell
# stop and remove containers
nexus stop
docker compose -f "$env:USERPROFILE\.nexus\repo\compose.yaml" down --volumes

# remove everything
Remove-Item -Recurse -Force "$env:USERPROFILE\.nexus"
```

---

## Stack

| Layer       | Tech                                  |
| ----------- | ------------------------------------- |
| Backend     | Python, FastAPI, SQLAlchemy, Alembic  |
| Database    | PostgreSQL 16 + pgvector              |
| LLM         | Groq / OpenRouter (provider-agnostic) |
| Embeddings  | Gemini Embedding                      |
| Web UI      | React, TypeScript, Vite               |
| Terminal UI | TypeScript, Ink                       |
| Bots        | Telegram, Discord                     |
| Deployment  | Docker Compose                        |

---

## License

MIT
