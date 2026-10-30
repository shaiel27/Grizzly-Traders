// Separacion de anuncios y datos de mercado (PLAN-CUMPLIMIENTO.md §13.8): las paginas donde pueden
// salir anuncios (AdSense, aun no integrado) no muestran cotizaciones, y las paginas con cotizaciones
// no llevan anuncios. Esta es la UNICA lista de rutas con anuncios; todo lo demas (/, /markets,
// /pivot-points, /calendario, /herramientas, /buscar, /articulos (indice), /legal/*, /login, /cms)
// queda sin anuncios. Puro, sin React, para que el Header y el futuro componente de anuncios
// decidan con la misma funcion.

// Rutas con anuncios: la ruta y todo lo que cuelga de ella (`soloHijos`: sin la ruta en si).
const RUTAS_CON_ANUNCIOS: { ruta: string; soloHijos?: boolean }[] = [
  // /articulos/[slug]: el articulo, no el indice /articulos
  { ruta: '/articulos', soloHijos: true },
  // /autor y /autor/[slug]
  { ruta: '/autor' },
  { ruta: '/aprende' },
]

function normalizar(pathname: string): string {
  const limpio = pathname.split(/[?#]/)[0] || '/'
  return limpio.length > 1 ? limpio.replace(/\/+$/, '') || '/' : limpio
}

export function permiteAnuncios(pathname: string): boolean {
  const ruta = normalizar(pathname)
  return RUTAS_CON_ANUNCIOS.some((zona) => {
    if (ruta.startsWith(`${zona.ruta}/`)) return true
    return !zona.soloHijos && ruta === zona.ruta
  })
}
