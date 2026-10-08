'use client'

import { useId, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { calculatePosition } from '@/lib/risk'
import { useDictionary } from '@/lib/i18n/LocaleProvider'
import type { Dictionary } from '@/lib/i18n/get-dictionary'

const FIELDS = [
  { key: 'capital', placeholder: '10000', step: '1' },
  { key: 'riskPercent', placeholder: '1', step: '0.1' },
  { key: 'entry', placeholder: '100', step: 'any' },
  { key: 'stopLoss', placeholder: '95', step: 'any' },
  { key: 'takeProfit', placeholder: '115', step: 'any' },
] as const

type FieldKey = (typeof FIELDS)[number]['key']

const FIELD_LABEL_KEY: Record<FieldKey, keyof Dictionary['riskCalculator']> = {
  capital: 'fieldCapital',
  riskPercent: 'fieldRiskPercent',
  entry: 'fieldEntry',
  stopLoss: 'fieldStopLoss',
  takeProfit: 'fieldTakeProfit',
}

const number = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 4 })
const money = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 })

export function RiskCalculator() {
  const dict = useDictionary()
  const baseId = useId()
  const [values, setValues] = useState<Record<FieldKey, string>>({
    capital: '',
    riskPercent: '1',
    entry: '',
    stopLoss: '',
    takeProfit: '',
  })

  const parsed = useMemo(() => {
    const read = (key: FieldKey) => (values[key].trim() === '' ? undefined : Number(values[key].replace(',', '.')))
    return {
      capital: read('capital'),
      riskPercent: read('riskPercent'),
      entry: read('entry'),
      stopLoss: read('stopLoss'),
      takeProfit: read('takeProfit'),
    }
  }, [values])

  const complete = [parsed.capital, parsed.riskPercent, parsed.entry, parsed.stopLoss].every((value) => value !== undefined)
  const result = useMemo(
    () =>
      complete
        ? calculatePosition({
            capital: parsed.capital as number,
            riskPercent: parsed.riskPercent as number,
            entry: parsed.entry as number,
            stopLoss: parsed.stopLoss as number,
            takeProfit: parsed.takeProfit,
          })
        : null,
    [complete, parsed]
  )

  const rows = result
    ? [
        { label: dict.riskCalculator.direction, value: result.direction === 'long' ? dict.riskCalculator.directionLong : dict.riskCalculator.directionShort },
        { label: dict.riskCalculator.riskAmount, value: money.format(result.riskAmount) },
        { label: dict.riskCalculator.units, value: number.format(result.units), strong: true },
        { label: dict.riskCalculator.positionValue, value: money.format(result.positionValue) },
        { label: dict.riskCalculator.leverageNeeded, value: `${number.format(result.leverageNeeded)}x` },
        ...(result.rewardAmount !== null
          ? [
              { label: dict.riskCalculator.rewardAmount, value: money.format(result.rewardAmount) },
              { label: dict.riskCalculator.riskReward, value: `1 : ${number.format(result.riskReward ?? 0)}`, strong: true },
            ]
          : []),
      ]
    : []

  return (
    <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 md:p-8" aria-labelledby={`${baseId}-title`}>
      <h2 id={`${baseId}-title`} className="mb-1 text-subhead font-bold text-ink">
        {dict.riskCalculator.title}
      </h2>
      <p className="mb-6 text-body-sm text-ink-muted">
        {dict.riskCalculator.description}
      </p>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <div key={field.key}>
              <label htmlFor={`${baseId}-${field.key}`} className="mb-1.5 block text-micro font-medium text-ink-muted">
                {dict.riskCalculator[FIELD_LABEL_KEY[field.key]]}
              </label>
              <input
                id={`${baseId}-${field.key}`}
                type="number"
                inputMode="decimal"
                min="0"
                step={field.step}
                value={values[field.key]}
                onChange={(event) => setValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
                placeholder={field.placeholder}
                className="w-full rounded-lg border border-outline-variant/70 bg-surface-2 px-3 py-2.5 font-mono text-sm text-ink placeholder:text-ink-muted transition-colors focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue/30"
              />
            </div>
          ))}
        </div>

        <div aria-live="polite">
          {result ? (
            <dl className="divide-y divide-hairline-soft rounded-xl border border-hairline-soft bg-surface-1/60">
              {rows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-3">
                  <dt className="text-body-sm text-ink-muted">{row.label}</dt>
                  <dd className={clsx('font-mono tabular-nums', row.strong ? 'text-body font-bold text-accent-blue' : 'text-body-sm text-ink')}>
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="rounded-xl border border-dashed border-outline-variant/40 px-4 py-10 text-center text-body-sm text-ink-muted">
              {complete ? dict.riskCalculator.invalidResult : dict.riskCalculator.incompleteResult}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
