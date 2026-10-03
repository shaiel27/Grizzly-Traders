# Plan — Unificación de API de activos (catálogo único en todo el sistema)

> **Generado:** 2026-10-02 · **Commit base:** `3e8f34b`
> **Objetivo:** usar el set completo de la terminal (63 visibles → **64** con el fix de DJI) en **todo** el sistema: pivots, ticker, StatsBar, filtros, CMS.
> **Fuera de alcance:** n8n, etiquetado `post_activos`, cambio de proveedores de datos.

## Diagnóstico verificado

Cuatro catálogos independientes explican las cuentas 63 vs 33:

| Catálogo | Archivo | Declarado | Visible | Alimenta |
|---|---|---|---|---|
| `MARKET_ASSETS` | `lib/market-assets.ts:22-92` | 64 | **63** | `/api/markets` → terminal |
| `PIVOT_ASSETS` | `lib/pivot-assets.ts:20-55` | 34 | **33** | `/api/pivots` → calculadora |
| `TICKER_ASSETS` | `lib/ticker.ts:28-64` | 35 | **34** | `/api/ticker` → marquee header |
| DB `activos` | Supabase seed `schema.sql:308-320` | seed 11 / live **10** | 10 | StatsBar, filtros, CMS, `/api/assets` |

- Las 3 APIs comparten el mismo cliente `scanTradingView` (`lib/markets.ts:72-91`); **la divergencia es solo la lista de tickers** que cada una le pasa.
- El descuadre 63/64 y 33/34 tiene **una causa**: `TVC:DJI` que el scanner descarta en silencio. Probe verificado (2026-10-02): **`DJ:DJI` sí devuelve fila**. Fix ⇒ set completo = **64 visibles**.
- Listas derivadas/paralelas: `FIXED_MAP` yahoo 31 claves (7 muertas), `prices.ts` 4+4+2+4, `format.ts` 6+4 decimales, CoinGecko top-50 (rankings, aparte).
- DB live: 10 filas (falta `XAGUSD` que sí está en el seed ⇒ drift ya existente).

## Decisiones confirmadas

| Decisión | Respuesta |
|---|---|
| Ticker header | **Los 64 también** (set completo en el marquee) |
| Filtros `/articulos` y `/buscar` | **Top popular (~10) + “Ver todos” expandir agrupado por tipo** |
| Fuente de verdad | **Catálogo TS único + seed idempotente a DB `activos`** |

## Arquitectura objetivo

```
lib/assets-catalog.ts          ← ÚNICA fuente de verdad (64 entradas)
        │
        ├─► lib/market-assets.ts   (adapter shape terminal)   → /api/markets
        ├─► lib/pivot-assets.ts    (adapter + POPULAR)        → /api/pivots
        ├─► lib/ticker.ts          (adapter, todos)           → /api/ticker
        ├─► lib/format.ts          (decimales derivados)
        ├─► lib/candles.ts         (yahoo map derivado + overrides)
        └─► seed SQL idempotente ─► tabla activos (10 → 64)   → StatsBar, filtros, CMS
```

### Esquema de entrada

```ts
// lib/assets-catalog.ts
export type AssetClass = 'crypto' | 'forex' | 'commodity' | 'stock' | 'index'
export interface AssetDefinition {
  plain: string          // 'BTC' — DB symbol, company-profile, chips de artículo
  name: string           // 'Bitcoin'
  cls: AssetClass        // → tipos_activo (1 crypto, 2 forex, 3 commodity, 4 stock, 5 index)
  tv: string             // 'BINANCE:BTCUSDT' — TradingView scanner
  yahoo?: string         // override puntual (desde FIXED_MAP, sin las 7 claves muertas)
  decimals: number       // forex 3/5, resto 2 (hoy en format.ts)
  popular?: boolean      // quick-selects de pivots + top de filtros
  currency?: boolean     // flag de formateo del ticker
}
export const ASSETS: readonly AssetDefinition[] = [ /* 64 entradas */ ]
```

Derivados tipados para no romper consumidores: `MARKET_ASSETS`, `PIVOT_ASSETS`, `POPULAR_PIVOT_ASSETS`, `TICKER_ASSETS` (64, orden intercalado round-robin por clase).

---

## Fases de ejecución

### F1 — Catálogo unificado (refactor sin cambio visible)

1. Crear `lib/assets-catalog.ts` mergeando:
   - Base: 64 entradas de `MARKET_ASSETS` (name/tv/cls).
   - `plain`/`currency`/orden ticker desde `TICKER_ASSETS` (`lib/ticker.ts:28-64`).
   - `popular` desde `POPULAR_PIVOT_ASSETS` (`lib/pivot-assets.ts:60-69`).
   - `yahoo` desde `FIXED_MAP` (`lib/candles.ts:47-79`) **eliminando claves muertas**: `COMEX:XAUUSD, COMEX:XAGUSD, COMEX:PL, COMEX:PA, TVC:DAX, TVC:NIKKEI, TVC:FTSE`.
   - `decimals` mapeando `FOREX_3_DECIMALS`/`FOREX_5_DECIMALS` (`lib/format.ts:4-5`); resto → 2.
2. **Fix `TVC:DJI` → `DJ:DJI`** (probe confirmado: devuelve fila).
3. `lib/market-assets.ts` re-exporta derivado del catálogo; consumidores de `/api/markets` sin cambios de import (o migrarlos en el mismo paso).
4. `lib/pivot-assets.ts` y `lib/ticker.ts`: en F1 **siguen exportando sus subsets viejos** (34/35) derivados del catálogo — la expansión a 64 es F2. F1 queda como refactor puro.
5. Tests que se actualizan en el mismo paso: `lib/market-overview.test.ts:32-33` (fixture 64), `lib/ticker.test.ts:53`, `lib/candles.test.ts:23-40` (extender cobertura Yahoo a **todo** el catálogo), `lib/prices.test.ts:52,69`.

