# Deploying the LinkUp backend to a Google Cloud VM

The backend (NestJS API + Postgres + Redis) runs as a Docker Compose stack on a
single Compute Engine VM. The mobile app then points at the VM instead of your
laptop's LAN IP.

## 0. Prerequisites on the VM
- A Compute Engine VM (Debian/Ubuntu recommended), SSH access.
- Docker + Compose v2:
  ```bash
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker $USER && newgrp docker   # run docker without sudo
  docker compose version
  ```

## 1. Open the firewall (GCP)
Allow inbound to the API (and 80/443 if you'll use a domain). From Cloud Shell or
any machine with gcloud:
```bash
# HTTP-on-IP (quickest, good for testing):
gcloud compute firewall-rules create linkup-api --allow=tcp:4000 --direction=INGRESS --network=default
# OR domain + HTTPS (Caddy):
gcloud compute firewall-rules create linkup-web --allow=tcp:80,tcp:443 --direction=INGRESS --network=default
```
Also confirm the VM has an **external IP** (ephemeral is fine for testing; reserve a
static IP for production).

## 2. Get the code onto the VM
```bash
git clone https://github.com/ByapakSigdel/linkup.git
cd linkup
```

## 3. Configure secrets
```bash
cp .env.production.example .env.production
nano .env.production
```
Set at minimum:
- `POSTGRES_PASSWORD` → `openssl rand -base64 24`
- `JWT_SECRET` → `openssl rand -hex 48`
- `API_URL` → `http://YOUR_VM_IP:4000` (or `https://api.yourdomain.com`)
- `CORS_ORIGIN` → your web origin, or `*` if mobile-only
- (domain only) `DOMAIN` → `api.yourdomain.com`

## 4. Start it
```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f api      # watch it boot
```

## 5. Run database migrations (first deploy + after schema changes)
```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec api pnpm db:migrate
# optional demo data:
docker compose --env-file .env.production -f docker-compose.prod.yml exec api pnpm db:seed
```

## 6. Verify
```bash
curl -i http://localhost:4000/api/v1/auth/login -X POST -H 'Content-Type: application/json' -d '{}'
# from your laptop:
curl -i http://YOUR_VM_IP:4000/api/v1/auth/login -X POST -H 'Content-Type: application/json' -d '{}'
```
A JSON error (not a connection failure) means it's up.

## 7. (Recommended) HTTPS with a domain
Point a DNS **A record** `api.yourdomain.com → VM_IP`, set `DOMAIN` in
`.env.production`, then:
```bash
docker compose --env-file .env.production -f docker-compose.prod.yml --profile tls up -d
```
Caddy gets a Let's Encrypt cert automatically and proxies `https://api.yourdomain.com → api:4000`.
(Alternatively, if you use Cloudflare Tunnel — you already have `cloudflared` — run a tunnel to `http://localhost:4000` and let Cloudflare terminate TLS.)

## 8. Point the mobile app at the server
Create `mobile/.env`:
```
# domain + HTTPS (recommended for real devices / release builds):
EXPO_PUBLIC_API_URL=https://api.yourdomain.com
# …or plain HTTP on the VM IP (Android dev builds allow cleartext):
# EXPO_PUBLIC_API_HOST=YOUR_VM_IP
```
Then rebuild/reload the app (`npx expo start --clear`, or a new dev/EAS build).
> Release (Play Store) builds block cleartext HTTP — use the HTTPS/domain option
> for anything beyond local testing.

## Updating later
```bash
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml exec api pnpm db:migrate
```
