# Raspberry Pi production deployment

Production: https://daily.fairuzulum.dev

## Pipeline

Push to `main` → GitHub Actions (native ARM64) → lint → Docker/Next.js build → HTTP smoke test → immutable GitHub Release image → Pi timer downloads and verifies SHA256 → Docker Compose health check.

The Pi checks for a new successful release every two minutes. Failed builds do not publish a deployment. A failed container health check restores the previous image when available. Deployment recreates one container, so brief downtime is possible; this is not a zero-downtime deployment.

Repository: https://github.com/fairuzulum/Daily-Check (public). Release images are also public. Only Supabase **publishable** credentials are embedded in the browser bundle; never add service-role or other secrets to build arguments or release assets. If the repo becomes private, configure authenticated release downloads first.

Set GitHub repository Actions **variables**:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Next.js embeds these at build time. Changing either requires a new workflow build/commit. Existing Supabase data/auth remain in Supabase cloud. Do not replay migrations against the existing production database. Use a separate Supabase project for destructive local testing.

## Local development

Use Node 22, `npm ci`, and an ignored `.env.local` matching `.env.example`. Run `npm run dev`. Commit and push code to `main` to deploy. Saving a local file alone does not deploy.

## Pi layout

`/mnt/storage/containers/daily-check/` holds `compose.yaml`, `update.sh`, `.env` (current commit image tag), and `.env.previous` (rollback tag). Images are stored in Docker's HDD data-root. No host port is published. NPM forwards `daily.fairuzulum.dev` to `http://daily-check:3000` on `npm_proxy`.

Cloudflare Tunnel needs a published application route for `daily.fairuzulum.dev` to `http://nginx-proxy-manager:80` (both containers share `npm_proxy`). TLS is terminated at Cloudflare. Add `https://daily.fairuzulum.dev` to Supabase Auth URL configuration if redirect-based flows are used, preserving any existing Vercel/local URLs.

## Operations and rollback

```bash
sudo systemctl status daily-check-update.timer
sudo journalctl -u daily-check-update.service -n 80 --no-pager
sudo systemctl start daily-check-update.service
cd /mnt/storage/containers/daily-check
sudo docker compose ps
```

Rollback (stop polling first to prevent automatic redeployment):
```bash
sudo systemctl stop daily-check-update.timer
cd /mnt/storage/containers/daily-check
sudo cp .env.previous .env
sudo docker compose up -d --wait --wait-timeout 120
```

Revert the bad commit in Git and push a fix; re-enable the timer with `sudo systemctl start daily-check-update.timer`. Old images/releases are retained deliberately; review disk usage and remove only explicitly selected obsolete versions, retaining rollback images. Changes to files under `deploy/` require a deliberate update of the Pi's deployment configuration; the timer updates application images only.
