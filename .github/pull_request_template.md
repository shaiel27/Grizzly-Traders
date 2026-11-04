## Qué cambia y por qué
<!-- 2–3 líneas: el problema y la solución. Enlaza el issue si existe (Closes #N). -->

## Tipo
- [ ] feat (funcionalidad nueva)
- [ ] fix (corrección)
- [ ] perf / refactor
- [ ] docs / chore / tests

## Cómo probarlo
<!-- Pasos o comandos. Capturas si toca la interfaz (escritorio y móvil). -->

## Lista de comprobación
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build` pasan
- [ ] Textos nuevos en **es y en** (`lib/i18n/dictionaries`)
- [ ] Sin llaves, tokens ni URL secretas en el diff (ni en los JSON de n8n)
- [ ] Si hay migración SQL: archivo numerado en `supabase/migrations/`, y nota de cuándo aplicarla
- [ ] Si cambia un flujo de n8n: JSON actualizado en `n8n/` e importación/reinicio indicados
- [ ] Si cambia el renderizado o el caché: revisado `docs/render-cache.md`
