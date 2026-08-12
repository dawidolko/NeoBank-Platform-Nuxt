import { runDueStandingOrders } from '../services/standingOrders'

/**
 * Nitro scheduled task: pay every standing order that has fallen due.
 *
 * Runs in-process on a single instance. Behind several replicas this would
 * need a lock so two workers cannot pay the same order twice — the ledger
 * would stay balanced either way, but the customer would be charged twice.
 */
export default defineTask({
  meta: {
    name: 'standing-orders:run',
    description: 'Execute standing orders that have fallen due',
  },
  async run() {
    const summary = await runDueStandingOrders()

    if (summary.processed > 0) {
      console.info(
        `[standing-orders] processed ${summary.processed}, succeeded ${summary.succeeded}, failed ${summary.failed}`,
      )
    }

    return { result: summary }
  },
})
