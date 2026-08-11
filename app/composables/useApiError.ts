export interface ApiErrorShape {
  errors: Record<string, string>
  message: string
  statusCode?: number
}

/**
 * Normalizes a `$fetch` rejection into the field-error map the forms render.
 * The server always answers validation failures with `data.errors`, but network
 * faults and unexpected 500s have no such body — those collapse to `fallback`.
 */
export function extractApiError(error: unknown, fallback = 'Something went wrong. Please try again.'): ApiErrorShape {
  const typed = error as {
    statusCode?: number
    statusMessage?: string
    data?: { statusMessage?: string; data?: { errors?: Record<string, string> } }
  }

  const errors = typed?.data?.data?.errors ?? {}
  const message = errors.form ?? typed?.data?.statusMessage ?? typed?.statusMessage ?? fallback

  return { errors, message, statusCode: typed?.statusCode }
}

/**
 * Form state shared by every page that submits to the API: pending flag,
 * per-field errors and a single reset path.
 */
export function useFormErrors() {
  const errors = ref<Record<string, string>>({})
  const submitting = ref(false)

  function clear() {
    errors.value = {}
  }

  function capture(error: unknown, fallback?: string): ApiErrorShape {
    const normalized = extractApiError(error, fallback)

    errors.value = Object.keys(normalized.errors).length
      ? normalized.errors
      : { form: normalized.message }

    return normalized
  }

  async function submit<T>(action: () => Promise<T>, fallback?: string): Promise<T | undefined> {
    submitting.value = true
    clear()

    try {
      return await action()
    } catch (error) {
      capture(error, fallback)
      return undefined
    } finally {
      submitting.value = false
    }
  }

  return { errors, submitting, clear, capture, submit }
}
