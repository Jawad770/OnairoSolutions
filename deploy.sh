#!/usr/bin/env bash
# Production deploy helper for Onairo Solutions.
# Usage (on the VPS): ./deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

PM2_NAME="${PM2_NAME:-onairo-solutions}"
FAILED=0

ok() { echo "[OK] $*"; }
fail() { echo "[FAIL] $*"; FAILED=1; }
die() { echo "[FAIL] $*"; exit 1; }

echo "=== Onairo Solutions deploy ==="
echo "Directory: $ROOT"
echo ""

# 1. git pull
if ! git pull; then
  die "git pull failed"
fi
ok "git pull"

# 2. npm install only if package manifests changed
NEED_INSTALL=0
if git diff --name-only HEAD@{1} HEAD 2>/dev/null | grep -qE '^(package\.json|package-lock\.json)$'; then
  NEED_INSTALL=1
elif [[ ! -d node_modules ]]; then
  NEED_INSTALL=1
fi

if [[ "$NEED_INSTALL" -eq 1 ]]; then
  if npm install; then
    ok "npm install"
  else
    die "npm install failed"
  fi
else
  ok "npm install skipped (no package changes)"
fi

# 3. prisma generate
if npx prisma generate; then
  ok "prisma generate"
else
  die "prisma generate failed"
fi

# 4. database init (idempotent seed / schema ensure)
if npm run db:init; then
  ok "db:init"
else
  die "db:init failed"
fi

# 5. pm2 restart
if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
    if pm2 restart "$PM2_NAME"; then
      ok "pm2 restart $PM2_NAME"
    else
      die "pm2 restart failed"
    fi
  else
    if pm2 start ecosystem.config.cjs; then
      ok "pm2 start $PM2_NAME (first run)"
    else
      die "pm2 start failed"
    fi
  fi
else
  die "pm2 not found — install with: npm i -g pm2"
fi

echo ""
if [[ "$FAILED" -eq 0 ]]; then
  echo "=== Deploy succeeded ==="
  exit 0
fi
echo "=== Deploy finished with errors ==="
exit 1
