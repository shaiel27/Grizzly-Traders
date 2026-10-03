# Animation plans

Plans produced by the `improve-animations` skill. Each is self-contained —
see the plan file itself for exact values; this file only tracks order and status.

| # | Title | Severity | Status |
| --- | --- | --- | --- |
| [001](001-hero-entrance-subtlety.md) | Tone down the home hero's first-load entrance | MEDIUM | DONE |
| [002](002-home-skeleton-shape-match.md) | Match the home loading skeleton to the real hero's shape | HIGH | SUPERSEDED by 003 |
| [003](003-home-skeleton-diffuse-blur.md) | Diffuse/blurred treatment for the home loading skeleton | HIGH | SUPERSEDED by 004 |
| [004](004-home-loading-terminal-boot.md) | Replace the home skeleton with a terminal boot sequence | N/A | SUPERSEDED by 005 |
| [005](005-home-loading-minimal-splash.md) | Full-screen minimal splash for the home loading state | N/A | DONE |
| [006](006-home-globo-holografico.md) | Hero de la home con globo 3D holográfico interactivo | N/A | DONE (ver nota de verificación en el plan — falta revisión visual en navegador) |
| [007](007-globo-carga-fondo-y-calidad.md) | Prompt: carga del globo, fondo animado y calidad visual | HIGH | PROMPT |
| [008](008-home-starfield-tarjetas-anchor.md) | Estabilidad del globo + fondo estrellado + tarjetas estilo "Anchor AI" | N/A | DONE |
| [009](009-globo-activos-sesiones-sentimiento.md) | Globo vivo (activos, sesiones, sentimiento) + rediseño del portal de inicio y bugs | N/A | PLAN |

## Execution order

005 replaces 004 (confirmed: full-screen scope was right, but the content
should be a single minimal breathing mark, not a multi-line text crawl),
which had replaced 003 (and transitively 002) after the skeleton approach
was rejected outright. Execute 005 only. All are independent of 001
(different files).
