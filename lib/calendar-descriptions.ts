// Descripciones propias de los eventos del calendario económico, por FAMILIA de indicador.
//
// El feed de ForexFactory no trae descripciones y las de su web, de Investing.com o de FXStreet son
// contenido protegido, así que están escritas aquí, con palabras propias (PLAN-CALENDARIO.md). Un
// mismo título se repite entre países ("CPI y/y" existe para USD, EUR, GBP...), por eso la
// descripción es genérica del indicador y la fuente oficial solo se enlaza para la moneda a la que
// aplica (`fuentes`). Los términos de BLS y BEA permiten reutilizar su contenido (dominio público,
// se pide citar la fuente; consultados el 2026-10-22), pero no se copia texto: solo se enlaza.
//
export interface FuenteOficial {
  nombre: string
  url: string
}

export interface FamiliaEvento {
  id: string
  test: RegExp
  es: { que: string; porque: string }
  en: { que: string; porque: string }
  // Fuente oficial por moneda (solo donde existe y es de uso libre o de consulta pública)
  fuentes?: Partial<Record<string, FuenteOficial>>
  // Con qué frecuencia se publica el dato (texto corto, ES y EN)
  frecuencia?: { es: string; en: string }
}

const BLS = (url: string): FuenteOficial => ({ nombre: 'U.S. Bureau of Labor Statistics', url })
const BEA = (url: string): FuenteOficial => ({ nombre: 'U.S. Bureau of Economic Analysis', url })
const CENSUS = (url: string): FuenteOficial => ({ nombre: 'U.S. Census Bureau', url })
const EIA = (url: string): FuenteOficial => ({ nombre: 'U.S. Energy Information Administration', url })
const FED = (url: string): FuenteOficial => ({ nombre: 'Federal Reserve', url })

