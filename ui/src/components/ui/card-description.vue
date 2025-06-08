<script lang="ts" setup>
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: string
  as?: string
}>()
</script>

<template>
  <component
    :is="as ?? 'p'"
    :class="
      cn('text-sm text-muted-foreground', props.class)
    "
  >
    <slot />
  </component>
</template>
