#!/usr/bin/env bash
# Mantenimiento diario del almacenamiento (retención de portadas de 18 días). Lo lanza cron en el VPS, como usuario grizzly:
#   23 6 * * * /srv/grizzly/web/deploy/mantenimiento-portadas.sh >> /home/grizzly/mantenimiento-portadas.log 2>&1
# Lee PIPELINE_API_SECRET (y, opcional, ALERT_WEBHOOK_URL para avisar por Discord) de .env.production. Nada se imprime del secreto.
# Uso manual de prueba (solo informa, no borra):  bash deploy/mantenimiento-portadas.sh ensayo
set -uo pipefail
ENVF=/srv/grizzly/web/.env.production
valor() { grep -E "^$1=" "$ENVF" | tail -1 | cut -d= -f2- | sed -E "s/^['\"]//; s/['\"]$//"; }
SECRETO=$(valor PIPELINE_API_SECRET)
AVISO=$(valor ALERT_WEBHOOK_URL)
[ -n "$SECRETO" ] || { echo "$(date -u +%FT%TZ) falta PIPELINE_API_SECRET"; exit 1; }
if [ "${1:-}" = "ensayo" ]; then CUERPO='{"ensayo":true}'; else CUERPO='{"ensayo":false}'; fi
SALIDA=$(curl -s -m 300 -w '\n%{http_code}' -X POST -H "Authorization: Bearer $SECRETO" -H 'Content-Type: application/json' --data "$CUERPO" http://127.0.0.1:3000/api/mantenimiento/portadas)
CODIGO=${SALIDA##*$'\n'}; RESPUESTA=${SALIDA%$'\n'*}
echo "$(date -u +%FT%TZ) HTTP $CODIGO $RESPUESTA"
avisar() { [ -n "$AVISO" ] && curl -s -m 20 -H 'Content-Type: application/json' --data "{\"content\":\"$1\"}" "$AVISO" >/dev/null; }
if [ "$CODIGO" != "200" ]; then avisar "⚠️ Grizzly: el mantenimiento de portadas falló (HTTP $CODIGO). Revisa ~/mantenimiento-portadas.log"; exit 1; fi
if echo "$RESPUESTA" | grep -q '"alerta":true'; then avisar "⚠️ Grizzly: el almacenamiento de Supabase pasó del 80 %. Reduce la retención o pasa a Pro."; fi
