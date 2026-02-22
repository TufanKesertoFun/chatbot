# One-URL Deployment (Docker)

This deploy setup serves:
- Frontend at `/`
- API at `/api/*`
- Socket.IO at `/socket.io/*`

All from a single public URL.

## 1. Prepare env files

From `deploy/`:

```bash
cp .env.example .env
cp server.env.example server.env
```

Then edit:
- `deploy/.env` -> set strong `POSTGRES_PASSWORD`
- `deploy/server.env` -> set domain, secrets, API keys

Important:
- `CORS_ORIGIN` must match your real public URL (example: `https://chat.example.com`)
- Keep `DATABASE_URL` host as `db` (Docker service name)

## 2. Start stack

From `deploy/`:

```bash
docker compose --env-file .env up -d --build
```

## 3. Run DB migrations + seed

```bash
docker compose --env-file .env exec api npx prisma migrate deploy
docker compose --env-file .env exec api npm run seed
```

## 4. Open app

- App: `http://YOUR_SERVER_IP/`
- Agent portal: `http://YOUR_SERVER_IP/agent`

## 5. Add HTTPS (recommended)

Use Nginx on host + Certbot, or Cloudflare proxy in front of this stack.
Once HTTPS is active, set:

- `CORS_ORIGIN=https://your-domain.com`

and restart API:

```bash
docker compose --env-file .env restart api
```
