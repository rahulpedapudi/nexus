#!/usr/bin/env bash
set -euo pipefail

NEXUS_HOME="${NEXUS_HOME:-$HOME/.nexus}"
INSTALL_DIR="${NEXUS_HOME}/repo"
COMPOSE="docker compose -f $INSTALL_DIR/compose.yaml --env-file $NEXUS_HOME/.env"

case "${1:-help}" in
  start)    $COMPOSE up -d ;;
  stop)     $COMPOSE down ;;
  restart)  $COMPOSE restart api ;;
  logs)     $COMPOSE logs -f ${2:-api} ;;
  status)   $COMPOSE ps ;;
  shell)    $COMPOSE exec api bash ;;
  db)       $COMPOSE exec db psql -U nexus -d nexus ;;
  update)
    git -C "$INSTALL_DIR" pull --ff-only
    cd "$INSTALL_DIR/tui" && npm install --silent && npm run build
    $COMPOSE up -d --build
    $COMPOSE exec api alembic upgrade head
    ;;
  backup)
    TS=$(date +%Y%m%d_%H%M%S)
    $COMPOSE exec db pg_dump -U nexus nexus > "$NEXUS_HOME/data/backup_${TS}.sql"
    echo "Saved: $NEXUS_HOME/data/backup_${TS}.sql"
    ;;
  tui)
    exec node "$INSTALL_DIR/tui/dist/index.js"
    ;;
  *)
    echo "Usage: nexus.sh [start|stop|restart|update|logs|status|shell|db|backup|tui]"
    ;;
esac