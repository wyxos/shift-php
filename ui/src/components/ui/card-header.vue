<script lang="ts" setup>
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: string
}>()
</script>

<template>
  <div
    :class="
      cn('flex flex-col space-y-1.5 p-4', props.class)
    "
  >
    <slot />
  </div>
</template>
