# Fuentes del pipeline de noticias

Desde nov-2026 el pipeline lee **seis fuentes oficiales** (dominio público o reutilización libre con atribución) **e Investing.com**, y reparte las notas entre todas. Investing.com se mantiene por **decisión informada del usuario** pese al riesgo descrito abajo.

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
| **Investing.com** ⚠️ | `investing.com/rss/news.rss` | **No lo permiten** (ver abajo). | Atribución estructurada y enlace al original; redacción propia con titular distinto. No cumple lo que exigen sus términos. |

Cada nota enlaza al original y muestra «Fuente oficial: …» (campo `posts.source_id`; ids de las fuentes nuevas en la migración `0011`).

## ⚠️ Investing.com: riesgo aceptado
Sus términos (última modificación: agosto 2026) dicen:
- **§10(c):** prohíben «employing any automated system or software to extract data or content» y «scraping, data mining, robot or spider programs».
- **§10(a):** prohíben usar la plataforma «for any commercial or business purposes».
- **§10(b):** prohíben «copy, modify, or otherwise make unauthorized use» del contenido.
- Piden consentimiento escrito de Fusion Media (`tools@investing.com`, `Legal@investing.com`).

El RSS no se menciona, pero el pipeline **raspa el artículo completo con Firecrawl**, lo reescribe con GPT y lo traduce con fines comerciales. **Se mantiene por decisión del usuario** (nov-2026), que conoce este riesgo. Mitigaciones en marcha: el reparto entre fuentes limita su peso a 1 de cada 3 notas mientras haya oficiales con algo que publicar, y la nota siempre es una redacción propia con atribución y enlace. **Mitigación recomendada**: pedir licencia o consentimiento escrito a Fusion Media.

## Fuentes revisadas y descartadas

| Fuente | Por qué no |
|---|---|
| **Cointelegraph** | Prohíbe «automated scraping, or creation of independent content pipelines» y usar el contenido en sistemas de IA sin autorización escrita. Contacto legal: `Legal@cointelegraph.com`. |
| **FXStreet** | Su contrato de distribución exige «must not edit, alter or otherwise change» el contenido, requiere autorización para traducir y prohíbe el uso en IA. |
| **CoinDesk** | Términos vigentes desde el 30-oct-2026: prohíben «use, copy, reproduce, republish, … or modify the Content» y los robots o scrapers sin permiso escrito. |
| **CNBC (NBCUniversal)** | Licencia solo para uso personal; sin permiso para reproducir. |
| **OilPrice** | Su política (`/llms.txt`) permite «short excerpts for summaries»; la reproducción completa requiere permiso. No se encontraron sus términos completos: no se usa. |
| **Seeking Alpha** | Su página de términos no se pudo leer (404): sin verificar. |
| **Census, BLS** | Públicas, pero sus feeds enlazan a páginas fijas (no una URL por publicación) y el descarte de lo ya tratado se basa en la URL: se trataría una sola vez. Posible ampliación con otro método de deduplicación. |

Además, CoinDesk, OilPrice y CNBC bloquean en su `robots.txt` a los rastreadores de IA conocidos (10–13 agentes cada una): señal de que no quieren que su contenido pase por modelos como el que usamos para reescribir.

## Cómo funciona la selección (cambio de nov-2026)
Antes se tomaban las 3 notas más recientes por fecha: Investing.com, que publica ~10 por hora, se quedaba con casi todo (295 de 296 notas en 24 h; las oficiales casi no entraban). Ahora cada vuelta (cada 45 min) elige **3 notas repartidas entre fuentes**: primero la fuente que **menos ha publicado en las últimas 24 h** (a igualdad, la que tiene la nota más reciente), una nota por fuente; si sobran plazas, se completan con las más recientes. Las fuentes oficiales tienen ventana de 7 días; Investing.com, de 24 h.

**Efecto esperado:** mientras haya notas oficiales pendientes, entran hasta 2 de ellas por vuelta junto a 1 de Investing.com; cuando las oficiales no tienen nada (lo habitual: publican del orden de 2–4 notas al día en total), Investing.com llena las plazas y el volumen total no baja.

## Añadir una fuente (lista de comprobación)
1. Leer sus **términos de uso**, `robots.txt` y el aviso de copyright del feed. Buscar: reproducción/republicación, obras derivadas y traducción, raspado y acceso automatizado, IA/minería de datos, uso comercial.
2. Si exige permiso escrito, pedirlo **antes** y guardar la respuesta.
3. Comprobar que cada publicación tiene **una URL propia** (la deduplicación se basa en ella).
4. Añadir el nodo `RSS …` (entrada nueva del Merge), la etiqueta por dominio en `Normalizar Item`, la fuente en `Priorizar y limitar`, su nombre en el filtro de 7 días (si es oficial) y su `id` en los tres mapas `fuente -> id` (`Parsear JSON`, `Reservar URL`, `Guardar duplicado`) más una fila en `fuentes` (migración).
5. Actualizar este documento y `n8n/fuentes.test.ts`.

## Pendiente
- **Pedir licencia o consentimiento a Fusion Media (Investing.com)** para dejar de depender de un riesgo aceptado.
- **Artículos ya publicados de Cointelegraph** (6, de octubre): siguen en el sitio; decidir si se retiran.
- Validar este análisis con un abogado de propiedad intelectual.
