#!/usr/bin/env bash
set -euo pipefail

NEXUS_HOME="${NEXUS_HOME:-$HOME/.nexus}"
REPO_URL="https://github.com/rahulpedapudi/nexus"
INSTALL_DIR="${NEXUS_HOME}/repo"
BIN_PATH="/usr/local/bin/nexus"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${GREEN}[nexus]${NC} $1"; }
warn()    { echo -e "${YELLOW}[nexus]${NC} $1"; }
error()   { echo -e "${RED}[nexus]${NC} $1"; exit 1; }
section() { echo -e "\n${BOLD}$1${NC}"; }

# ── 1. system deps ────────────────────────────────────────────
section "Checking dependencies..."

if ! command -v docker &>/dev/null; then
  info "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  warn "Added $USER to docker group. You may need to re-login if docker fails below."
fi

docker compose version &>/dev/null || error "Docker Compose plugin missing."

if ! command -v node &>/dev/null; then
  info "Installing Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# ── 2. clone / update ─────────────────────────────────────────
section "Setting up Nexus files..."

mkdir -p "$NEXUS_HOME"/{data/pgdata,context,logs}

if [ -d "$INSTALL_DIR/.git" ]; then
  info "Updating existing install..."
  git -C "$INSTALL_DIR" pull --ff-only
else
  info "Cloning Nexus..."
  git clone "$REPO_URL" "$INSTALL_DIR"
fi

# ── 3. generate .env ──────────────────────────────────────────
section "Configuring environment..."

ENV_FILE="$NEXUS_HOME/.env"
CREDENTIALS_FILE="$NEXUS_HOME/credentials.json"

if [ ! -f "$CREDENTIALS_FILE" ]; then
  info "Creating $CREDENTIALS_FILE..."
  echo "{}" > "$CREDENTIALS_FILE"
else
  info "$CREDENTIALS_FILE already exists — skipping."
fi

if [ ! -f "$ENV_FILE" ]; then
  info "Generating secrets..."
  cp "$INSTALL_DIR/.env.example" "$ENV_FILE"

  JWT_SECRET=$(openssl rand -hex 32)
  POSTGRES_PASSWORD=$(openssl rand -hex 16)
  FERNET_KEY=$(python3 -c \
    "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" \
    2>/dev/null || openssl rand -base64 32)

  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|"             "$ENV_FILE"
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${POSTGRES_PASSWORD}|" "$ENV_FILE"
  sed -i "s|^FERNET_KEY=.*|FERNET_KEY=${FERNET_KEY}|"             "$ENV_FILE"
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://nexus:${POSTGRES_PASSWORD}@db:5432/nexus|"             "$ENV_FILE"


  warn "LLM/bot keys left blank — fill them in at: $ENV_FILE"
  warn "Then run: nexus (to open the TUI and configure everything)"
else
  info ".env already exists — skipping."
fi

# ── 4. seed context files ─────────────────────────────────────
for f in SOUL.md PERSONA.md SKILLS.md DIRECTIVES.md; do
  dest="$NEXUS_HOME/context/$f"
  src="$INSTALL_DIR/backend/context/defaults/$f"
  if [ ! -f "$dest" ]; then
    [ -f "$src" ] && cp "$src" "$dest" || touch "$dest"
    info "Created context/$f"
  fi
done

# ── 5. start services ─────────────────────────────────────────
section "Starting services..."

# exporting so that the compose yaml picks it up
export POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" "$ENV_FILE" | cut -d= -f2)
export NEXUS_HOME="$NEXUS_HOME"
export PORT=$(grep "^PORT=" "$ENV_FILE" | cut -d= -f2 || echo 8000)
export CLIENT_PORT=$(grep "^CLIENT_PORT=" "$ENV_FILE" | cut -d= -f2 || echo 3000)

NEXUS_HOME="$NEXUS_HOME" docker compose \
  -f "$INSTALL_DIR/compose.yaml" \
  --env-file "$ENV_FILE" \
  up -d --build

# ── 6. run migrations ─────────────────────────────────────────
info "Running database migrations..."


export POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" "$ENV_FILE" | cut -d= -f2)
export NEXUS_HOME="$NEXUS_HOME"

NEXUS_HOME="$NEXUS_HOME" docker compose \
  -f "$INSTALL_DIR/compose.yaml" \
  --env-file "$ENV_FILE" \
  exec -T api alembic upgrade head < /dev/null


# ── 7. wait for api ───────────────────────────────────────────
info "Waiting for API to be ready..."
API_PORT=$(grep -E '^PORT=' "$ENV_FILE" | cut -d= -f2 || echo 8000)
for i in $(seq 1 30); do
  if curl -sf "http://localhost:${API_PORT}/health" >/dev/null 2>&1; then
    break
  fi
  printf "."
  sleep 2
done
echo ""

# ── 8. build TUI + install nexus command ─────────────────────
section "Installing nexus command..."

cd "$INSTALL_DIR/tui"
npm install --silent
npm run build

# make dist/index.js executable
chmod +x "$INSTALL_DIR/tui/dist/index.js"

# write a launcher script to /usr/local/bin/nexus
sudo tee "$BIN_PATH" > /dev/null <<EOF
#!/usr/bin/env bash
NEXUS_API_URL=\${NEXUS_API_URL:-http://localhost:${API_PORT}}
exec node "$INSTALL_DIR/tui/dist/index.js" "\$@"
EOF
sudo chmod +x "$BIN_PATH"

info "nexus command installed at $BIN_PATH"

# ── 9. done ───────────────────────────────────────────────────
CLIENT_PORT=$(grep -E '^CLIENT_PORT=' "$ENV_FILE" | cut -d= -f2 || echo 3000)

echo ""
echo -e "${GREEN}${BOLD}✓ Nexus is ready.${NC}"
echo ""
echo -e "  Web UI   → http://localhost:${CLIENT_PORT}"
echo -e "  API      → http://localhost:${API_PORT}"
echo -e "  Config   → $ENV_FILE"
echo -e "  Context  → $NEXUS_HOME/context/"
echo ""
echo -e "  Run ${BOLD}nexus${NC} to open the terminal UI"
echo ""