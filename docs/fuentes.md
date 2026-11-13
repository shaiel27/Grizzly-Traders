# Fuentes del pipeline de noticias

Desde nov-2026 el pipeline lee **fuentes oficiales** (dominio público o reutilización libre con atribución), los **filings 8-K de EDGAR**, **Investing.com**, **CNBC**, **PR Newswire** y, con un interruptor, los comunicados de **GlobeNewswire vía Massive**, y reparte las notas entre todas. Investing.com, Massive, CNBC y PR Newswire se mantienen por **decisión informada del usuario** pese a los riesgos descritos abajo (CNBC y PR Newswire, desde el 12-nov-2026).

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
| **CFTC (declaraciones)** | `cftc.gov/RSS/RSSST/rssst.xml` | Igual que la CFTC. | Igual que la CFTC (comparte la fuente `CFTC`). |
| **OCC** | `occ.gov/rss/occ_news.xml` | Agencia federal de EE. UU.: obra del gobierno, dominio público. | Atribución. |
| **FDIC** | `fdic.gov/rss.xml` | Agencia federal de EE. UU.: obra del gobierno, dominio público. | Atribución. Publica poco (7,9 días desde la última nota al revisarlo). |
| **Filings 8-K de EDGAR** | `sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K…&output=atom` | La SEC dice que su información «may be copied or further distributed … without the SEC's permission». | **Identificarse en cada petición** (User-Agent con nombre y correo; `SEC_USER_AGENT`, por defecto el contacto del sitio), máx. 10 peticiones/s, y **sin Firecrawl** (la SEC no admite bots sin clasificar). No usar «SEC» ni «EDGAR» en nombres comerciales ni dominios. |
| **GlobeNewswire vía Massive** ⚠️ | `api.massive.com/v2/reference/news` | Comunicados de las propias empresas; los términos de reutilización de GlobeNewswire no se pudieron verificar. | Solo con `MASSIVE_NEWS_ACTIVO=true`. Ver abajo. |
| **Investing.com** ⚠️ | `investing.com/rss/news.rss` | **No lo permiten** (ver abajo). | Atribución estructurada y enlace al original; redacción propia con titular distinto. No cumple lo que exigen sus términos. |

Cada nota enlaza al original y muestra «Fuente oficial: …» (campo `posts.source_id`; ids de las fuentes nuevas en la migración `0011`).

## ⚠️ Investing.com: riesgo aceptado
Sus términos (última modificación: agosto 2026) dicen:
- **§10(c):** prohíben «employing any automated system or software to extract data or content» y «scraping, data mining, robot or spider programs».
- **§10(a):** prohíben usar la plataforma «for any commercial or business purposes».
- **§10(b):** prohíben «copy, modify, or otherwise make unauthorized use» del contenido.
- Piden consentimiento escrito de Fusion Media (`tools@investing.com`, `Legal@investing.com`).

El RSS no se menciona, pero el pipeline **raspa el artículo completo con Firecrawl**, lo reescribe con GPT y lo traduce con fines comerciales. **Se mantiene por decisión del usuario** (nov-2026), que conoce este riesgo. Mitigaciones en marcha: el reparto entre fuentes limita su peso a 1 de cada 3 notas mientras haya oficiales con algo que publicar, y la nota siempre es una redacción propia con atribución y enlace. **Mitigación recomendada**: pedir licencia o consentimiento escrito a Fusion Media.

## Filings de EDGAR: qué se publica y cómo
- **Qué entra:** los 8-K con apartados que son noticia: 1.01 (acuerdo material), 1.02, 1.03 (quiebra), 2.01 (adquisición o venta), 2.02 (**resultados**), 2.05, 2.06, 3.01 (exclusión de bolsa), 4.02, 5.02 (cambios de directivos) y 8.01 (otros eventos). Quedan fuera las enmiendas (8-K/A) y los filings que solo traen anexos (9.01).
- **Volumen:** el feed devuelve los 100 filings más recientes (en una prueba, 83 con apartados relevantes). En temporada de resultados salen decenas por hora; fuera de ella, bastantes menos.
- **Texto:** se descarga la página índice del filing con nuestro User-Agent y se elige el comunicado de prensa (**EX-99.1**) o, si no hay, el documento principal; se limpia a texto plano y entra al mismo análisis que el resto.
- **Riesgo residual (bajo):** el texto de los exhibits lo escriben las empresas. Resumir hechos es lo habitual en la prensa financiera, pero es el punto que conviene validar con un abogado.

## Massive (noticias) ⚠️: riesgo aceptado y cómo activarlo
- **Qué es:** Massive (antes Polygon.io) devuelve noticias con título, resumen (~230–670 caracteres), enlace al original, editor y tickers. La key probada daba acceso a noticias, y a acciones, forex y cripto al cierre del día anterior; no a tiempo real ni a índices.
- **Términos:** todos los planes de autoservicio son de **uso personal** («Individual use only»); la licencia es «display only», no transferible, y la redistribución exige un producto de empresa. **Usar esta key en un sitio comercial no cumple esos términos**; se acepta por decisión del usuario, «por ahora».
- **Qué se usa:** solo los comunicados de **GlobeNewswire** (publicados por las propias empresas) y solo el **resumen que entrega la API**, sin raspar la página de origen. Los medios que Massive también agrega (**The Motley Fool**, **Zacks**) quedan fuera: serían el mismo problema que Investing.com.
- **Apagado por defecto.** Para activarlo en el VPS: crear la credencial *Header Auth* **«Massive API»** (id `massiveCred0001`; nombre `Authorization`, valor `Bearer <KEY>`) en n8n, poner `MASSIVE_NEWS_ACTIVO=true` en `/srv/grizzly/n8n/.env` y `docker compose up -d`. La key **nunca** va al repositorio. Para apagarlo: `MASSIVE_NEWS_ACTIVO=false`.
- **Mitigación recomendada:** pedir a Massive el plan **Business** con licencia de redistribución para un sitio de noticias.