**Criterio:** `pnpm test` verde; `/markets` muestra ahora **64** (DJI recuperado); pivots/ticker/DB aún con conteos viejos.

### F2 — Pivots y ticker al set completo

1. `PIVOT_ASSETS` = los 64: `/api/pivots` sigue siendo **1 POST** (`lib/pivot-data.ts:57-63`) — no cambia volumen, solo payload.
   - Selector `PivotCalculator.tsx:6,214,295` se alinea solo.
   - `missingAssets` (`PivotPointsClient.tsx:177`) crece: futuros sin barras `|1W`/`|1M` (Known, README.md:65) — aceptado.
2. `TICKER_ASSETS` = los 64: mismo POST, TTL 2 s + dedupe intactos (`lib/ticker.ts:127-159`).
   - Ajustar `--ticker-duration` (`globals.css:198`, hoy 240 s) ≈ **440 s** (240 × 64/35) para conservar la velocidad visual por item.
3. Formateo del ticker pasa a `decimals` del catálogo por `plain`.

### F3 — DB `activos` sincronizada (StatsBar, filtros, CMS)

1. Migración idempotente `supabase/migrations/00XX_seed_assets_catalog.sql`:

   ```sql
   insert into public.activos (symbol, name, tipo_id)
   values ('BTC','Bitcoin',1), ('ETH','Ethereum',1), ... -- las 64 entradas
   on conflict (symbol) do nothing;

   -- reconciliar drift (p.ej. name/tipo distintos; recupera XAGUSD si se cayó)
   update public.activos a set name = v.name, tipo_id = v.tipo_id
   from (values ('BTC','Bitcoin',1), ...) as v(symbol, name, tipo_id)
   where a.symbol = v.symbol
     and (a.name is distinct from v.name or a.tipo_id is distinct from v.tipo_id);
   ```

2. Efectos en cascada (ya consumen DB, sin código extra):
   - StatsBar home `getAssets()` → 64 (`app/(site)/page.tsx:127`; tag `catalog` → `revalidateTag('catalog')` o espera 300 s).
   - `CategoryFilter` recibe 64 → UI en F4.
   - CMS panel de activos → 64 (CRUD sin cambios).
   - `GET /api/assets` → 64.
3. **Anti-drift:** script dev `scripts/generate-assets-seed.ts` que emite el SQL desde `ASSETS`; documentar en README (editar catálogo ⇒ regenerar seed).

### F4 — Filtros top + expandir

`components/ui/CategoryFilter.tsx:107` (hoy `assets.slice(0, 8)` alfabético):

1. Fila principal: ~10 chips = `ASSETS.filter(a => a.popular)` en orden del catálogo.
2. Botón **“Ver todos”** (`aria-expanded`) → expande el resto **agrupado por tipo** (Crypto / Forex / Materias primas / Acciones / Índices).
3. `useState` local; sin fetch nuevo (lista llega de `getAssets()`).
4. `/buscar/page.tsx:73` usa el mismo componente → mismo comportamiento.

### F5 — Limpieza y documentación

1. `lib/format.ts`: `FOREX_3/5_DECIMALS` derivadas del catálogo (o test de igualdad con `decimals`).
2. Código muerto: `getAssetsForTicker` (`lib/api.ts:333,492`); revisar uso real de `/api/assets` y `/api/prices` (si sin consumidores → documentar como API pública o eliminar).
3. README: conteos (64), flujo “añadir activo” = editar `assets-catalog.ts` + regenerar seed.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Scanner descarta tickers desconocidos en silencio | `DJ:DJI` verificado; `missingAssets` UI notifica; tests de catálogo |
| Futuros sin barras week/month en pivots | Known y aceptado (ya pasaba con 34) |
| `TVC:US02Y` sin chart Yahoo | Documentado en `candles.test.ts:33`; sin cambio |
| Rate limits | 64 = mismo 1 POST (pivots/ticker); markets = 3 batches de 30 sin cambio |
| Fallback precios solo cubre 10 plain symbols (`ticker.ts:111-113`) | Scanner es primario; fallback solo en stale |
| Drift TS↔DB | Seed generada por script + `on conflict` |
| Tests con listas congeladas | Actualizar en F1/F2 mismas |
| StatsBar 10 → 64 | Esperado (dato real); visible tras revalidar tag `catalog` |

## Checklist de aceptación

- [ ] `/markets` muestra **64** (incluye Dow Jones; ya no 63)
- [ ] `/pivot-points` muestra el set completo; selector = lista
- [ ] Ticker header recorre los mismos 64; duración ajustada (~440 s)
- [ ] Home StatsBar “64 activos rastreados”; DB `count(*) = 64` con tipos correctos
- [ ] Filtros `/articulos` y `/buscar`: top popular + expandir agrupado
- [ ] CMS lista 64; crear/borrar activos OK
- [ ] `npx tsc --noEmit && pnpm lint && pnpm test` verdes
- [ ] Un solo punto de edición para añadir un activo: `lib/assets-catalog.ts` + script de seed
- [ ] **n8n sin cambios**

## Orden de ejecución

**F1 → F2 → F3 → F4 → F5** (F1/F2 solo código; F3 SQL + revalidación; F4 UI; F5 limpieza).
