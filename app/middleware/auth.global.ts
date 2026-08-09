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
