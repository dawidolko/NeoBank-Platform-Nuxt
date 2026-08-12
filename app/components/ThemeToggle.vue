<script setup lang="ts">
const { preference, cycle } = useTheme()

const icon = computed(() =>
  preference.value === 'light' ? 'sun' : preference.value === 'dark' ? 'moon' : 'monitor',
)

const nextLabel = computed(
  () =>
    ({ light: 'Switch to dark theme', dark: 'Match system theme', system: 'Switch to light theme' })[
      preference.value
    ],
)
</script>

<template>
  <button
    class="btn btn-ghost btn-icon"
    type="button"
    :aria-label="nextLabel"
    :title="nextLabel"
    @click="cycle"
  >
    <AppIcon :name="icon" :size="17" />
  </button>
</template>
