# Deploying LinkUp (web + API) to the Google Cloud VM

The full stack runs as a Docker Compose project on a single Compute Engine VM and
is published at **https://linkup.mahansigdel.com.np** through a **Cloudflare
Tunnel** (no inbound firewall ports; Cloudflare terminates HTTPS).

## Architecture

```
            Cloudflare edge (HTTPS for linkup.mahansigdel.com.np)
                          │  (outbound tunnel)
                  ┌───────▼────────┐
                  │  cloudflared    │   linkup-vm tunnel
                  └───────┬────────┘
                          │  http://router:80
                  ┌───────▼────────┐
                  │  router (Caddy) │   /api/* , /socket.io/*  → api:4000
                  └───┬─────────┬──┘   everything else         → web:3000
                      │         │
              ┌───────▼──┐  ┌───▼────────┐
              │ api      │  │ web         │
              │ :4000    │  │ (Next.js)   │
              └──┬───┬───┘  └─────────────┘
                 │   │
        ┌────────▼┐ ┌▼────────┐
        │ postgres│ │ redis    │
        └─────────┘ └──────────┘
```

- **VM**: `sigdelmb123@35.255.211.15` (Debian 13, 2 vCPU, ~2 GB RAM + 4 GB swap).
  Project `project-d54f9992-81c3-4261-b21`, zone `us-central1-f`,
  instance `instance-20260622-085630`.
- **Compose file**: `docker-compose.prod.yml`; env in `.env.production` (NOT
  committed — holds `POSTGRES_PASSWORD`, `JWT_SECRET`, `TUNNEL_TOKEN`).
- **SSH (deploy key)**: `ssh -i ~/.ssh/linkup_deploy sigdelmb123@35.255.211.15`
  (the public key lives in the VM's *instance metadata* SSH keys, not just
  `authorized_keys`, so the GCP guest agent doesn't wipe it).

## Cloudflare Tunnel

- Tunnel **`linkup-vm`** (Networks → Tunnels). The connector runs as the
  `cloudflared` compose service using `TUNNEL_TOKEN` from `.env.production`.
- One **Route** (public hostname): `linkup.mahansigdel.com.np` → **HTTP** →
  `router:80`. Cloudflare manages the DNS (CNAME → tunnel) automatically.
- To rotate the token: dashboard → tunnel → *Rotate token*, then update
  `TUNNEL_TOKEN` in `.env.production` and `... up -d cloudflared`.

## Everyday operations (run on the VM, in `~/linkup`)

```bash
EF="--env-file .env.production -f docker-compose.prod.yml"

docker compose $EF ps                 # status
docker compose $EF logs -f api        # tail a service (api|web|router|cloudflared)
docker compose $EF restart api        # restart one service
```

### Deploy an update (after pushing to GitHub)

```bash
cd ~/linkup && git pull --ff-only
EF="--env-file .env.production -f docker-compose.prod.yml"
docker compose $EF up -d --build api web          # rebuild changed apps
docker compose $EF exec -T api pnpm db:migrate    # if the schema changed
```

> The web image bakes `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_WS_URL` at **build**
> time (defaults to the production origin), so always `--build web` after web
> changes. `next build` is RAM-heavy — the 4 GB swap covers it.

### Start the whole stack from cold

```bash
cd ~/linkup
docker compose --env-file .env.production -f docker-compose.prod.yml --profile tunnel up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T api pnpm db:migrate
```

All services use `restart: unless-stopped` and Docker is enabled on boot, so the
stack comes back automatically after a VM reboot.

## Verify

```bash
# on the VM (through the router):
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8088/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8088/api/v1/auth/login -X POST -H 'Content-Type: application/json' -d '{}'
# from anywhere (through Cloudflare):
curl -i https://linkup.mahansigdel.com.np/
curl -i https://linkup.mahansigdel.com.np/api/v1/auth/login -X POST -H 'Content-Type: application/json' -d '{}'
```

## Mobile app

`mobile/src/lib/env.ts` defaults to `https://linkup.mahansigdel.com.np`. To point
a build at a LAN dev server instead, create `mobile/.env.local`:

```
EXPO_PUBLIC_API_URL=http://192.168.x.x:4000
```

then `npx expo start --clear` (env vars are inlined at bundle time).

## Notes / gotchas

- `.npmrc` sets `shamefully-hoist=true` so directly-imported transitive deps
  (e.g. `express`) resolve in the filtered production install.
- The optional `caddy` (profile `tls`) + `deploy/Caddyfile` are an alternative
  HTTPS path (grey-cloud DNS + Let's Encrypt) — unused while the tunnel is active.
- Reserve the VM's external IP as **static** if you ever expose it directly; the
  tunnel doesn't depend on it, but other tooling might.
```
