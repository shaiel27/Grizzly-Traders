# Flujo de ramas y commits

Desarrollo basado en `main` con ramas cortas y pull requests. Objetivo: `main` siempre se puede desplegar.

## Ramas
| Rama | Uso |
|---|---|
| `main` | Estable y desplegable. **Nadie empuja directo**: solo entra por pull request con la CI en verde. |
| `feature/<tema>` | Funcionalidad nueva (`feature/anuncios`, `feature/comunidades`). |
| `fix/<tema>` | Corrección de un error. |
| `docs/…`, `chore/…`, `perf/…`, `refactor/…` | Documentación, mantenimiento, rendimiento, refactor. |
| `hotfix/<tema>` | Arreglo urgente de producción: sale de `main`, PR rápido y etiqueta nueva. |

Reglas: una rama = un propósito; vida corta (días, no semanas); siempre se crea desde `main` actualizado y se rebasa sobre `main` antes del PR; se borra al fusionar.

## Commits
Formato `tipo(ámbito): resumen en imperativo`, en español, y un cuerpo que explique el porqué:
`feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `chore`. Ejemplos: `feat(cms): pestaña de suscriptores`, `fix(i18n): aviso de script al cambiar de idioma`. Un commit = un cambio coherente que compila y pasa las pruebas.

## Pull requests
1. Rama desde `main` → commits → `git push -u origin <rama>` → `gh pr create` (usa la plantilla).
2. La CI (`verify`: lint, typecheck, test, build) debe pasar.
3. Revisión (CODEOWNERS) y fusión con **squash** si la rama tiene commits de trabajo, o **rebase** si ya están limpios. Sin commits de merge.
4. Se borra la rama.

### Qué exige revisar siempre
- Migraciones SQL: archivo numerado en `supabase/migrations/`; se aplican a Supabase **después** de fusionar y antes de desplegar el código que las usa.
- Flujos de n8n: el JSON de `n8n/` es la fuente de verdad (sin llaves ni datos de la cuenta). Tras fusionar hay que importarlo y reiniciar n8n entre ciclos.
- Secretos: nunca en el repositorio (el repo es **público**). Van en `.env.local`, variables de n8n o el servidor.
- Documentos internos (planes, auditorías legales, registro de fuentes): se guardan en `privado/`, que git ignora.

## Versiones y despliegue
- `main` se despliega al VPS. Cada despliegue de producción lleva etiqueta semántica: `git tag -a v0.1.0 -m "Primer despliegue"`.
- Hotfix: rama `hotfix/…` → PR → fusión → etiqueta de parche (`v0.1.1`) → despliegue.

## Dependabot
Sus PR se revisan semanalmente: se fusionan los de la CI verde; los de versión mayor (TypeScript, tipos de Node) se prueban en una rama aparte.

## Protección de `main` (configurar una vez en GitHub)
Settings → Branches → regla para `main`: exigir pull request, exigir que pase la comprobación `verify`, bloquear force-push y borrado, y exigir ramas al día. Equivale a:

```bash
gh api -X PUT repos/shaiel27/Grizzly-Traders/branches/main/protection --input - <<'JSON'
{ "required_status_checks": { "strict": true, "contexts": ["verify"] },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 0 },
  "restrictions": null, "allow_force_pushes": false, "allow_deletions": false }
JSON
```
(`required_approving_review_count: 0` mientras trabaje una sola persona; subirlo a 1 cuando haya más.)

## Limpieza pendiente
Ramas locales `worktree-agent-*` de sesiones anteriores y ramas remotas ya fusionadas: revisar cuáles tienen trabajo sin fusionar antes de borrarlas (`git branch --no-merged main`).
