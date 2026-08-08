# Production checklist — Onairo Solutions

Use this when deploying or updating a live VPS. Details also live in `DEPLOYMENT.md`.

## First-time setup

### 1. Git clone
```bash
git clone <YOUR_REPO_URL> onairo-solutions
cd onairo-solutions
```

### 2. Install
```bash
npm install
```

### 3. Environment
```bash
cp .env.example .env
nano .env
```

Required:
- `NODE_ENV=production`
- `DATABASE_URL`
- `SESSION_SECRET` (long random string — not the example value)
- `TRUST_PROXY=true` (when behind Nginx)

### 4. Prisma
```bash
npx prisma generate
```

### 5. Database
Create PostgreSQL user + database `onairo_core`, then:
```bash
npm run db:init
```

(Optional migrate from legacy JSON: `npm run db:migrate`)

### 6. PM2
```bash
npm i -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Process name: `onairo-solutions`

Verify:
```bash
curl -s http://127.0.0.1:3000/health
```

### 7. Nginx reverse proxy
Proxy `/` to `http://127.0.0.1:3000` with `X-Forwarded-*` headers. See `DEPLOYMENT.md`.

### 8. SSL
```bash
sudo certbot --nginx -d onairosolutions.com -d www.onairosolutions.com
```

### 9. DNS
- `A` / `AAAA` for apex + `www` → VPS IP
- Wait for propagation, then re-check SSL and `/health`

## Backups

```bash
chmod +x backup.sh
./backup.sh
```

Creates `backups/YYYY-MM-DD-HH-MM/` with:
- `database.sql`
- `uploads/`
- `.env`

Schedule with cron (example daily 02:15):
```bash
15 2 * * * cd /path/to/onairo-solutions && ./backup.sh >> logs/backup.log 2>&1
```

## Updates

Preferred:
```bash
chmod +x deploy.sh
./deploy.sh
```

Or manually:
```bash
git pull
npm install   # if package.json / lock changed
npx prisma generate
npm run db:init
pm2 restart onairo-solutions
```

## Smoke test after deploy

| URL | Expect |
|-----|--------|
| `/` | Homepage 200 |
| `/showcase/carshowroom` | Showcase 200 |
| `/portal` or `/portal/login` | Portal login |
| `/health` | JSON `status:"ok"`, `database:true` |
| `/uploads/...` | Only uploaded files (if any) |
| `/server/...`, `/src/...`, `/package.json` | 404 (or redirect from legacy `/src`) |

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Process exits immediately | `pm2 logs onairo-solutions` — missing `DATABASE_URL` / `SESSION_SECRET`, or Postgres down |
| Infinite PM2 restarts | Fix root cause; ecosystem caps restarts (`max_restarts`) |
| `/health` → `database:false` | Postgres running? `DATABASE_URL` correct? Firewall? |
| 502 from Nginx | App listening on 3000? `pm2 status` |
| Sessions / rate limits wrong IP | Set `TRUST_PROXY=true` |
| Showcase 404 | File exists under `public/demos/<name>.html`? |

## Security reminders

- [ ] Strong `SESSION_SECRET` and DB password
- [ ] `.env` and `backups/` never world-readable
- [ ] PostgreSQL not exposed publicly
- [ ] Only ports 22 / 80 / 443 open
- [ ] Regular `./backup.sh`
