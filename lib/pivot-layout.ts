// Vertical positions (px, top to bottom) for labels that must not overlap: each label keeps at least
// `minGap` from its neighbour and stays inside [min, max]. Input must be sorted ascending.
export function spreadLabels(positions: number[], minGap: number, min: number, max: number): number[] {
  const out = positions.map((position) => Math.min(max, Math.max(min, position)))

  for (let i = 1; i < out.length; i++) {
    if (out[i] - out[i - 1] < minGap) out[i] = out[i - 1] + minGap
  }

  // The push-down pass can run past the bottom edge: pull the block back up
  if (out.length && out[out.length - 1] > max) {
    out[out.length - 1] = max
    for (let i = out.length - 2; i >= 0; i--) {
      if (out[i + 1] - out[i] < minGap) out[i] = out[i + 1] - minGap
    }
  }

  return out
}

export interface ScaleDomain {
  min: number
  max: number
}

// Price range shown by the ladder: every level plus the price, with breathing room on both ends
export function ladderDomain(values: number[], padding = 0.08): ScaleDomain {
  const finite = values.filter((value) => Number.isFinite(value))
  if (finite.length === 0) return { min: 0, max: 1 }
  const low = Math.min(...finite)
  const high = Math.max(...finite)
  const pad = (high - low) * padding || Math.abs(high) * 0.01 || 1
  return { min: low - pad, max: high + pad }
}
