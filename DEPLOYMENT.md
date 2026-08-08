# Onairo Solutions — Production Deployment

This guide covers deploying the Onairo portal + marketing site on a VPS (Hostinger, DigitalOcean, etc.) with PostgreSQL, PM2, Nginx, and Let’s Encrypt.

## Architecture

| Path | Purpose |
|------|---------|
| `public/` | **Only** public document root (site HTML, CSS, JS, demos, images) |
| `/showcase/:name` | Clean demo URLs → `public/demos/:name.html` |
| `/portal` | Private admin portal (Express) |
| `/uploads` | User uploads |
| `server/` | Application code (never exposed as static files) |
| `src/` | Dev sources / generators input (not served) |

## 1. Server prerequisites

- Ubuntu 22.04+ (or similar)
- Node.js 20+
- PostgreSQL 16+
- Nginx
- PM2 (`npm i -g pm2`)
- Git

```bash
sudo apt update
sudo apt install -y nginx postgresql postgresql-contrib certbot python3-certbot-nginx
# Install Node 20 via nodesource or nvm
```

## 2. Clone and install

```bash
git clone <YOUR_REPO_URL> onairo-solutions
cd onairo-solutions
npm install
npx prisma generate
```

## 3. Environment variables

Copy and edit `.env`:

```bash
cp .env.example .env
nano .env
```

Required:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://portal_user:STRONG_PASSWORD@127.0.0.1:5432/onairo_core
SESSION_SECRET=long-random-string
TRUST_PROXY=true
PORTAL_ROUTE=/portal
PUBLIC_DIRECTORY=./public
DEMO_DIRECTORY=./public/demos
UPLOAD_DIR=./data/uploads
AUDIT_SALT=another-long-random-string
```

Optional SMTP / AI keys as needed.

Create the database and schemas (once):

```bash
sudo -u postgres psql -c "CREATE USER portal_user WITH PASSWORD 'STRONG_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE onairo_core OWNER portal_user;"
# Create schemas auth,crm,website,finance,support,licensing,products,cloud,system
# (see scripts/db/init-schemas.sql)
npm run db:init
```

If migrating from the old JSON datastore:

```bash
npm run db:migrate
```

## 4. Start with PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Process name: `onairo-solutions` (see `ecosystem.config.cjs` — capped restarts, graceful stop).

Health check:

```bash
curl -s http://127.0.0.1:3000/health
curl -I http://127.0.0.1:3000/
curl -I http://127.0.0.1:3000/showcase/carshowroom
curl -I http://127.0.0.1:3000/portal/login
```

## 5. Nginx reverse proxy

`/etc/nginx/sites-available/onairo`:

```nginx
server {
    listen 80;
    server_name onairosolutions.com www.onairosolutions.com;

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/onairo /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 6. SSL (Certbot)

```bash
sudo certbot --nginx -d onairosolutions.com -d www.onairosolutions.com
```

Keep `TRUST_PROXY=true` so sessions and rate limits see real client IPs.

## 7. Future updates

Preferred:

```bash
cd ~/onairo-solutions
chmod +x deploy.sh backup.sh
./deploy.sh
```

Manual:

```bash
git pull
npm install
npx prisma generate
npm run db:init
pm2 restart onairo-solutions
```

Backups:

```bash
./backup.sh
```

Optional:

```bash
npm run landings:generate   # regenerates public industry/service pages
npm run seo:generate
```

## 8. Showcase URLs

| Old (legacy, auto-redirects) | New |
|------------------------------|-----|
| `/src/portfolio/demos/carshowroom.html` | `/showcase/carshowroom` |
| `/demo/carshowroom` | `/showcase/carshowroom` |
| `/src/industries/...` | `/industries/...` |

## 8b. EduTrack installer updates

The public download URL is always:

```
/downloads/EduTrack-Setup.exe
```

To ship a new release:

1. Replace `public/downloads/EduTrack-Setup.exe` with the latest installer (keep this exact filename).
2. Commit and push.
3. On the VPS run:
   ```bash
   git pull
   ```
4. No code changes or PM2 restart are required — the installer is a static file under `public/`.

## 9. Security checklist

- [ ] Strong `SESSION_SECRET` and DB password
- [ ] `NODE_ENV=production`
- [ ] Firewall: only 22, 80, 443 public
- [ ] PostgreSQL not exposed publicly
- [ ] Regular `./backup.sh`
- [ ] Confirm `/server`, `/data`, `/.env` return 404
- [ ] Confirm `/health` returns `database: true`

## 10. Docker (optional)

```bash
docker compose up -d --build
```

See `docker-compose.yml`. Ensure `SESSION_SECRET` is set in the environment.
