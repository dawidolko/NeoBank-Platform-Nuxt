<script setup lang="ts">
interface Slice {
  label: string
  hue: string
  share: number
}

const props = withDefaults(
  defineProps<{
    slices: Slice[]
    size?: number
    thickness?: number
    /** Rendered in the middle of the ring. */
    centerLabel?: string
    centerValue?: string
  }>(),
  { size: 190, thickness: 22, centerLabel: undefined, centerValue: undefined },
)

const radius = computed(() => (props.size - props.thickness) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)

/**
 * Each slice is one stroked circle with a dash gap, rotated to start where the
 * previous slice ended. Cheaper and crisper than generating arc paths, and it
 * animates by simply changing `stroke-dasharray`.
 */
const segments = computed(() => {
  let offset = 0

  return props.slices
    .filter((slice) => slice.share > 0)
    .map((slice) => {
      const length = (slice.share / 100) * circumference.value
      const segment = {
        ...slice,
        dash: `${length} ${circumference.value - length}`,
        // -90deg puts the first slice at 12 o'clock.
        rotation: (offset / 100) * 360 - 90,
      }

      offset += slice.share

      return segment
    })
})
</script>

<template>
  <div class="donut" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg :viewBox="`0 0 ${size} ${size}`" role="presentation">
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        stroke="var(--surface-muted)"
        :stroke-width="thickness"
      />
      <circle
        v-for="segment in segments"
        :key="segment.label"
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        :stroke="`hsl(${segment.hue})`"
        :stroke-width="thickness"
        :stroke-dasharray="segment.dash"
        stroke-linecap="butt"
        :transform="`rotate(${segment.rotation} ${size / 2} ${size / 2})`"
        class="segment"
      />
    </svg>

    <div v-if="centerValue" class="donut-center">
      <span v-if="centerLabel" class="tiny muted">{{ centerLabel }}</span>
      <span class="donut-value numeric">{{ centerValue }}</span>
    </div>
  </div>
</template>

<style scoped>
.donut { position: relative; flex-shrink: 0; }
.donut svg { width: 100%; height: 100%; }

.segment { transition: stroke-dasharray var(--duration-slow) var(--ease-out); }

.donut-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  text-align: center;
  pointer-events: none;
}

.donut-value {
  font-size: var(--text-lg);
  font-weight: var(--weight-bold);
  letter-spacing: -0.02em;
}
</style>
