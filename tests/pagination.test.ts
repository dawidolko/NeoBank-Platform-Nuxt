/**
 * A page beyond the end used to return an empty list *and* `pages: 0`, which
 * hides the pagination control — stranding anyone who followed a stale deep
 * link with no way back except editing the URL.
 */
import { describe, expect, it } from 'vitest'
import { paginate } from '../server/utils/pagination'

describe('paginate', () => {
  it('computes the ordinary case', () => {
    expect(paginate(45, 2, 20)).toEqual({ page: 2, perPage: 20, total: 45, pages: 3, skip: 20 })
  })

  it('clamps a page beyond the end back onto the last page', () => {
    const result = paginate(45, 9, 20)

    expect(result.page).toBe(3)
    expect(result.skip).toBe(40)
    // The control must stay visible so the user can navigate back.
    expect(result.pages).toBe(3)
  })

  it('clamps a zero or negative page to the first page', () => {
    expect(paginate(45, 0, 20).page).toBe(1)
    expect(paginate(45, -5, 20).page).toBe(1)
    expect(paginate(45, -5, 20).skip).toBe(0)
  })

  it('reports no pages for an empty result set but still resolves page 1', () => {
    const result = paginate(0, 3, 20)

    expect(result.pages).toBe(0)
    expect(result.page).toBe(1)
    expect(result.skip).toBe(0)
  })

  it('handles a partial final page', () => {
    expect(paginate(41, 3, 20)).toMatchObject({ page: 3, pages: 3, skip: 40 })
  })

  it('never produces a negative skip', () => {
    for (const page of [-100, 0, 1]) {
      expect(paginate(10, page, 20).skip).toBeGreaterThanOrEqual(0)
    }
  })
})
