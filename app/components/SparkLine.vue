<script setup lang="ts">
/**
 * Dependency-free area sparkline.
 *
 * Renders from a plain series of minor-unit strings, so it works directly on
 * what the API returns without converting money to floats until the last step.
 */
const props = withDefaults(
  defineProps<{
    points: Array<{ date: string; balanceCents: string | number | bigint }>
    width?: number
    height?: number
    tone?: 'primary' | 'success' | 'danger'
    label?: string
  }>(),
  { width: 640, height: 160, tone: 'primary', label: undefined },
)

const gradientId = useId()

const geometry = computed(() => {
  const values = props.points.map((point) => Number(BigInt(point.balanceCents ?? 0)))

  if (values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  // A flat series would divide by zero; give it a nominal band so it draws
  // as a centred horizontal line rather than collapsing onto the baseline.
  const span = max - min || Math.abs(max) || 1
  const padding = 6
  const usableHeight = props.height - padding * 2
  const step = props.width / (values.length - 1)

  const coords = values.map((value, index) => ({
    x: index * step,
    y: padding + usableHeight - ((value - min) / span) * usableHeight,
  }))

  const line = coords
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(' ')

  const area = `${line} L${props.width},${props.height} L0,${props.height} Z`

  return { line, area, last: coords[coords.length - 1]!, min, max }
})

const strokeColor = computed(
  () => ({ primary: 'var(--primary)', success: 'var(--success)', danger: 'var(--danger)' })[props.tone],
)
</script>

<template>
  <svg
    v-if="geometry"
    class="spark"
    :viewBox="`0 0 ${width} ${height}`"
    preserveAspectRatio="none"
    :aria-label="label"
    :role="label ? 'img' : undefined"
    :aria-hidden="label ? undefined : true"
  >
    <defs>
      <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" :stop-color="strokeColor" stop-opacity="0.28" />
        <stop offset="100%" :stop-color="strokeColor" stop-opacity="0" />
      </linearGradient>
    </defs>

    <path :d="geometry.area" :fill="`url(#${gradientId})`" />
    <path
      :d="geometry.line"
      fill="none"
      :stroke="strokeColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      vector-effect="non-scaling-stroke"
    />
    <circle
      :cx="geometry.last.x"
      :cy="geometry.last.y"
      r="3"
      :fill="strokeColor"
      vector-effect="non-scaling-stroke"
    />
  </svg>
</template>

<style scoped>
.spark {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}
</style>
