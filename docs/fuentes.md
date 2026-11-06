# Fuentes del pipeline de noticias (opción A: solo fuentes públicas)

Desde nov-2026 el pipeline lee **solo fuentes públicas**: organismos cuyo contenido es de dominio público o de reutilización libre con atribución. Se retiraron Investing.com y Cointelegraph, cuyos términos prohíben copiar, raspar o reescribir su contenido.

> Este documento recoge lo que dicen los textos de cada fuente, leídos en nov-2026. **No es asesoramiento legal**: la decisión final conviene validarla con un abogado de propiedad intelectual. Los términos cambian: antes de añadir una fuente, léelos de nuevo.

## Fuentes activas

| Fuente | Feed | Qué permiten sus términos | Condiciones que cumplimos |
|---|---|---|---|
| **Reserva Federal** | `federalreserve.gov/feeds/press_all.xml` | «Public domain and may be copied and distributed without permission». | Citar a la Junta (atribución estructurada `source_id`). No usar logos ni sellos. Material de terceros (fotos, gráficos) no es libre. |
| **SEC** | `sec.gov/news/pressreleases.rss` | Información pública, copiable sin permiso. | Citar a la SEC. Máx. 10 peticiones/s y no se permiten bots «unclassified» (nuestro uso es de unas pocas páginas por vuelta). No usar el sello ni los logos. |
| **CFTC** | `cftc.gov/RSS/RSSGP/rssgp.xml` | Contenido propio en dominio público, con atribución. | Fotos y materiales de terceros pueden tener copyright. |
| **BCE** | `ecb.europa.eu/rss/press.html` | Uso libre citando al BCE como fuente. | Citar al BCE; **si se modifica, decirlo explícitamente** (el aviso «redacción propia a partir de información pública» lo cubre). **Solo comunicados (`/press/pr/`)**: los discursos, entrevistas y blog llevan nombre de autor y exigen autorización escrita; el normalizador los descarta. |
| **EIA** | `eia.gov/rss/todayinenergy.xml` | Agencia federal de EE. UU.: obra del gobierno, dominio público. | Atribución. |
| **BEA** | `bea.gov/rss/rss.xml` | Agencia federal de EE. UU.: obra del gobierno, dominio público. | Atribución. |

Cada nota enlaza al original y muestra «Fuente oficial: …» (campo `posts.source_id`, ids en la migración `0011`).

## Fuentes revisadas y descartadas

| Fuente | Por qué no |
|---|---|
| **Investing.com** (antes la principal) | §10(c): prohíbe «employing any automated system or software to extract data or content», «scraping, data mining, robot or spider programs». §10(a): prohíbe el uso «for any commercial or business purposes». §10(b): prohíbe copiar o modificar el contenido. Pide consentimiento escrito de Fusion Media (`tools@investing.com`, `Legal@investing.com`). Términos con «Last Modified: August 2026». |
| **Cointelegraph** | Prohíbe «automated scraping, or creation of independent content pipelines» y usar el contenido en sistemas de IA sin autorización escrita. Contacto legal: `Legal@cointelegraph.com`. |
| **FXStreet** | Su contrato de distribución exige «must not edit, alter or otherwise change» el contenido, requiere autorización para traducir y prohíbe el uso en IA. |
| **CoinDesk** | Términos vigentes desde el 30-oct-2026: prohíben «use, copy, reproduce, republish, … or modify the Content» y los robots o scrapers sin permiso escrito. |
| **CNBC (NBCUniversal)** | Licencia solo para uso personal; sin permiso para reproducir. |
| **OilPrice** | Su política (`/llms.txt`) permite «short excerpts for summaries»; la reproducción completa requiere permiso. No se encontraron sus términos completos: no se usa. |
| **Seeking Alpha** | Su página de términos no se pudo leer (404): sin verificar. |
| **Census, BLS** | Públicas, pero sus feeds enlazan a páginas fijas (no una URL por publicación) y el descarte de lo ya tratado se basa en la URL: se trataría una sola vez. Posible ampliación con otro método de deduplicación. |

Además, CoinDesk, OilPrice y CNBC bloquean en su `robots.txt` a los rastreadores de IA conocidos (10–13 agentes cada una): señal de que no quieren que su contenido pase por modelos como el que usamos para reescribir.

## Cómo funciona la selección (cambio de nov-2026)
Antes se tomaban las 3 notas más recientes por fecha: una fuente que publica mucho se quedaba con todo. Ahora cada vuelta (cada 45 min) elige **3 notas repartidas entre fuentes**: primero la fuente que **menos ha publicado en las últimas 24 h** (a igualdad, la que tiene la nota más reciente), una nota por fuente; si sobran plazas, se completan con las más recientes. Las fuentes oficiales tienen ventana de 7 días.

## Consecuencia: mucho menos volumen
Las fuentes públicas publican **del orden de 2–4 notas al día en total** (frente a las ~96 al día con 3 notas cada 45 min cuando Investing.com alimentaba el flujo). El flujo lo tolera: con menos candidatas por vuelta, publica las que haya. Si se quiere más volumen sin riesgo legal, las vías son una licencia con un proveedor (p. ej. pedirla a Investing.com) o cambiar el método (titular y enlace con atribución más análisis propio con nuestros datos de mercado).

## Añadir una fuente (lista de comprobación)
1. Leer sus **términos de uso**, `robots.txt` y el aviso de copyright del feed. Buscar: reproducción/republicación, obras derivadas y traducción, raspado y acceso automatizado, IA/minería de datos, uso comercial.
2. Si exige permiso escrito, pedirlo **antes** y guardar la respuesta.
3. Comprobar que cada publicación tiene **una URL propia** (la deduplicación se basa en ella).
4. Añadir el nodo `RSS …` (entrada nueva del Merge), la etiqueta por dominio en `Normalizar Item`, la fuente en `Priorizar y limitar`, su nombre en el filtro de 7 días (si es oficial) y su `id` en los tres mapas `fuente -> id` (`Parsear JSON`, `Reservar URL`, `Guardar duplicado`) más una fila en `fuentes` (migración).
5. Actualizar este documento y `n8n/fuentes.test.ts`.

## Pendiente de decisión
- **Artículos ya publicados** desde Investing.com y Cointelegraph (más de 500 en total): siguen en el sitio. Decidir si se retiran, se conservan o se pide licencia.
- **Pedir licencia a Investing.com** si se quiere volver a usarla.
