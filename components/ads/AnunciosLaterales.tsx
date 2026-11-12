import { AdSlot } from '@/components/ads/AdSlot'

// Dos columnas de publicidad (una a cada lado) para páginas de herramienta. Se colocan FUERA del contenido, pegadas a su borde, y siguen
// al lector al bajar. Solo se muestran si la pantalla es lo bastante ancha para que quepan sin tocar el contenido; en pantallas menores
// el elemento está oculto (display:none), el anuncio nunca se acerca a la pantalla y no se carga ni se pide nada.
// El padre debe ser `relative` y ocupar el alto del contenido. Cada columna es un espacio de Adsterra distinto (no se repite el mismo código en una página).
// Ver docs/publicidad.md.
const COLUMNA = 'pointer-events-auto sticky top-[calc(var(--header-height)+16px)]'

export function AnunciosLaterales({ pantalla }: { pantalla: 'articulo' | 'estrecho' | 'ancho' }) {
  // Clases literales (Tailwind solo genera las que ve escritas). `articulo`: contenido de 896 px; `estrecho`: 900 px; `ancho`: 1400 px.
  const visible = { articulo: 'hidden min-[1300px]:block', estrecho: 'hidden min-[1340px]:block', ancho: 'hidden min-[1780px]:block' }[pantalla]
  return (
    <>
      <div className={`pointer-events-none absolute inset-y-0 right-full mr-4 w-[164px] ${visible}`}>
        <div className={COLUMNA}>
          <AdSlot nombre="lateral-izq" className="w-[164px]" />
        </div>
      </div>
      <div className={`pointer-events-none absolute inset-y-0 left-full ml-4 w-[164px] ${visible}`}>
        <div className={COLUMNA}>
          <AdSlot nombre="lateral-der" className="w-[164px]" />
        </div>
      </div>
    </>
  )
}
