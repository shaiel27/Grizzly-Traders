#!/usr/bin/env bash
# Crea en n8n la credencial «X (grizzlytraders)» con la configuracion OAuth2 de X y SIN claves (Client ID y Client Secret vacios).
# Despues se abre en la interfaz de n8n, se pegan Client ID y Client Secret (los pone quien administra la cuenta de X) y se pulsa «Connect my account».
# Uso (en el VPS, como grizzly):  bash /srv/grizzly/web/deploy/crear-credencial-x.sh
# Es idempotente: si la credencial ya existe y tiene claves, NO se pisa.
set -euo pipefail

CONTENEDOR=n8n-n8n-1
ID=XcredGrizzly0001 # el flujo del pipeline (nodo «X - Publicar») apunta a este id

if docker exec "$CONTENEDOR" n8n export:credentials --id="$ID" --output=/tmp/cred-x-existe.json >/dev/null 2>&1; then
  docker exec "$CONTENEDOR" rm -f /tmp/cred-x-existe.json
  echo "La credencial $ID ya existe: no se toca (ábrela en n8n para ver su estado)."
  exit 0
fi

TMP=$(mktemp)
trap 'rm -f "$TMP"; docker exec "$CONTENEDOR" rm -f /tmp/cred-x.json 2>/dev/null || true' EXIT
cat > "$TMP" <<'JSON'
[{"id":"XcredGrizzly0001","name":"X (grizzlytraders)","type":"oAuth2Api","data":{"grantType":"pkce","authUrl":"https://x.com/i/oauth2/authorize","accessTokenUrl":"https://api.x.com/2/oauth2/token","clientId":"","clientSecret":"","scope":"tweet.read tweet.write users.read media.write offline.access","authQueryParameters":"","authentication":"header","sendAdditionalBodyProperties":false,"additionalBodyProperties":"{}"}}]
JSON
docker cp "$TMP" "$CONTENEDOR":/tmp/cred-x.json
docker exec "$CONTENEDOR" n8n import:credentials --input=/tmp/cred-x.json
echo "Listo: credencial «X (grizzlytraders)» creada sin claves. Siguiente paso: abrirla en n8n, pegar Client ID y Client Secret, y pulsar «Connect my account»."
