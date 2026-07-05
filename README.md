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

```bash
curl -fsSL https://raw.githubusercontent.com/rahulpedapudi/nexus/main/install.sh | bash
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

```
~/.nexus/
  .env              ← your secrets and config (generated on install)
  context/
    SOUL.md         ← Nexus's personality and tone
    PERSONA.md      ← who you are (updated by Nexus as it learns)
    SKILLS.md       ← what Nexus can do
    DIRECTIVES.md   ← hard rules and constraints
  data/
    pgdata/         ← Postgres data (pgvector)
  logs/
```

The `context/` files are plain markdown. Edit them directly to customize how Nexus behaves. Nexus reads them on every request — no restart needed.

---

## Requirements

| Requirement                   | Notes                          |
| ----------------------------- | ------------------------------ |
| Docker + Compose plugin       | Auto-installed by `install.sh` |
| Node.js 20+                   | Auto-installed by `install.sh` |
| A Groq or OpenRouter API key  | For the LLM                    |
| A Google API key              | For embeddings (Gemini)        |
| Telegram or Discord bot token | Optional — for bot access      |

---

## Configuration

All config lives at `~/.nexus/.env`. The install script generates secrets automatically. Fill in your API keys after install:

```dotenv
# LLM — pick one
LLM_PROVIDER=groq
GROQ_API_KEY=your_key_here
GROQ_DEFAULT_MODEL=llama-3.3-70b-versatile

# or
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=your_key_here

# Embeddings
GOOGLE_API_KEY=your_key_here

# Bots (leave blank to disable)
TELEGRAM_TOKEN=
DISCORD_TOKEN=
```

After editing `.env`, restart with:

```bash
nexus.sh restart
```

---

## Terminal UI

Running `nexus` anywhere in your terminal opens the TUI — a full terminal interface for configuring and managing your instance without touching a browser.

```
┌─────────────────────────────────┐
│  N E X U S                      │
│                                 │
│  > Setup wizard                 │
│    Dashboard                    │
│    Integrations                 │
│    Config editor                │
│                                 │
│  ↑↓ navigate  enter select  q quit │
└─────────────────────────────────┘
```

On first run, `nexus` launches the setup wizard automatically.

---

## Management commands

```bash
nexus.sh start      # start all services
nexus.sh stop       # stop all services
nexus.sh restart    # restart the API
nexus.sh update     # pull latest + rebuild + migrate
nexus.sh logs       # tail API logs
nexus.sh logs db    # tail database logs
nexus.sh status     # show running containers
nexus.sh shell      # bash shell inside the API container
nexus.sh db         # psql shell
nexus.sh backup     # dump Postgres to ~/.nexus/data/
nexus.sh open       # open the web UI in your browser
```

---

## Integrations

Integrations are configured through the TUI (`nexus` → Integrations) or via the web UI. Available integrations:

- **Google Calendar** — read events, create reminders
- **Gmail** — read and summarize emails
- **Todoist** — manage tasks
- **Telegram** — chat with Nexus via bot
- **Discord** — chat with Nexus via bot

Each integration stores credentials in the database (encrypted), not in `.env`.

---

## Customizing Nexus

Edit the files in `~/.nexus/context/` directly:

**`SOUL.md`** — Nexus's identity. How it speaks, what it values, its tone.

**`PERSONA.md`** — Your profile. Nexus updates this as it learns about you. You can also write it manually.

**`SKILLS.md`** — Descriptions of what Nexus can do and when to use each tool.

**`DIRECTIVES.md`** — Hard rules. Things Nexus must or must never do. Takes precedence over everything else.

Changes take effect immediately — no restart needed.

---

## Updating

```bash
nexus.sh update
```

This pulls the latest code, rebuilds containers, rebuilds the TUI, and runs any new database migrations.

---

## Uninstall

```bash
# stop and remove containers
nexus.sh stop
docker compose -f ~/.nexus/repo/docker-compose.yml down --volumes

# remove everything
rm -rf ~/.nexus
sudo rm /usr/local/bin/nexus
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
