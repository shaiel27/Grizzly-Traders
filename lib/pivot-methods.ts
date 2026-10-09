import type { PivotMethod } from './pivots'

export interface PivotMethodInfo {
  label: string
  labelEn: string
  short: string
  shortEn: string
  icon: string
  description: string
  descriptionEn: string
  formula: string
  levels: string
}

export const PIVOT_METHOD_INFO: Record<PivotMethod, PivotMethodInfo> = {
  classic: {
    label: 'Clásico',
    labelEn: 'Classic',
    short: 'Clásico',
    shortEn: 'Classic',
    icon: 'function',
    description: 'El más usado. El pivote es el promedio del máximo, mínimo y cierre; soportes y resistencias salen de su distancia al rango.',
    descriptionEn: "The most widely used. The pivot is the average of the high, low and close; supports and resistances come from their distance to the range.",
    formula: 'PP = (H + L + C) / 3 · R1 = 2·PP − L · S1 = 2·PP − H',
    levels: 'R1–R3, PP, S1–S3',
  },
  fibonacci: {
    label: 'Fibonacci',
    labelEn: 'Fibonacci',
    short: 'Fibonacci',
    shortEn: 'Fibonacci',
    icon: 'auto_awesome',
    description: 'Parte del pivote clásico y suma o resta proporciones de Fibonacci del rango. Útil para buscar retrocesos.',
    descriptionEn: 'Builds on the classic pivot and adds or subtracts Fibonacci ratios of the range. Useful for spotting retracements.',
    formula: 'R/S = PP ± (H − L) × 0.382 · 0.618 · 1.0',
    levels: 'R1–R3, PP, S1–S3',
  },
  camarilla: {
    label: 'Camarilla',
    labelEn: 'Camarilla',
    short: 'Camarilla',
    shortEn: 'Camarilla',
    icon: 'speed',
    description: 'Niveles muy cercanos al cierre, pensados para operar rebotes y rupturas dentro del día. R4/S4 marcan una ruptura fuerte.',
    descriptionEn: "Levels very close to the close, designed for trading intraday bounces and breakouts. R4/S4 mark a strong breakout.",
    formula: 'R/S = C ± 1.1 × (H − L) / 12 · 6 · 4 · 2',
    levels: 'R1–R4, PP, S1–S4',
  },
  woodie: {
    label: 'Woodie',
    labelEn: 'Woodie',
    short: 'Woodie',
    shortEn: 'Woodie',
    icon: 'balance',
    description: 'Da doble peso al cierre, así que el pivote reacciona más al último movimiento. Popular entre day traders.',
    descriptionEn: "Gives the close double weight, so the pivot reacts more to the latest move. Popular among day traders.",
    formula: 'PP = (H + L + 2C) / 4 · R1 = 2·PP − L · S1 = 2·PP − H',
    levels: 'R1–R3, PP, S1–S3',
  },
  demark: {
    label: 'DeMark',
    labelEn: 'DeMark',
    short: 'DeMark',
    shortEn: 'DeMark',
    icon: 'calculate',
    description: 'Ajusta la fórmula según cómo cerró la sesión frente a su apertura. Solo define un soporte y una resistencia.',
    descriptionEn: "Adjusts the formula based on how the session closed relative to its open. Defines only one support and one resistance.",
    formula: 'X = H+2L+C (C<O) · 2H+L+C (C>O) · H+L+2C (C=O) · PP = X/4',
    levels: 'R1, PP, S1',
  },
}
