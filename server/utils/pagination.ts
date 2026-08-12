/**
 * Clamp a requested page to the range that actually exists.
 *
 * Without this a deep link like `?page=9` on a two-page list returns an empty
 * array *and* `pages: 0`, which hides the pagination control — stranding the
 * visitor with no way back except editing the URL.
 */
export function paginate(total: number, page: number, perPage: number) {
  const pages = Math.max(1, Math.ceil(total / perPage))
  const current = Math.min(Math.max(1, page), pages)

  return {
    page: current,
    perPage,
    total,
    pages: total === 0 ? 0 : pages,
    skip: (current - 1) * perPage,
  }
}
