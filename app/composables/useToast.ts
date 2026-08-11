export type ToastTone = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  tone: ToastTone
  title: string
  description?: string
}

let nextId = 0

const DEFAULT_DURATION = 5000

export function useToast() {
  const toasts = useState<Toast[]>('toasts', () => [])

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  function push(tone: ToastTone, title: string, description?: string) {
    const id = nextId++

    toasts.value = [...toasts.value, { id, tone, title, description }]

    if (import.meta.client) {
      setTimeout(() => dismiss(id), DEFAULT_DURATION)
    }

    return id
  }

  return {
    toasts,
    dismiss,
    success: (title: string, description?: string) => push('success', title, description),
    error: (title: string, description?: string) => push('error', title, description),
    info: (title: string, description?: string) => push('info', title, description),
  }
}
