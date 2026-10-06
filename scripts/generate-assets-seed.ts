// Emite el SQL de seed/reconciliación de la tabla `activos` desde lib/assets-catalog.ts, la
// única fuente de verdad. Correr después de editar el catálogo (agregar/quitar/renombrar un
// activo) y pegar la salida en una migración nueva de supabase/migrations/ — así la tabla real
// nunca queda desincronizada del catálogo sin que alguien lo note.
//
// Uso: npx tsx scripts/generate-assets-seed.ts
import { ASSETS, ASSET_CLASS_TIPO_ID } from '../lib/assets-catalog'

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

const valores = ASSETS.map((a) => `  (${sqlString(a.plain)}, ${sqlString(a.name)}, ${ASSET_CLASS_TIPO_ID[a.cls]})`).join(',\n')

console.log(`-- Generado por scripts/generate-assets-seed.ts desde lib/assets-catalog.ts — no editar a mano,
-- volver a correr el script y pegar la salida si el catálogo cambió.
insert into public.activos (symbol, name, tipo_id) values
${valores}
on conflict (symbol) do nothing;

-- Reconcilia drift: activos que ya existían con un name/tipo_id distinto al del catálogo actual.
update public.activos a set name = v.name, tipo_id = v.tipo_id
from (values
${valores}
) as v(symbol, name, tipo_id)
where a.symbol = v.symbol
  and (a.name is distinct from v.name or a.tipo_id is distinct from v.tipo_id);`)
