import { publicidadActiva } from '@/lib/analytics'

// Interruptor de la publicidad (Adsterra). Se fija al compilar (NEXT_PUBLIC_*): activarlo o apagarlo exige recompilar y reiniciar.
// Apagado (por defecto), el sitio no carga ni pide nada de publicidad y los textos legales dicen que no usamos cookies de publicidad.
// Ver docs/publicidad.md.
export const PUBLICIDAD_ACTIVA = publicidadActiva(process.env.NEXT_PUBLIC_ADS_ACTIVO)
