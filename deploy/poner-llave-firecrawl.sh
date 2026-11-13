#!/usr/bin/env bash
# Cambia la clave de Firecrawl de la credencial de n8n SIN mostrarla ni guardarla en el historial, y comprueba cuantos creditos tiene.
# Uso desde tu PC (PowerShell): copia la clave y ejecuta
#   Get-Clipboard | ssh grizzly@179.236.75.184 bash /srv/grizzly/web/deploy/poner-llave-firecrawl.sh
# o, sin portapapeles (pide la clave oculta):
#   ssh -t grizzly@179.236.75.184 bash /srv/grizzly/web/deploy/poner-llave-firecrawl.sh
# Antes de cambiar nada guarda un respaldo de la credencial actual (cifrada) en /srv/grizzly/n8n/import/. La clave nueva solo pasa por la memoria de
# este script y por un archivo temporal con permisos 600 que se borra al terminar.
set -euo pipefail

CRED_ID="${1:-FcA9kQm2XbT7wPzL}" # id de la credencial «Firecrawl API» en el flujo del pipeline
CONTENEDOR=n8n-n8n-1
RESPALDO="/srv/grizzly/n8n/import/respaldo-credencial-firecrawl-$(date +%Y%m%d-%H%M).json"

read -rsp "Pega la clave de Firecrawl (no se ve al pegar) y pulsa Enter: " VALOR || true; echo
[ -n "$VALOR" ] || { echo "Vacío: no se cambió nada"; exit 1; }
# PowerShell puede añadir caracteres invisibles (marca de codificacion, saltos de linea de Windows) al pasar el portapapeles:
# se quitan los caracteres de control y se busca la clave dentro del texto recibido.
LARGO_RECIBIDO=${#VALOR}
VALOR=$(printf '%s' "$VALOR" | tr -d '\000-\037' | grep -o 'fc-[A-Za-z0-9]\{16,\}' | head -n1 || true)
if [ -z "$VALOR" ]; then
  echo "No encontré una clave de Firecrawl (fc-...) en lo recibido ($LARGO_RECIBIDO caracteres): no se cambió nada."
  echo "Comprueba que lo copiado sea la clave y no otro texto."
  exit 1
fi

# 1) la clave debe funcionar ANTES de tocar nada
RESP=$(curl -s -m 20 -w '\n%{http_code}' -H "Authorization: Bearer $VALOR" https://api.firecrawl.dev/v2/team/credit-usage || true)
CODIGO=$(printf '%s' "$RESP" | tail -n1)
if [ "$CODIGO" != "200" ]; then echo "Firecrawl rechazó la clave (HTTP $CODIGO): no se cambió nada"; exit 1; fi
printf '%s' "$RESP" | head -n -1 | python3 -c "import sys,json;d=json.load(sys.stdin).get('data',{});print('Clave válida. Créditos restantes:',d.get('remaining_credits'),'de',d.get('plan_credits'),'| el periodo termina:',d.get('billing_period_end'))"

TMP=$(mktemp); chmod 600 "$TMP"
limpiar() { shred -u "$TMP" 2>/dev/null || rm -f "$TMP"; docker exec "$CONTENEDOR" rm -f /tmp/cred-firecrawl.json 2>/dev/null || true; }
trap limpiar EXIT

# 2) respaldo cifrado de la credencial actual
docker exec "$CONTENEDOR" n8n export:credentials --id="$CRED_ID" --output=/tmp/cred-firecrawl.json >/dev/null
docker cp "$CONTENEDOR":/tmp/cred-firecrawl.json "$RESPALDO"; chmod 600 "$RESPALDO"
echo "Respaldo (cifrado) en $RESPALDO"

# 3) se exporta descifrada, se cambia SOLO el campo apiKey y se vuelve a importar
docker exec "$CONTENEDOR" n8n export:credentials --id="$CRED_ID" --decrypted --output=/tmp/cred-firecrawl.json >/dev/null
docker cp "$CONTENEDOR":/tmp/cred-firecrawl.json "$TMP"
VALOR="$VALOR" python3 - "$TMP" <<'PY'
import json, os, sys
p = sys.argv[1]
d = json.load(open(p))
lista = d if isinstance(d, list) else [d]
assert len(lista) == 1, 'se esperaba exactamente una credencial'
c = lista[0]
assert 'apiKey' in c.get('data', {}), 'la credencial no tiene el campo apiKey (campos: ' + ', '.join(c.get('data', {})) + ')'
c['data']['apiKey'] = os.environ['VALOR']
json.dump(lista, open(p, 'w'))
PY
docker cp "$TMP" "$CONTENEDOR":/tmp/cred-firecrawl.json
docker exec "$CONTENEDOR" n8n import:credentials --input=/tmp/cred-firecrawl.json

# 4) n8n carga las credenciales al arrancar
docker restart "$CONTENEDOR" >/dev/null
echo "Listo: la credencial «Firecrawl API» tiene la clave nueva y n8n se reinició."
echo "Recomendado: regenera esta clave en el panel de Firecrawl si alguna vez la pegaste en un chat."
