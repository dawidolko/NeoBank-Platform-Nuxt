/**
 * Per-request headers for internal API calls.
 *
 * During SSR, `$fetch`/`useFetch` open a fresh internal request that carries
 * none of the browser's cookies, so the session cookie must be forwarded by
 * hand. This is deliberately a composable rather than a global `$fetch`
 * override: `globalThis.$fetch` is shared by every concurrent SSR render, so
 * pinning one visitor's cookie onto it would leak that session into other
 * users' requests.
 *
 * On the client it returns undefined — the browser attaches cookies itself.
 */
export function useApiHeaders(): Record<string, string> | undefined {
  if (!import.meta.server) return undefined

  const cookie = useRequestHeaders(['cookie']).cookie

  return cookie ? { cookie } : undefined
}
