import type { PivotMethod } from './pivots'

export interface PivotMethodInfo {
  label: string
  short: string
  icon: string
  description: string
  formula: string
  levels: string
}

export const PIVOT_METHOD_INFO: Record<PivotMethod, PivotMethodInfo> = {
  classic: {
    label: 'Clásico',
    short: 'Clásico',
    icon: 'function',
    description: 'El más usado. El pivote es el promedio del máximo, mínimo y cierre; soportes y resistencias salen de su distancia al rango.',
    formula: 'PP = (H + L + C) / 3 · R1 = 2·PP − L · S1 = 2·PP − H',
    levels: 'R1–R3, PP, S1–S3',
  },
  fibonacci: {
    label: 'Fibonacci',
    short: 'Fibonacci',
    icon: 'auto_awesome',
    description: 'Parte del pivote clásico y suma o resta proporciones de Fibonacci del rango. Útil para buscar retrocesos.',
    formula: 'R/S = PP ± (H − L) × 0.382 · 0.618 · 1.0',
    levels: 'R1–R3, PP, S1–S3',
  },
  camarilla: {
    label: 'Camarilla',
    short: 'Camarilla',
    icon: 'speed',
    description: 'Niveles muy cercanos al cierre, pensados para operar rebotes y rupturas dentro del día. R4/S4 marcan una ruptura fuerte.',
    formula: 'R/S = C ± 1.1 × (H − L) / 12 · 6 · 4 · 2',
    levels: 'R1–R4, PP, S1–S4',
  },
  woodie: {
    label: 'Woodie',
    short: 'Woodie',
    icon: 'balance',
    description: 'Da doble peso al cierre, así que el pivote reacciona más al último movimiento. Popular entre day traders.',
    formula: 'PP = (H + L + 2C) / 4 · R1 = 2·PP − L · S1 = 2·PP − H',
    levels: 'R1–R3, PP, S1–S3',
  },
  demark: {
    label: 'DeMark',
    short: 'DeMark',
    icon: 'calculate',
    description: 'Ajusta la fórmula según cómo cerró la sesión frente a su apertura. Solo define un soporte y una resistencia.',
    formula: 'X = H+2L+C (C<O) · 2H+L+C (C>O) · H+L+2C (C=O) · PP = X/4',
    levels: 'R1, PP, S1',
  },
}
