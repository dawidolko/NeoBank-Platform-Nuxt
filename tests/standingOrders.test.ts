import { describe, expect, it } from 'vitest'
import { nextDueDate } from '../server/services/standingOrders'

const at = (iso: string) => new Date(`${iso}T09:00:00.000Z`)
const day = (date: Date) => date.toISOString().slice(0, 10)

describe('nextDueDate', () => {
  it('advances a weekly order by exactly seven days', () => {
    expect(day(nextDueDate(at('2026-08-12'), 'WEEKLY'))).toBe('2026-08-19')
  })

  it('advances a monthly order to the same day next month', () => {
    expect(day(nextDueDate(at('2026-08-12'), 'MONTHLY'))).toBe('2026-09-12')
  })

  it('clamps to the last day of a shorter month instead of overflowing', () => {
    // Naive month arithmetic turns 31 Jan into 3 Mar; a rent payment must not
    // skip February entirely.
    expect(day(nextDueDate(at('2026-01-31'), 'MONTHLY'))).toBe('2026-02-28')
    expect(day(nextDueDate(at('2026-03-31'), 'MONTHLY'))).toBe('2026-04-30')
  })

  it('handles a leap February', () => {
    expect(day(nextDueDate(at('2028-01-31'), 'MONTHLY'))).toBe('2028-02-29')
  })

  it('rolls across a year boundary', () => {
    expect(day(nextDueDate(at('2026-12-15'), 'MONTHLY'))).toBe('2027-01-15')
    expect(day(nextDueDate(at('2026-12-29'), 'WEEKLY'))).toBe('2027-01-05')
  })

  it('anchors to the due date, so a late run does not drift later', () => {
    // Chaining from the *due* date keeps the 10th on the 10th forever.
    let due = at('2026-01-10')

    for (let i = 0; i < 12; i += 1) due = nextDueDate(due, 'MONTHLY')

    expect(day(due)).toBe('2027-01-10')
  })

  it('always moves strictly forward', () => {
    for (const start of ['2026-01-01', '2026-02-28', '2026-06-30', '2026-12-31']) {
      for (const interval of ['WEEKLY', 'MONTHLY'] as const) {
        expect(nextDueDate(at(start), interval).getTime(), `${start}/${interval}`).toBeGreaterThan(
          at(start).getTime(),
        )
      }
    }
  })
})
