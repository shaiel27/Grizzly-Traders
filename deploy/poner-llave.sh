#!/usr/bin/env bash
# Cambia UNA variable de /srv/grizzly/web/.env.production sin mostrar ni guardar el valor en el historial.
# Uso (en el VPS, como grizzly):  bash deploy/poner-llave.sh SUPABASE_SERVICE_ROLE_KEY
set -euo pipefail
NOMBRE="${1:?Uso: poner-llave.sh NOMBRE_DE_VARIABLE}"
ARCHIVO=/srv/grizzly/web/.env.production
read -rsp "Pega el valor de $NOMBRE (no se ve al pegar) y pulsa Enter: " VALOR; echo
[ -n "$VALOR" ] || { echo "Vacío: no se cambió nada"; exit 1; }
grep -q "^$NOMBRE=" "$ARCHIVO" || { echo "$NOMBRE no existe en $ARCHIVO"; exit 1; }
VALOR="$VALOR" NOMBRE="$NOMBRE" python3 - "$ARCHIVO" <<'PY'
import os, sys
p, n, v = sys.argv[1], os.environ['NOMBRE'], os.environ['VALOR']
l = [(f'{n}={v}\n' if x.startswith(n + '=') else x) for x in open(p).readlines()]
open(p, 'w').writelines(l)
PY
chmod 600 "$ARCHIVO"
echo "$NOMBRE actualizada. Cuando termines con todas: sudo systemctl restart grizzly-web (o pnpm build si cambiaste una NEXT_PUBLIC_*)."