// El orden importa: gana la primera familia cuyo `test` coincide
export const FAMILIAS: readonly FamiliaEvento[] = [
  {
    id: 'ippi-rmpi',
    test: /\b(IPPI|RMPI)\b/,
    es: { que: 'Precios de los productos industriales que salen de las fábricas y de las materias primas que compran (Canadá).', porque: 'Miden precios antes de que lleguen al consumidor.' },
    en: { que: 'Prices of goods leaving factories and of the raw materials they buy (Canada).', porque: 'They measure prices before they reach consumers.' },
  },
  {
    id: 'ppi',
    test: /\bPPI\b/,
    es: { que: 'Variación de los precios que reciben los productores por sus bienes y servicios; "Input" mide los costos que pagan y "Output" lo que cobran.', porque: 'Mide la inflación en la etapa de productores, antes de que llegue al consumidor.' },
    en: { que: 'Change in the prices producers receive for their goods and services; "Input" measures the costs they pay and "Output" what they charge.', porque: 'It measures inflation at the producer stage, before it reaches consumers.' },
    fuentes: { USD: BLS('https://www.bls.gov/ppi/') },
  },
  {
    id: 'rpi',
    test: /\bRPI\b/,
    es: { que: 'Índice de precios minoristas del Reino Unido: una medida de inflación que, a diferencia del IPC, incluye costos de vivienda como hipotecas.', porque: 'Se usa para ajustar contratos, rentas y bonos indexados; complementa al IPC.' },
    en: { que: 'UK Retail Prices Index: an inflation measure that, unlike CPI, includes housing costs such as mortgage interest.', porque: 'It is used to index contracts, rents and index-linked bonds; it complements CPI.' },
  },
  {
    id: 'cpi',
    test: /\bCPI\b/,
    es: { que: 'Índice de precios al consumidor: cuánto cambió el costo de una canasta de bienes y servicios; "Core" excluye alimentos y energía, que son volátiles.', porque: 'Es la medida de inflación más seguida y una referencia para las decisiones de tasas del banco central.' },
    en: { que: 'Consumer price index: how much the cost of a basket of goods and services changed; "Core" excludes food and energy, which are volatile.', porque: 'It is the most-watched inflation gauge and a reference for central bank rate decisions.' },
    fuentes: { USD: BLS('https://www.bls.gov/cpi/') },
  },
  {
    id: 'pce',
    test: /\bPCE\b/,
    es: { que: 'Índice de precios del gasto de consumo personal, la medida de inflación preferida por la Reserva Federal.', porque: 'Es la referencia de inflación que usa la Fed en su objetivo de precios.' },
    en: { que: 'Personal consumption expenditures price index, the Federal Reserve\'s preferred inflation measure.', porque: 'It is the inflation reference the Fed uses for its price-stability target.' },
    fuentes: { USD: BEA('https://www.bea.gov/data/personal-consumption-expenditures-price-index') },
  },
  {
    id: 'nfp',
    test: /Non-Farm Employment Change/,
    es: { que: 'Empleos creados en el mes fuera del sector agrícola en EE. UU.', porque: 'Mide la variación del empleo no agrícola y es uno de los principales indicadores del mercado laboral de EE. UU.' },
    en: { que: 'Jobs added in the month outside the US farm sector.', porque: 'It is one of the main indicators of the US labour market.' },
    fuentes: { USD: BLS('https://www.bls.gov/ces/') },
  },
  {
    id: 'adp',
    test: /\bADP\b/,
    es: { que: 'Estimación privada del empleo en el sector privado de EE. UU., calculada con las nóminas de ADP.', porque: 'Se publica antes que el dato oficial de empleo; las dos cifras pueden diferir.' },
    en: { que: 'Private estimate of US private-sector employment, built from ADP payroll records.', porque: 'It comes out before the official jobs report; the two figures can differ.' },
  },
  {
    id: 'unemployment-rate',
    test: /Unemployment Rate/,
    es: { que: 'Porcentaje de la población activa que busca empleo y no lo encuentra.', porque: 'Es un indicador central del mercado laboral que los bancos centrales siguen de cerca.' },
    en: { que: 'Share of the labour force that is looking for work and cannot find it.', porque: 'It is a core labour market indicator that central banks follow closely.' },
    fuentes: { USD: BLS('https://www.bls.gov/cps/') },
  },
  {
    id: 'claims',
    test: /Unemployment Claims|Claimant Count/,
    es: { que: 'Número de personas que solicitan por primera vez el subsidio de desempleo en la semana (o en el mes, en el Reino Unido).', porque: 'Es un indicador semanal del mercado laboral.' },
    en: { que: 'Number of people filing for unemployment benefits for the first time in the week (or month, in the UK).', porque: 'It is a weekly labour market indicator.' },
    fuentes: { USD: { nombre: 'U.S. Department of Labor', url: 'https://www.dol.gov/ui/data.pdf' } },
  },
  {
    id: 'employment-change',
    test: /Employment Change/,
    es: { que: 'Variación neta del número de personas empleadas respecto del periodo anterior.', porque: 'Muestra la variación neta del empleo en el periodo.' },
    en: { que: 'Net change in the number of people employed versus the previous period.', porque: 'It shows the net change in employment over the period.' },
  },
  {
    id: 'earnings',
    test: /Average (Hourly )?Earnings|Earnings Index/,
    es: { que: 'Crecimiento de los salarios promedio.', porque: 'Es un indicador de presión salarial que los bancos centrales siguen de cerca.' },
    en: { que: 'Growth in average wages.', porque: 'It is a wage pressure indicator that central banks follow closely.' },
  },
  {
    id: 'gdp',
    test: /\bGDP\b/,
    es: { que: 'Producto interno bruto: el valor de todo lo que produce la economía; q/q compara con el trimestre anterior y y/y con el mismo periodo del año pasado.', porque: 'Es la medida más amplia de la producción de la economía.' },
    en: { que: 'Gross domestic product: the value of everything the economy produces; q/q compares with the previous quarter and y/y with the same period a year earlier.', porque: 'It is the broadest measure of economic output.' },
    fuentes: { USD: BEA('https://www.bea.gov/data/gdp/gross-domestic-product') },
  },
  {
    id: 'retail-sales',
    test: /Retail Sales/,
    es: { que: 'Ventas de los comercios minoristas; "Core" excluye vehículos y otros componentes volátiles.', porque: 'Mide el gasto de los consumidores en comercios minoristas.' },
    en: { que: 'Sales at retail businesses; "Core" excludes vehicles and other volatile components.', porque: 'It measures consumer spending at retail stores.' },
    fuentes: { USD: CENSUS('https://www.census.gov/retail/index.html') },
  },
  {
    id: 'industrial-production',
    test: /Industrial Production|Tertiary Industry/,
    es: { que: 'Producción de fábricas, minas y servicios públicos (o del sector servicios, en el caso de la actividad terciaria).', porque: 'Mide la producción real de la industria y los servicios públicos.' },
    en: { que: 'Output of factories, mines and utilities (or of the services sector, for tertiary industry activity).', porque: 'It measures real industrial output.' },
    fuentes: { USD: FED('https://www.federalreserve.gov/releases/g17/current/default.htm') },
  },
  {
    id: 'fixed-asset',
    test: /Fixed Asset Investment/,
    es: { que: 'Inversión acumulada del año en infraestructura, inmuebles y maquinaria (China).', porque: 'Mide el volumen de inversión fija en China.' },
    en: { que: 'Year-to-date investment in infrastructure, property and equipment (China).', porque: 'It measures the volume of fixed investment in China.' },
  },
  {
    id: 'trade',
    test: /Trade Balance|Current Account/,
    es: { que: 'Diferencia entre lo que un país exporta y lo que importa (la cuenta corriente suma además rentas y transferencias).', porque: 'Un superávit significa que el país vende más al exterior de lo que compra.' },
    en: { que: 'The gap between what a country exports and imports (the current account also includes income and transfers).', porque: 'A surplus means the country sells more abroad than it buys.' },
    fuentes: { USD: BEA('https://www.bea.gov/data/intl-trade-investment/international-trade-goods-and-services') },
  },
  {
    id: 'pmi',
    test: /PMI|\bISM\b/,
    es: { que: 'Encuesta a gerentes de compras de manufactura o servicios; "Flash" es la estimación preliminar. Por encima de 50 indica expansión y por debajo, contracción.', porque: 'Es de los primeros datos del mes sobre la actividad económica.' },
    en: { que: 'Survey of purchasing managers in manufacturing or services; "Flash" is the preliminary estimate. Above 50 signals expansion and below 50 contraction.', porque: 'It is among the first readings each month on economic activity.' },
  },
  {
    id: 'zew',
    test: /ZEW/,
    es: { que: 'Encuesta a analistas financieros sobre sus expectativas económicas a seis meses (Alemania y eurozona).', porque: 'Refleja las expectativas de analistas financieros sobre Alemania y la eurozona.' },
    en: { que: 'Survey of financial analysts on their six-month economic expectations (Germany and the eurozone).', porque: 'It reflects financial analysts\' expectations for Germany and the eurozone.' },
  },
  {
    id: 'inflation-expectations',
    test: /Inflation Expectations/,
    es: { que: 'Cuánta inflación esperan los consumidores en el futuro, según la encuesta de la Universidad de Michigan.', porque: 'Es un indicador que los bancos centrales siguen de cerca.' },
    en: { que: 'How much inflation consumers expect ahead, from the University of Michigan survey.', porque: 'It is an indicator central banks follow closely.' },
  },
  {
    id: 'consumer-confidence',
    test: /Consumer Confidence|Consumer Sentiment|GfK/,
    es: { que: 'Encuesta sobre qué tan optimistas se sienten los hogares con su situación y con la economía.', porque: 'Es una lectura mensual del ánimo de los hogares.' },
    en: { que: 'Survey of how optimistic households feel about their finances and the economy.', porque: 'It is a monthly read of household mood.' },
  },
  {
    id: 'business-surveys',
    test: /Business Climate|Business Outlook|Industrial Order|NAHB|Housing Market Index|BusinessNZ/,
    es: { que: 'Encuesta de ánimo y expectativas de empresas del sector (comercio, construcción o industria).', porque: 'Resume las respuestas de las empresas del sector en la encuesta.' },
    en: { que: 'Survey of business mood and expectations in the sector (trade, construction or industry).', porque: 'It summarizes the survey responses of firms in the sector.' },
  },
  {
    id: 'leading-index',
    test: /Leading Index/,
    es: { que: 'Índice compuesto que resume en un solo valor varios indicadores económicos.', porque:'Resume varios indicadores en un solo valor.' },
    en: { que: 'Composite index that combines several economic indicators into one value.', porque:'It combines several indicators into one value.' },
  },
  {
    id: 'housing-starts',
    test: /Building Permits|Housing Starts/,
    es: { que: 'Permisos de construcción otorgados y viviendas cuya obra comenzó en el mes.', porque: 'Mide la actividad de construcción de viviendas.' },
    en: { que: 'Building permits issued and homes on which construction began in the month.', porque: 'It measures home construction activity.' },
    fuentes: { USD: CENSUS('https://www.census.gov/construction/nrc/index.html') },
  },
  {
    id: 'home-sales',
    test: /Home Sales/,
    es: { que: 'Contratos o ventas de viviendas existentes o nuevas en el mes.', porque: 'Mide la actividad de compraventa de viviendas.' },
    en: { que: 'Contracts or sales of existing or new homes in the month.', porque: 'It measures housing sales activity.' },
  },
  {
    id: 'house-prices',
    test: /\bHPI\b|NHPI|House Prices|New Home Prices/,
    es: { que: 'Variación de los precios de las viviendas.', porque: 'Es un componente de referencia del mercado inmobiliario.' },
    en: { que: 'Change in home prices.', porque: 'It is a reference measure of the housing market.' },
  },
  {
    id: 'interest-rate',
    test: /Interest Rate|Cash Rate|Bank Rate|Loan Prime Rate|Overnight Rate|Federal Funds|Official Cash Rate/,
    es: { que: 'Decisión del banco central sobre su tasa de interés de referencia.', porque: 'Define el costo del dinero en la economía. El comunicado y la conferencia explican sus motivos.' },
    en: { que: 'The central bank\'s decision on its benchmark interest rate.', porque: 'It sets the cost of money in the economy. The statement and press conference explain the reasons.' },
    fuentes: { USD: FED('https://www.federalreserve.gov/monetarypolicy/fomc.htm') },
  },
  {
    id: 'policy-communication',
    test: /Minutes|Monetary Policy (Statement|Report|Discussions)|Summary of Monetary Policy|Press Conference/,
    es: { que: 'Comunicación del banco central: actas, informes o conferencias que explican sus decisiones.', porque: 'Explica los motivos y las previsiones del banco central.' },
    en: { que: 'Central bank communication: minutes, reports or press conferences explaining its decisions.', porque: 'It explains the central bank\'s reasoning and outlook.' },
    fuentes: { USD: FED('https://www.federalreserve.gov/monetarypolicy/fomc.htm') },
  },
  {
    id: 'speech',
    test: /\bSpeaks\b/,
    es: { que: 'Intervención pública de un funcionario de un banco central.', porque: 'Expresa la postura de un funcionario sobre la economía o la política monetaria.' },
    en: { que: 'Public remarks by a central bank official.', porque: 'It states an official\'s view on the economy or monetary policy.' },
  },
  {
    id: 'crude-inventories',
    test: /Crude Oil Inventories|API Weekly/,
    es: { que: 'Variación semanal de las reservas comerciales de petróleo crudo de EE. UU.; la API publica una estimación privada un día antes del dato oficial.', porque: 'Mide el cambio en las reservas de crudo frente a la semana anterior.' },
    en: { que: 'Weekly change in US commercial crude oil stocks; the API publishes a private estimate a day before the official figure.', porque: 'It measures the change in crude stocks versus the prior week.' },
    fuentes: { USD: EIA('https://www.eia.gov/petroleum/supply/weekly/') },
  },
  {
    id: 'gas-storage',
    test: /Natural Gas Storage/,
    es: { que: 'Variación semanal del gas natural almacenado en EE. UU.', porque: 'Mide el nivel de gas natural almacenado en EE. UU.' },
    en: { que: 'Weekly change in US natural gas in storage.', porque: 'It measures US natural gas held in storage.' },
    fuentes: { USD: EIA('https://www.eia.gov/naturalgas/weekly/') },
  },
  {
    id: 'bond-auction',
    test: /Bond Auction/,
    es: { que: 'Subasta en la que el gobierno vende deuda; importa cuánta demanda hay y qué rendimiento se acepta.', porque: 'Muestra la demanda y el rendimiento de la deuda que se vende.' },
    en: { que: 'Auction in which the government sells debt; what matters is how much demand there is and the yield accepted.', porque: 'It shows demand and the yield on the debt sold.' },
  },
  {
    id: 'borrowing',
    test: /Net Borrowing/,
    es: { que: 'Cuánto necesita endeudarse el sector público en el mes (déficit).', porque: 'Mide el déficit del sector público en el periodo.' },
    en: { que: 'How much the public sector had to borrow in the month (deficit).', porque: 'It measures the public sector deficit for the period.' },
  },
  {
    id: 'consumer-spending',
    test: /Credit Card Spending/,
    es: { que: 'Gasto con tarjeta de crédito, un indicador rápido del consumo.', porque: 'Mide el gasto con tarjetas de crédito.' },
    en: { que: 'Credit card spending, a fast indicator of consumption.', porque: 'It measures spending on credit cards.' },
  },
  {
    id: 'gdt',
    test: /GDT Price Index/,
    es: { que: 'Resultado de la subasta de productos lácteos Global Dairy Trade.', porque: 'Es una referencia de precios de lácteos en el mercado internacional.' },
    en: { que: 'Result of the Global Dairy Trade dairy auction.', porque: 'It is a reference for international dairy prices.' },
  },
  {
    id: 'bundesbank',
    test: /Buba Monthly Report/,
    es: { que: 'Informe mensual del banco central alemán (Bundesbank) sobre la economía.', porque: 'Resume la situación económica y financiera de Alemania.' },
    en: { que: 'Monthly report from Germany\'s central bank (Bundesbank) on the economy.', porque: 'It summarizes economic and financial conditions in Germany.' },
  },
  {
    id: 'fdi',
    test: /Foreign Direct Investment/,
    es: { que: 'Inversión extranjera directa acumulada del año.', porque: 'Muestra el interés de los inversores extranjeros en la economía.' },
    en: { que: 'Year-to-date foreign direct investment.', porque: 'It shows foreign investors\' interest in the economy.' },
  },
]

// Descripción del evento por su título; null si no hay una familia que lo cubra
export function descripcionDe(title: string): FamiliaEvento | null {
  return FAMILIAS.find((familia) => familia.test.test(title)) ?? null
}
