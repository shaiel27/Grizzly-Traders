#!/usr/bin/env bash
# Guarda en el servidor las 4 claves OAuth 1.0a de X (@grizzlytraders) con las que n8n firma la SUBIDA DE LA PORTADA.
# Las claves se escriben aquí, con entrada oculta: no se muestran, no pasan por el chat ni por el repositorio.
# Quedan en /srv/grizzly/n8n/.env (permisos 600) y el compose las pasa a n8n como variables de entorno.
#
# Uso (en tu PowerShell, con el terminal interactivo):
#   ssh -t grizzly@179.236.75.184 'bash /srv/grizzly/web/deploy/poner-claves-x-oauth1.sh'
#
# NO reinicia n8n: el reinicio se hace aparte, entre tandas (cada 45 min, a las :00 UTC).
set -euo pipefail

DIR="${N8N_DIR:-/srv/grizzly/n8n}"
ENV="$DIR/.env"
COMPOSE="$DIR/docker-compose.yml"
[ -f "$ENV" ] && [ -f "$COMPOSE" ] || { echo "No encuentro $ENV o $COMPOSE" >&2; exit 1; }

limpiar() { printf '%s' "$1" | tr -d '[:space:]\r\n"'"'"; }
pedir() { # nombre-visible, variable
  local v
  IFS= read -rsp "$1: " v; echo >&2
  v="$(limpiar "$v")"
  if ! [[ "$v" =~ ^[A-Za-z0-9_-]{20,120}$ ]]; then
    echo "Valor no válido para «$1» (esperaba 20 a 120 letras, números, - o _; recibí ${#v} caracteres). No se guardó nada." >&2
    exit 1
  fi
  printf -v "$2" '%s' "$v"
}

echo "Pega cada valor y pulsa Enter (no se verá nada al pegar):" >&2
pedir "API Key (Consumer Key)" K1
pedir "API Key Secret (Consumer Secret)" K2
pedir "Access Token" K3
pedir "Access Token Secret" K4

[[ "$K3" == *-* ]] || { echo "El Access Token de X lleva un guion (NNNN-XXXX): revisa que no hayas pegado otro valor. No se guardó nada." >&2; exit 1; }
[ "$K1" != "$K2" ] && [ "$K3" != "$K4" ] && [ "$K1" != "$K3" ] || { echo "Dos valores son iguales: revisa lo que pegaste. No se guardó nada." >&2; exit 1; }

F="$(date +%Y%m%d-%H%M%S)"
cp -p "$ENV" "$ENV.ANTES-x-oauth1-$F"
cp -p "$COMPOSE" "$COMPOSE.ANTES-x-oauth1-$F"

# .env: quita versiones anteriores y añade las 4 (permisos 600)
TMP="$(mktemp)"; chmod 600 "$TMP"
grep -v '^X_OAUTH1_' "$ENV" > "$TMP" || true
{
  printf 'X_OAUTH1_API_KEY=%s\n' "$K1"
  printf 'X_OAUTH1_API_SECRET=%s\n' "$K2"
  printf 'X_OAUTH1_TOKEN=%s\n' "$K3"
  printf 'X_OAUTH1_TOKEN_SECRET=%s\n' "$K4"
} >> "$TMP"
mv "$TMP" "$ENV"; chmod 600 "$ENV"

# compose: las pasa a n8n (sin los valores, solo la referencia)
if ! grep -q 'X_OAUTH1_API_KEY' "$COMPOSE"; then
  sed -i '/X_PUBLICAR_ACTIVO:/a\      # Subida de la portada a X: OAuth 1.0a con el token de la propia cuenta (el flujo firma la peticion). Valores en .env\n      X_OAUTH1_API_KEY: ${X_OAUTH1_API_KEY:-}\n      X_OAUTH1_API_SECRET: ${X_OAUTH1_API_SECRET:-}\n      X_OAUTH1_TOKEN: ${X_OAUTH1_TOKEN:-}\n      X_OAUTH1_TOKEN_SECRET: ${X_OAUTH1_TOKEN_SECRET:-}' "$COMPOSE"
fi
grep -q 'X_OAUTH1_TOKEN_SECRET' "$COMPOSE" || { echo "No pude editar el compose; restaura $COMPOSE.ANTES-x-oauth1-$F" >&2; exit 1; }

echo "Listo. Guardadas 4 claves (longitudes: ${#K1}, ${#K2}, ${#K3}, ${#K4}) en $ENV con permisos 600."
echo "Respaldos: *.ANTES-x-oauth1-$F. n8n NO se ha reiniciado: avisa a Claude para reiniciarlo entre tandas."
unset K1 K2 K3 K4
