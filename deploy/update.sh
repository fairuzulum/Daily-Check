#!/usr/bin/env bash
set -euo pipefail
cd /mnt/storage/containers/daily-check
mountpoint -q /mnt/storage
exec 9>/run/lock/daily-check-deploy.lock
flock -n 9 || exit 0
# The public repository needs no stored GitHub credential on the Pi.
tag=$(python3 - <<'PY'
import json, re, urllib.request
r=urllib.request.Request('https://api.github.com/repos/fairuzulum/Daily-Check/releases/latest',headers={'User-Agent':'pi-lab-daily-check'})
with urllib.request.urlopen(r,timeout=30) as f: d=json.load(f)
t=d['tag_name']
if d['draft'] or d['prerelease'] or not re.fullmatch(r'deploy-[0-9a-f]{40}',t): raise SystemExit('Not a production release')
print(t[7:])
PY
)
old=$(sed -n 's/^IMAGE_TAG=//p' .env 2>/dev/null || true)
if [[ "$tag" == "$old" ]]; then
  echo "Already deployed $tag"
  exit 0
fi
tmp=$(mktemp -d ./download.XXXXXX)
trap 'rm -rf "$tmp"' EXIT
base="https://github.com/fairuzulum/Daily-Check/releases/download/deploy-$tag"
curl -fL --retry 3 --max-time 600 "$base/daily-check.tar.gz" -o "$tmp/daily-check.tar.gz"
curl -fL --retry 3 --max-time 60 "$base/SHA256SUMS" -o "$tmp/SHA256SUMS"
(cd "$tmp" && sha256sum -c SHA256SUMS)
docker load -i "$tmp/daily-check.tar.gz"
test "$(docker image inspect "daily-check:$tag" --format '{{.Architecture}}')" = arm64
if [[ -n "$old" ]]; then cp .env .env.previous; fi
printf 'IMAGE_TAG=%s\n' "$tag" > .env
if docker compose up -d --wait --wait-timeout 120; then
  echo "Deployed $tag (healthy)"
else
  echo 'Deployment failed; restoring previous image' >&2
  if [[ -n "$old" ]]; then
    cp .env.previous .env
    docker compose up -d --wait --wait-timeout 120
  else
    rm -f .env
  fi
  exit 1
fi
