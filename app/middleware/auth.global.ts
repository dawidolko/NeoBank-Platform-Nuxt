const PUBLIC_ROUTES = new Set(['/', '/login', '/register'])

/**
 * Guards every navigation.
 *
 * The session is resolved once per page load (SSR) and reused on client-side
 * navigations, so the cookie round-trip does not repeat on every route change.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const { user, refresh } = useAuth()

  if (user.value === null) {
    await refresh()
  }

  /*
   * An address that matches no page is left to the router, which answers 404.
   * Sending it to the sign-in page would tell crawlers it exists.
   */
  if (to.matched.length === 0) return

  const isPublic = PUBLIC_ROUTES.has(to.path)

  if (!user.value && !isPublic) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }

  // A signed-in user has no reason to see the auth screens.
  if (user.value && (to.path === '/login' || to.path === '/register')) {
    return navigateTo('/dashboard')
  }

  if (to.path.startsWith('/admin') && user.value?.role !== 'ADMIN') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Admin access required',
      fatal: true,
    })
  }
})
