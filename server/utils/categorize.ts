import type { Category, TransferType } from '@prisma/client'

/**
 * Assigns a spending category from the transfer title.
 *
 * Deliberately keyword-based rather than ML: the rules are auditable, run
 * inside the write transaction with no network call, and a customer can see
 * exactly why something landed where it did. Unknown merchants fall to OTHER
 * rather than being guessed at.
 */
const RULES: Array<{ category: Category; patterns: RegExp }> = [
  {
    category: 'GROCERIES',
    patterns: /biedronka|lidl|żabka|zabka|carrefour|auchan|kaufland|tesco|aldi|grocer|spożyw/i,
  },
  {
    category: 'TRANSPORT',
    patterns: /uber|bolt|taxi|orlen|shell|bp |circle k|pkp|intercity|mpk|ztm|parking|fuel|petrol/i,
  },
  {
    category: 'ENTERTAINMENT',
    patterns: /netflix|spotify|disney|hbo|cinema|kino|steam|playstation|xbox|concert|ticket|empik/i,
  },
  {
    category: 'SHOPPING',
    patterns: /allegro|amazon|zalando|ikea|media expert|rtv|decathlon|rossmann|h&m|zara|shop/i,
  },
  {
    category: 'BILLS',
    patterns: /rent|czynsz|energa|tauron|pge|orange|play|t-mobile|plus|internet|invoice|subscription|insurance/i,
  },
  { category: 'HEALTH', patterns: /pharmacy|apteka|medicover|luxmed|dentist|clinic|hospital|gym|fitness/i },
  { category: 'TRAVEL', patterns: /booking|airbnb|ryanair|lufthansa|lot |wizz|hotel|hostel|flight|travel/i },
  { category: 'INCOME', patterns: /salary|wynagrodzenie|payroll|refund|interest|bonus|invoice #|freelance/i },
]

export function categorize(title: string, type: TransferType): Category {
  // Money arriving from outside is income unless a rule says otherwise.
  if (type === 'DEPOSIT') {
    const matched = RULES.find((rule) => rule.patterns.test(title))

    return matched && matched.category !== 'INCOME' ? matched.category : 'INCOME'
  }

  if (type === 'INTERNAL') return 'TRANSFER'

  return RULES.find((rule) => rule.patterns.test(title))?.category ?? 'OTHER'
}

/** Display metadata, kept next to the rules so a new category cannot miss it. */
export const CATEGORY_META: Record<Category, { label: string; icon: string; hue: string }> = {
  GROCERIES: { label: 'Groceries', icon: 'shopping-cart', hue: '142 62% 42%' },
  TRANSPORT: { label: 'Transport', icon: 'car', hue: '31 92% 52%' },
  ENTERTAINMENT: { label: 'Entertainment', icon: 'play', hue: '291 62% 56%' },
  SHOPPING: { label: 'Shopping', icon: 'shopping-bag', hue: '199 89% 48%' },
  BILLS: { label: 'Bills', icon: 'receipt', hue: '221 83% 60%' },
  HEALTH: { label: 'Health', icon: 'heart', hue: '349 78% 56%' },
  TRAVEL: { label: 'Travel', icon: 'plane', hue: '172 66% 42%' },
  INCOME: { label: 'Income', icon: 'trending-up', hue: '142 71% 40%' },
  TRANSFER: { label: 'Transfers', icon: 'arrow-left-right', hue: '215 20% 55%' },
  OTHER: { label: 'Other', icon: 'circle', hue: '240 8% 58%' },
}
