/**
 * BigInt cannot cross JSON. Every API response converts money columns to
 * strings here, so the client always receives exact minor-unit values.
 */

/** Recursively convert BigInt values to strings. */
export function serializeBigInt<T>(value: T): T {
  if (typeof value === 'bigint') return value.toString() as unknown as T
  if (value instanceof Date) return value as T
  if (Array.isArray(value)) return value.map(serializeBigInt) as unknown as T

  if (value !== null && typeof value === 'object') {
    const output: Record<string, unknown> = {}

    for (const [key, item] of Object.entries(value)) {
      output[key] = serializeBigInt(item)
    }

    return output as T
  }

  return value
}
