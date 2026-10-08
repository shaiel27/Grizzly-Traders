export interface GlossaryTerm {
  slug: string
  term: string
  termEn: string
  definition: string
  definitionEn: string
}

export const GLOSSARY: GlossaryTerm[] = [
  {
    slug: 'soporte',
    term: 'Soporte',
    termEn: 'Support',
    definition:
      'Nivel de precio donde la demanda suele ser lo bastante fuerte para frenar una caída. Cuando el precio lo rompe a la baja, puede convertirse en resistencia.',
    definitionEn:
      "Price level where demand is usually strong enough to halt a decline. Once the price breaks below it, it can turn into resistance.",
  },
  {
    slug: 'resistencia',
    term: 'Resistencia',
    termEn: 'Resistance',
    definition:
      'Nivel de precio donde la oferta suele frenar una subida. Si el precio lo supera con volumen, a menudo pasa a actuar como soporte.',
    definitionEn:
      "Price level where supply usually stalls an advance. If the price breaks above it with volume, it often starts acting as support.",
  },
  {
    slug: 'punto-pivote',
    term: 'Punto pivote',
    termEn: 'Pivot Point',
    definition:
      'Nivel de referencia calculado con el máximo, el mínimo y el cierre de la sesión anterior. A partir de él se derivan soportes (S1, S2, S3) y resistencias (R1, R2, R3) para la sesión siguiente.',
    definitionEn:
      "Reference level calculated from the previous session's high, low and close. Support levels (S1, S2, S3) and resistance levels (R1, R2, R3) for the next session are derived from it.",
  },
  {
    slug: 'pivotes-clasicos',
    term: 'Pivotes clásicos',
    termEn: 'Classic Pivots',
    definition:
      'El método más extendido: P = (máximo + mínimo + cierre) / 3, con S1 = 2P − máximo y R1 = 2P − mínimo. Los demás niveles se calculan a partir del rango de la sesión.',
    definitionEn:
      "The most widely used method: P = (high + low + close) / 3, with S1 = 2P − high and R1 = 2P − low. The remaining levels are calculated from the session's range.",
  },
  {
    slug: 'pivotes-fibonacci',
    term: 'Pivotes de Fibonacci',
    termEn: 'Fibonacci Pivots',
    definition:
      'Usan el mismo pivote central que el método clásico, pero sitúan los soportes y resistencias a distancias del pivote equivalentes a ratios de Fibonacci (38,2 %, 61,8 % y 100 %) del rango de la sesión.',
    definitionEn:
      "Use the same central pivot as the classic method, but place supports and resistances at distances from the pivot equal to Fibonacci ratios (38.2%, 61.8% and 100%) of the session's range.",
  },
  {
    slug: 'pivotes-camarilla',
    term: 'Pivotes Camarilla',
    termEn: 'Camarilla Pivots',
    definition:
      'Se calculan alrededor del cierre anterior con el rango multiplicado por 1,1 y divididos en fracciones (S1/R1 usan /12). Son niveles muy cercanos al precio, pensados para operar dentro del día.',
    definitionEn:
      "Calculated around the previous close, with the range multiplied by 1.1 and divided into fractions (S1/R1 use /12). These levels sit very close to price and are designed for intraday trading.",
  },
  {
    slug: 'pivotes-woodie',
    term: 'Pivotes Woodie',
    termEn: 'Woodie Pivots',
    definition: 'Variante que da más peso al cierre: P = (máximo + mínimo + 2 × cierre) / 4.',
    definitionEn: 'A variant that gives more weight to the close: P = (high + low + 2 × close) / 4.',
  },
  {
    slug: 'pivotes-demark',
    term: 'Pivotes DeMark',
    termEn: 'DeMark Pivots',
    definition:
      'Su cálculo depende de la relación entre apertura y cierre de la sesión anterior: se usa una fórmula distinta según el cierre sea menor, mayor o igual que la apertura.',
    definitionEn:
      "The calculation depends on the relationship between the previous session's open and close: a different formula is used depending on whether the close is lower, higher or equal to the open.",
  },
  {
    slug: 'rsi',
    term: 'RSI (Índice de Fuerza Relativa)',
    termEn: 'RSI (Relative Strength Index)',
    definition:
      'Oscilador entre 0 y 100 que compara las subidas y bajadas recientes (normalmente 14 períodos). Por encima de 70 se interpreta como sobrecompra y por debajo de 30 como sobreventa, aunque en tendencias fuertes puede mantenerse en esas zonas mucho tiempo.',
    definitionEn:
      'Oscillator between 0 and 100 that compares recent gains and losses (typically over 14 periods). Above 70 is read as overbought and below 30 as oversold, although it can stay in those zones for a long time during strong trends.',
  },
  {
    slug: 'macd',
    term: 'MACD',
    termEn: 'MACD',
    definition:
      'Indicador de tendencia que resta dos medias móviles exponenciales (12 y 26 períodos) y la compara con su propia media de 9 períodos (línea de señal). Los cruces sugieren cambios de momentum.',
    definitionEn:
      'Trend indicator that subtracts two exponential moving averages (12 and 26 periods) and compares the result against its own 9-period average (the signal line). Crossovers suggest shifts in momentum.',
  },
  {
    slug: 'media-movil',
    term: 'Media móvil (SMA y EMA)',
    termEn: 'Moving Average (SMA and EMA)',
    definition:
      'Promedio del precio en los últimos N períodos que suaviza el ruido. La simple (SMA) pesa todos los datos igual; la exponencial (EMA) da más peso a los más recientes y reacciona antes.',
    definitionEn:
      'Average of the price over the last N periods that smooths out noise. The simple moving average (SMA) weighs all data equally; the exponential moving average (EMA) weighs recent data more heavily and reacts faster.',
  },
  {
    slug: 'adx',
    term: 'ADX',
    termEn: 'ADX',
    definition:
      'Mide la fuerza de una tendencia, no su dirección. Valores por encima de 25 suelen indicar tendencia definida; por debajo de 20, mercado lateral.',
    definitionEn:
      'Measures the strength of a trend, not its direction. Values above 25 usually indicate a defined trend; below 20, a sideways market.',
  },
  {
    slug: 'atr',
    term: 'ATR (Rango Verdadero Medio)',
    termEn: 'ATR (Average True Range)',
    definition:
      'Promedio del rango de movimiento de un activo en un período. Se usa para medir la volatilidad y para colocar stops a una distancia razonable.',
    definitionEn:
      "Average of an asset's trading range over a period. Used to measure volatility and to place stops at a reasonable distance.",
  },
  {
    slug: 'volatilidad',
    term: 'Volatilidad',
    termEn: 'Volatility',
    definition: 'Medida de cuánto y con qué rapidez cambia el precio de un activo. Más volatilidad implica más oportunidad, pero también más riesgo.',
    definitionEn:
      "Measure of how much and how quickly an asset's price changes. Higher volatility means more opportunity, but also more risk.",
  },
  {
    slug: 'volumen',
    term: 'Volumen',
    termEn: 'Volume',
    definition: 'Cantidad de unidades negociadas en un período. Un movimiento con mucho volumen suele considerarse más fiable que uno con poco.',
    definitionEn:
      'Number of units traded over a period. A move backed by high volume is usually considered more reliable than one with low volume.',
  },
  {
    slug: 'capitalizacion',
    term: 'Capitalización de mercado',
    termEn: 'Market Capitalization',
    definition: 'Valor total de un activo: precio por número de unidades en circulación. Se usa para comparar el tamaño de empresas y criptomonedas.',
    definitionEn:
      "An asset's total value: price multiplied by the number of units in circulation. Used to compare the size of companies and cryptocurrencies.",
  },
  {
    slug: 'stop-loss',
    term: 'Stop loss',
    termEn: 'Stop Loss',
    definition: 'Orden que cierra una posición automáticamente al alcanzar un precio de pérdida máxima aceptada.',
    definitionEn: 'Order that automatically closes a position once it reaches a maximum acceptable loss price.',
  },
  {
    slug: 'take-profit',
    term: 'Take profit',
    termEn: 'Take Profit',
    definition: 'Orden que cierra una posición automáticamente al alcanzar un objetivo de beneficio.',
    definitionEn: 'Order that automatically closes a position once it reaches a profit target.',
  },
  {
    slug: 'ratio-riesgo-beneficio',
    term: 'Ratio riesgo/beneficio',
    termEn: 'Risk/Reward Ratio',
    definition:
      'Relación entre lo que se arriesga y lo que se espera ganar en una operación. Con un ratio de 1:3 se gana el triple de lo que se arriesga si se cumple el objetivo.',
    definitionEn:
      'Relationship between what is risked and what is expected to be gained on a trade. With a 1:3 ratio, you gain three times what you risk if the target is hit.',
  },
  {
    slug: 'alcista-bajista',
    term: 'Sentimiento alcista y bajista',
    termEn: 'Bullish and Bearish Sentiment',
    definition:
      'Alcista (bullish) indica expectativa de subida; bajista (bearish), expectativa de caída. En este sitio, cada artículo indica el sentimiento que el análisis atribuye al activo.',
    definitionEn:
      'Bullish indicates an expectation of a price rise; bearish, an expectation of a decline. On this site, each article notes the sentiment the analysis assigns to the asset.',
  },
  {
    slug: 'miedo-codicia',
    term: 'Índice de miedo y codicia',
    termEn: 'Fear and Greed Index',
    definition:
      'Indicador de 0 a 100 que resume el estado de ánimo del mercado cripto: valores bajos indican miedo extremo y valores altos, codicia extrema. Es un dato de contexto, no una señal de compra o venta.',
    definitionEn:
      "Indicator from 0 to 100 that sums up the crypto market's mood: low values indicate extreme fear and high values, extreme greed. It's contextual data, not a buy or sell signal.",
  },
]
