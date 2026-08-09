export interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'CUSTOMER' | 'ADMIN'
  status?: string
}

/**
 * Session state, shared app-wide via useState so SSR and client agree and
 * every component sees the same user object.
 */
export function useAuth() {
  const user = useState<AuthUser | null>('auth:user', () => null)

  const isAuthenticated = computed(() => user.value !== null)
  const isAdmin = computed(() => user.value?.role === 'ADMIN')
  const fullName = computed(() =>
    user.value ? `${user.value.firstName} ${user.value.lastName}` : '',
  )
  const initials = computed(() =>
    user.value
      ? `${user.value.firstName.charAt(0)}${user.value.lastName.charAt(0)}`.toUpperCase()
      : '',
  )

  async function refresh() {
    try {
      // During SSR $fetch does not inherit the browser's cookies, so the
      // session cookie has to be forwarded explicitly — otherwise the server
      // sees an anonymous request and the auth middleware bounces the user.
      const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined

      const { user: fetched } = await $fetch<{ user: AuthUser | null }>('/api/auth/me', { headers })
      user.value = fetched
    } catch {
      user.value = null
    }

    return user.value
  }

  async function login(email: string, password: string) {
    const response = await $fetch<{ user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    user.value = response.user

    return response.user
  }

  async function register(payload: {
    email: string
    password: string
    firstName: string
    lastName: string
    phone?: string
  }) {
    const response = await $fetch<{ user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      body: payload,
    })
    user.value = response.user

    return response.user
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    user.value = null
    await navigateTo('/login')
  }

  return { user, isAuthenticated, isAdmin, fullName, initials, refresh, login, register, logout }
}
