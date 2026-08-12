export type ThemePreference = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'neobank-theme'

/**
 * Manual light/dark override on top of the OS preference.
 *
 * The stylesheet already keys off `[data-theme]`; this writes that attribute
 * and remembers the choice. A tiny inline script in nuxt.config applies it
 * before first paint so there is no flash of the wrong theme.
 */
export function useTheme() {
  const preference = useState<ThemePreference>('theme', () => 'system')

  function apply(value: ThemePreference) {
    if (!import.meta.client) return

    const root = document.documentElement

    if (value === 'system') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', value)
    }

    localStorage.setItem(STORAGE_KEY, value)
  }

  function set(value: ThemePreference) {
    preference.value = value
    apply(value)
  }

  /** Cycles light → dark → system, matching the toggle button's icon order. */
  function cycle() {
    const order: ThemePreference[] = ['light', 'dark', 'system']
    const next = order[(order.indexOf(preference.value) + 1) % order.length]!

    set(next)
  }

  onMounted(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemePreference | null

    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      preference.value = stored
    }
  })

  return { preference, set, cycle }
}
