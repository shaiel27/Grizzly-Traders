#!/usr/bin/env bash
# Dispara el resumen diario de la newsletter (POST /api/newsletter/digest) y muestra el resultado SIN el HTML del correo.
# Lo ejecuta grizzly-digest.timer una vez al día. El secreto se lee de .env.production y se pasa a curl por stdin (no queda en `ps`).
# Prueba sin enviar nada:  DIGEST_DRY_RUN=1 bash deploy/enviar-resumen.sh
set -euo pipefail
ENV=/srv/grizzly/web/.env.production
SECRETO=$(grep '^DIGEST_CRON_SECRET=' "$ENV" | head -1 | cut -d= -f2-)
[ -n "$SECRETO" ] || { echo "falta DIGEST_CRON_SECRET en $ENV" >&2; exit 1; }
if [ "${DIGEST_DRY_RUN:-0}" = "1" ]; then CUERPO='{"dryRun":true}'; else CUERPO='{}'; fi
RESPUESTA=$(printf 'header = "Authorization: Bearer %s"\n' "$SECRETO" | curl -fsS -m 180 -K - -X POST -H 'Content-Type: application/json' -d "$CUERPO" http://127.0.0.1:3000/api/newsletter/digest)
printf '%s' "$RESPUESTA" | python3 -c '
import json, sys
d = json.load(sys.stdin)
if not d.get("success"):
    print("el servidor respondió sin éxito:", {k: v for k, v in d.items() if k not in ("html", "text")}); sys.exit(1)
for loc, r in d.get("results", {}).items():
    print(loc, {k: v for k, v in r.items() if k not in ("html", "text")})
'
