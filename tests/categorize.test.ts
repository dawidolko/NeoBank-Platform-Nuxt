import { describe, expect, it } from 'vitest'
import { CATEGORY_META, categorize } from '../server/utils/categorize'

describe('categorize', () => {
  it('recognises common Polish and international merchants', () => {
    const cases: Array<[string, string]> = [
      ['Biedronka', 'GROCERIES'],
      ['Żabka', 'GROCERIES'],
      ['Lidl', 'GROCERIES'],
      ['Uber', 'TRANSPORT'],
      ['PKP Intercity', 'TRANSPORT'],
      ['Orlen', 'TRANSPORT'],
      ['Netflix', 'ENTERTAINMENT'],
      ['Spotify', 'ENTERTAINMENT'],
      ['Allegro', 'SHOPPING'],
      ['Media Expert', 'SHOPPING'],
      ['Monthly rent', 'BILLS'],
      ['Booking.com', 'TRAVEL'],
      ['Ryanair', 'TRAVEL'],
      ['Apteka Gemini', 'HEALTH'],
    ]

    for (const [title, expected] of cases) {
      expect(categorize(title, 'EXTERNAL'), title).toBe(expected)
    }
  })

  it('matches regardless of case', () => {
    expect(categorize('NETFLIX SUBSCRIPTION', 'EXTERNAL')).toBe('ENTERTAINMENT')
    expect(categorize('biedronka 4021', 'EXTERNAL')).toBe('GROCERIES')
  })

  it('treats every internal transfer as a transfer, never as spending', () => {
    // Otherwise moving money to your own savings would show up as an expense.
    expect(categorize('Monthly savings', 'INTERNAL')).toBe('TRANSFER')
    expect(categorize('Biedronka', 'INTERNAL')).toBe('TRANSFER')
  })

  it('defaults incoming money to income', () => {
    expect(categorize('Salary — Softmind', 'DEPOSIT')).toBe('INCOME')
    expect(categorize('Some unknown payer', 'DEPOSIT')).toBe('INCOME')
  })

  it('falls back to OTHER rather than guessing an outbound merchant', () => {
    expect(categorize('Zzzz unknown merchant', 'EXTERNAL')).toBe('OTHER')
    expect(categorize('', 'EXTERNAL')).toBe('OTHER')
  })

  it('has display metadata for every category it can return', () => {
    const produced = new Set(
      [
        categorize('Biedronka', 'EXTERNAL'),
        categorize('Uber', 'EXTERNAL'),
        categorize('Netflix', 'EXTERNAL'),
        categorize('Allegro', 'EXTERNAL'),
        categorize('Monthly rent', 'EXTERNAL'),
        categorize('Apteka', 'EXTERNAL'),
        categorize('Ryanair', 'EXTERNAL'),
        categorize('Salary', 'DEPOSIT'),
        categorize('x', 'INTERNAL'),
        categorize('zzz', 'EXTERNAL'),
      ],
    )

    for (const category of produced) {
      expect(CATEGORY_META[category], category).toBeDefined()
      expect(CATEGORY_META[category].label.length).toBeGreaterThan(0)
    }
  })
})
