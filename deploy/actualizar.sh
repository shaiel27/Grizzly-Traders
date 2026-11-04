#!/usr/bin/env bash
# Actualiza el sitio en el VPS: bash deploy/actualizar.sh   (desde /srv/grizzly/web, como usuario grizzly)
set -euo pipefail
git fetch origin main && git checkout main && git pull --ff-only
pnpm install --frozen-lockfile
pnpm build
sudo systemctl restart grizzly-web
sleep 3 && curl -fsS -o /dev/null -w "sitio: HTTP %{http_code}\n" http://127.0.0.1:3000/
