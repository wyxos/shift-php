<script lang="ts" setup>
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: string
}>()
</script>

<template>
  <div
    :class="
      cn('p-4 pt-0', props.class)
    "
  >
    <slot />
  </div>
</template>
