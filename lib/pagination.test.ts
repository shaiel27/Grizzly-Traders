import { describe, expect, it } from 'vitest'
import { pageCount, pageSlice, pageWindow } from './pagination'

describe('pageCount', () => {
  it('rounds up and never drops below one page', () => {
    expect(pageCount(64, 5)).toBe(13)
    expect(pageCount(60, 5)).toBe(12)
    expect(pageCount(3, 5)).toBe(1)
    expect(pageCount(0, 5)).toBe(1)
  })
})

describe('pageSlice', () => {
  const items = Array.from({ length: 12 }, (_, index) => index)

  it('returns the requested page', () => {
    expect(pageSlice(items, 0, 5)).toEqual([0, 1, 2, 3, 4])
    expect(pageSlice(items, 2, 5)).toEqual([10, 11])
  })

  it('falls back to the last page when the index is out of range', () => {
    expect(pageSlice(items, 9, 5)).toEqual([10, 11])
    expect(pageSlice(items, -3, 5)).toEqual([0, 1, 2, 3, 4])
  })

  it('handles an empty list', () => {
    expect(pageSlice([], 0, 5)).toEqual([])
  })
})

describe('pageWindow', () => {
  it('shows every page when there are few', () => {
    expect(pageWindow(0, 4)).toEqual([0, 1, 2, 3])
    expect(pageWindow(2, 1)).toEqual([0])
  })

  it('collapses the middle with ellipses around the current page', () => {
    expect(pageWindow(6, 13)).toEqual([0, 'ellipsis', 5, 6, 7, 'ellipsis', 12])
  })

  it('keeps the start together near the first pages', () => {
    expect(pageWindow(0, 13)).toEqual([0, 1, 'ellipsis', 12])
    expect(pageWindow(2, 13)).toEqual([0, 1, 2, 3, 'ellipsis', 12])
  })

  it('keeps the end together near the last pages', () => {
    expect(pageWindow(12, 13)).toEqual([0, 'ellipsis', 11, 12])
    expect(pageWindow(10, 13)).toEqual([0, 'ellipsis', 9, 10, 11, 12])
  })

  it('shows a lone skipped page instead of an ellipsis', () => {
    expect(pageWindow(3, 6)).toEqual([0, 1, 2, 3, 4, 5])
  })
})
