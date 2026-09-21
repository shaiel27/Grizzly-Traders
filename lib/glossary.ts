export interface GlossaryTerm {
  slug: string
  term: string
  definition: string
}

export const GLOSSARY: GlossaryTerm[] = [
  {
    slug: 'soporte',
    term: 'Soporte',
    definition:
      'Nivel de precio donde la demanda suele ser lo bastante fuerte para frenar una caída. Cuando el precio lo rompe a la baja, puede convertirse en resistencia.',
  },
  {
    slug: 'resistencia',
    term: 'Resistencia',
    definition:
      'Nivel de precio donde la oferta suele frenar una subida. Si el precio lo supera con volumen, a menudo pasa a actuar como soporte.',
  },
  {
    slug: 'punto-pivote',
    term: 'Punto pivote',
    definition:
      'Nivel de referencia calculado con el máximo, el mínimo y el cierre de la sesión anterior. A partir de él se derivan soportes (S1, S2, S3) y resistencias (R1, R2, R3) para la sesión siguiente.',
  },
  {
    slug: 'pivotes-clasicos',
    term: 'Pivotes clásicos',
    definition:
      'El método más extendido: P = (máximo + mínimo + cierre) / 3, con S1 = 2P − máximo y R1 = 2P − mínimo. Los demás niveles se calculan a partir del rango de la sesión.',
  },
  {
    slug: 'pivotes-fibonacci',
    term: 'Pivotes de Fibonacci',
    definition:
      'Usan el mismo pivote central que el método clásico, pero sitúan los soportes y resistencias a distancias del pivote equivalentes a ratios de Fibonacci (38,2 %, 61,8 % y 100 %) del rango de la sesión.',
  },
  {
    slug: 'pivotes-camarilla',
    term: 'Pivotes Camarilla',
    definition:
      'Se calculan alrededor del cierre anterior con el rango multiplicado por 1,1 y divididos en fracciones (S1/R1 usan /12). Son niveles muy cercanos al precio, pensados para operar dentro del día.',
  },
  {
    slug: 'pivotes-woodie',
    term: 'Pivotes Woodie',
    definition: 'Variante que da más peso al cierre: P = (máximo + mínimo + 2 × cierre) / 4.',
  },
  {
    slug: 'pivotes-demark',
    term: 'Pivotes DeMark',
    definition:
      'Su cálculo depende de la relación entre apertura y cierre de la sesión anterior: se usa una fórmula distinta según el cierre sea menor, mayor o igual que la apertura.',
  },
  {
    slug: 'rsi',
    term: 'RSI (Índice de Fuerza Relativa)',
    definition:
      'Oscilador entre 0 y 100 que compara las subidas y bajadas recientes (normalmente 14 períodos). Por encima de 70 se interpreta como sobrecompra y por debajo de 30 como sobreventa, aunque en tendencias fuertes puede mantenerse en esas zonas mucho tiempo.',
  },
  {
    slug: 'macd',
    term: 'MACD',
    definition:
      'Indicador de tendencia que resta dos medias móviles exponenciales (12 y 26 períodos) y la compara con su propia media de 9 períodos (línea de señal). Los cruces sugieren cambios de momentum.',
  },
  {
    slug: 'media-movil',
    term: 'Media móvil (SMA y EMA)',
    definition:
      'Promedio del precio en los últimos N períodos que suaviza el ruido. La simple (SMA) pesa todos los datos igual; la exponencial (EMA) da más peso a los más recientes y reacciona antes.',
  },
  {
    slug: 'adx',
    term: 'ADX',
    definition:
      'Mide la fuerza de una tendencia, no su dirección. Valores por encima de 25 suelen indicar tendencia definida; por debajo de 20, mercado lateral.',
  },
  {
    slug: 'atr',
    term: 'ATR (Rango Verdadero Medio)',
    definition:
      'Promedio del rango de movimiento de un activo en un período. Se usa para medir la volatilidad y para colocar stops a una distancia razonable.',
  },
  {
    slug: 'volatilidad',
    term: 'Volatilidad',
    definition: 'Medida de cuánto y con qué rapidez cambia el precio de un activo. Más volatilidad implica más oportunidad, pero también más riesgo.',
  },
  {
    slug: 'volumen',
    term: 'Volumen',
    definition: 'Cantidad de unidades negociadas en un período. Un movimiento con mucho volumen suele considerarse más fiable que uno con poco.',
  },
  {
    slug: 'capitalizacion',
    term: 'Capitalización de mercado',
    definition: 'Valor total de un activo: precio por número de unidades en circulación. Se usa para comparar el tamaño de empresas y criptomonedas.',
  },
  {
    slug: 'stop-loss',
    term: 'Stop loss',
    definition: 'Orden que cierra una posición automáticamente al alcanzar un precio de pérdida máxima aceptada.',
  },
  {
    slug: 'take-profit',
    term: 'Take profit',
    definition: 'Orden que cierra una posición automáticamente al alcanzar un objetivo de beneficio.',
  },
  {
    slug: 'ratio-riesgo-beneficio',
    term: 'Ratio riesgo/beneficio',
    definition:
      'Relación entre lo que se arriesga y lo que se espera ganar en una operación. Con un ratio de 1:3 se gana el triple de lo que se arriesga si se cumple el objetivo.',
  },
  {
    slug: 'alcista-bajista',
    term: 'Sentimiento alcista y bajista',
    definition:
      'Alcista (bullish) indica expectativa de subida; bajista (bearish), expectativa de caída. En este sitio, cada artículo indica el sentimiento que el análisis atribuye al activo.',
  },
  {
    slug: 'miedo-codicia',
    term: 'Índice de miedo y codicia',
    definition:
      'Indicador de 0 a 100 que resume el estado de ánimo del mercado cripto: valores bajos indican miedo extremo y valores altos, codicia extrema. Es un dato de contexto, no una señal de compra o venta.',
  },
]
