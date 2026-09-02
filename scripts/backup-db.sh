#!/usr/bin/env bash
# Dumps the app's Postgres database to a timestamped, gzip-compressed file
# and deletes backups older than $RETENTION_DAYS. Meant to run on the Linux
# server, via cron, from the repo root (same directory as docker-compose.yml
# and .env.production) — see docs/deploy-linux.md for the weekly cron setup.
#
# Usage: ./scripts/backup-db.sh [backup-dir]
#   backup-dir defaults to ./backups

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

BACKUP_DIR="${1:-$REPO_ROOT/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-60}"

if [ ! -f .env.production ]; then
  echo "backup-db.sh: .env.production not found in $REPO_ROOT — aborting." >&2
  exit 1
fi

# Read just the two values we need, without exporting the whole file (it
# also holds SMTP/OAuth secrets this script has no reason to touch).
POSTGRES_USER="$(grep -m1 '^POSTGRES_USER=' .env.production | cut -d= -f2-)"
POSTGRES_DB="$(grep -m1 '^POSTGRES_DB=' .env.production | cut -d= -f2-)"
POSTGRES_USER="${POSTGRES_USER:-hrapp}"
POSTGRES_DB="${POSTGRES_DB:-hrapp_db}"

mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date +%Y-%m-%d_%H%M%S)"
OUT_FILE="$BACKUP_DIR/${POSTGRES_DB}_${TIMESTAMP}.sql.gz"

echo "Backing up $POSTGRES_DB to $OUT_FILE ..."
docker compose --env-file .env.production exec -T db \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "$OUT_FILE"

echo "Done: $(du -h "$OUT_FILE" | cut -f1)"

echo "Removing backups older than $RETENTION_DAYS days ..."
find "$BACKUP_DIR" -name "${POSTGRES_DB}_*.sql.gz" -mtime "+$RETENTION_DAYS" -print -delete

echo "Current backups:"
ls -lh "$BACKUP_DIR"
