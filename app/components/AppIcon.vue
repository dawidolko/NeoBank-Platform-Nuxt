<script setup lang="ts">
/**
 * Inline SVG icon set (Lucide-derived paths, 24x24 grid, currentColor stroke).
 *
 * Inlined rather than pulled from an icon package so the bundle carries only
 * the glyphs actually used and every icon inherits colour and size from CSS.
 */
const props = withDefaults(
  defineProps<{
    name: keyof typeof PATHS
    size?: number | string
    /** Give the icon an accessible name; omit for purely decorative use. */
    label?: string
    strokeWidth?: number
  }>(),
  { size: 20, label: undefined, strokeWidth: 1.75 },
)

const PATHS = {
  // Navigation
  home: 'M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5',
  wallet: 'M3 7.5A2.5 2.5 0 0 1 5.5 5H18a2 2 0 0 1 2 2v1M3 7.5V17a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3M3 7.5h16M21 11h-4a2 2 0 0 0 0 4h4',
  send: 'm22 2-7 20-4-9-9-4Z M22 2 11 13',
  receipt: 'M4 3v18l2.5-1.5L9 21l2.5-1.5L14 21l2.5-1.5L19 21V3l-2.5 1.5L14 3l-2.5 1.5L9 3 6.5 4.5Z M8.5 8.5h7M8.5 12h7M8.5 15.5h4',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v0c.24.58.8.98 1.42 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z',

  // Money movement
  'arrow-up-right': 'M7 17 17 7M9 7h8v8',
  'arrow-down-left': 'M17 7 7 17M15 17H7V9',
  'arrow-left': 'M19 12H5M12 19l-7-7 7-7',
  'arrow-right': 'M5 12h14M12 5l7 7-7 7',
  'arrow-left-right': 'M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',

  // Products
  'credit-card': 'M2 7.5A2.5 2.5 0 0 1 4.5 5h15A2.5 2.5 0 0 1 22 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 16.5Z M2 10h20',
  'piggy-bank': 'M19 11c0-3.5-3.1-6-7-6s-7 2.5-7 6c0 1.7.8 3.3 2 4.4V19h3v-2h4v2h3v-3.6c1.2-1.1 2-2.7 2-4.4Z M15.5 10.5h.01M5 11H3.5a1.5 1.5 0 0 1 0-3H5',
  landmark: 'M3 21h18M4 10v8M9 10v8M15 10v8M20 10v8M12 3 2.5 8h19Z',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M3.5 9h17M3.5 15h17M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z',

  // Feedback
  check: 'm5 13 4 4L19 7',
  'check-circle': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z m8.5-9.2 2.2 2.2 4.3-4.3',
  x: 'M18 6 6 18M6 6l12 12',
  'alert-circle': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 8v5M12 16.5h.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 16v-5M12 8h.01',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7Z',

  // UI
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3',
  menu: 'M4 6h16M4 12h16M4 18h16',
  copy: 'M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1Z M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  trash: 'M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6M10 11v6M14 11v6',
  pencil: 'M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z',
  'log-out': 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2 M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6Z',
  filter: 'M3 5h18l-7 8v6l-4 2v-8Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7v5l3 2',
  lock: 'M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z M8 11V7a4 4 0 1 1 8 0v4',
  monitor: 'M4 4h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z M8 21h8M12 16v5',
  'trending-up': 'm3 17 6-6 4 4 8-8M21 7v5h-5',
  'trending-down': 'm3 7 6 6 4-4 8 8M21 17v-5h-5',
  'chart-bar': 'M3 21h18M7 21V10M12 21V4M17 21v-7',
} as const

const path = computed(() => PATHS[props.name])
const dimension = computed(() => (typeof props.size === 'number' ? `${props.size}px` : props.size))
</script>

<template>
  <svg
    class="icon"
    :width="dimension"
    :height="dimension"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    :aria-hidden="label ? undefined : true"
    :aria-label="label"
    :role="label ? 'img' : undefined"
  >
    <path :d="path" />
  </svg>
</template>

<style scoped>
.icon {
  display: inline-block;
  flex-shrink: 0;
  vertical-align: middle;
}
</style>
