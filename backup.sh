#!/usr/bin/env bash
# Backup database, uploads, and .env into backups/YYYY-MM-DD-HH-MM/
# Usage: ./backup.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  set -a
  # Export KEY=VALUE lines without sourcing comments
  while IFS= read -r line || [[ -n "$line" ]]; do
    case "$line" in
      ''|\#*) continue ;;
      *)
        key="${line%%=*}"
        val="${line#*=}"
        export "$key=$val" 2>/dev/null || true
        ;;
    esac
  done < .env
  set +a
fi

STAMP="$(date +%Y-%m-%d-%H-%M)"
DEST="$ROOT/backups/$STAMP"
UPLOAD_DIR="${UPLOAD_DIR:-$ROOT/data/uploads}"

mkdir -p "$DEST"

echo "=== Onairo backup → $DEST ==="

# Database
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[FAIL] DATABASE_URL is not set"
  exit 1
fi

if command -v pg_dump >/dev/null 2>&1; then
  if pg_dump "$DATABASE_URL" --no-owner --no-acl -f "$DEST/database.sql"; then
    echo "[OK] database.sql"
  else
    echo "[FAIL] pg_dump failed"
    exit 1
  fi
else
  echo "[FAIL] pg_dump not found"
  exit 1
fi

# Uploads
if [[ -d "$UPLOAD_DIR" ]]; then
  mkdir -p "$DEST/uploads"
  if cp -a "$UPLOAD_DIR/." "$DEST/uploads/"; then
    echo "[OK] uploads/"
  else
    echo "[FAIL] could not copy uploads"
    exit 1
  fi
else
  mkdir -p "$DEST/uploads"
  echo "[OK] uploads/ (empty — source missing)"
fi

# .env (secrets — keep backups private)
if [[ -f "$ROOT/.env" ]]; then
  if cp "$ROOT/.env" "$DEST/.env"; then
    chmod 600 "$DEST/.env" 2>/dev/null || true
    echo "[OK] .env"
  else
    echo "[FAIL] could not copy .env"
    exit 1
  fi
else
  echo "[FAIL] .env not found"
  exit 1
fi

echo "$STAMP" > "$ROOT/backups/latest.txt"
echo "=== Backup complete: $DEST ==="