## Fuentes revisadas y descartadas

| Fuente | Por qué no |
|---|---|
| **Cointelegraph** | Prohíbe «automated scraping, or creation of independent content pipelines» y usar el contenido en sistemas de IA sin autorización escrita. Contacto legal: `Legal@cointelegraph.com`. |
| **FXStreet** | Su contrato de distribución exige «must not edit, alter or otherwise change» el contenido, requiere autorización para traducir y prohíbe el uso en IA. |
| **CoinDesk** | Términos vigentes desde el 30-oct-2026: prohíben «use, copy, reproduce, republish, … or modify the Content» y los robots o scrapers sin permiso escrito. |
| **CNBC (NBCUniversal)** ⚠️ | Licencia solo para uso personal; sin permiso para reproducir. **Añadida el 12-nov-2026 por decisión informada del usuario** (ver «CNBC y PR Newswire: riesgo aceptado»). |
| **OilPrice** | Su política (`/llms.txt`) permite «short excerpts for summaries»; la reproducción completa requiere permiso. No se encontraron sus términos completos: no se usa. |
| **Seeking Alpha** | Su página de términos no se pudo leer (404): sin verificar. |
| **Finnhub** | Sus planes son «strictly for personal use» y prohíben redistribuir «derived results». |
| **Banco Mundial** | Prohíbe «any derivative work or commercial use». |
| **Banco de Inglaterra** | El contenido general necesita autorización; solo su base de datos y SONIA van con licencia abierta (OGL). |
| **Business Wire / PR Newswire** | Sus feeds llevan copyright propio (p. ej. «Copyright 2026, Business Wire»); sin verificar su reutilización. **PR Newswire se añadió el 12-nov-2026 por decisión informada del usuario**; Business Wire sigue fuera. |
| **Alpha Vantage, Financial Modeling Prep, Marketaux** | No se pudieron leer sus términos: sin verificar (los planes gratuitos suelen ser de uso personal). |
| **Census, BLS** | Públicas, pero sus feeds enlazan a páginas fijas (no una URL por publicación) y el descarte de lo ya tratado se basa en la URL: se trataría una sola vez. Posible ampliación con otro método de deduplicación. |

Además, CoinDesk, OilPrice y CNBC bloquean en su `robots.txt` a los rastreadores de IA conocidos (10–13 agentes cada una): señal de que no quieren que su contenido pase por modelos como el que usamos para reescribir.

## ⚠️ CNBC y PR Newswire: riesgo aceptado (12-nov-2026)
Se añadieron para sustituir el volumen que dejó de entrar cuando Investing.com empezó a devolver 403 al lector de páginas (Firecrawl) a media tarde del 12-nov: desde entonces todas sus notas se descartaban por «contenido fuente insuficiente». Investing.com **no se quitó**.
- **CNBC** (`search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839069`): términos de licencia solo para uso personal y `robots.txt` que bloquea a los rastreadores de IA. Es el mismo riesgo que Investing.com. Se usa con atribución estructurada (`source_id` 19), enlace al original y redacción propia.
- **PR Newswire** (feed de servicios financieros): comunicados que las propias empresas distribuyen, pero el feed lleva copyright propio y su reutilización no está verificada. `source_id` 20.
- Ambas compiten por plaza como cualquier otra: la que menos ha publicado en 24 h va primero. Para quitarlas, borrar sus dos nodos RSS (`RSS CNBC`, `RSS PR Newswire`), bajar el Merge a 12 entradas y retirar sus dominios de `Normalizar Item` y `Priorizar y limitar`.
- La migración `0016_fuentes_cnbc_prnewswire.sql` crea sus filas en `fuentes` y debe aplicarse **antes** de importar el flujo.

## Cómo funciona la selección (cambio de nov-2026)
Antes se tomaban las 3 notas más recientes por fecha: Investing.com, que publica ~10 por hora, se quedaba con casi todo (295 de 296 notas en 24 h; las oficiales casi no entraban). Ahora cada vuelta (cada 45 min) elige **3 notas repartidas entre fuentes**: primero la fuente que **menos ha publicado en las últimas 24 h** (a igualdad, la que tiene la nota más reciente), una nota por fuente; si sobran plazas, se completan con las más recientes. Las fuentes oficiales tienen ventana de 7 días; Investing.com, de 24 h.

**Efecto esperado:** cada vuelta toma una nota de la fuente que menos ha publicado. Con EDGAR (decenas de filings relevantes cuando hay resultados) y las fuentes oficiales, las plazas se reparten entre varias fuentes en lugar de ser casi todas de Investing.com, y cuando las oficiales y EDGAR no tienen nada, Investing.com llena las plazas: el volumen total no baja.

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
