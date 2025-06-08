<script lang="ts" setup>
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: string
  as?: string
}>()
</script>

<template>
  <component
    :is="as ?? 'h3'"
    :class="
      cn(
        'text-2xl font-semibold leading-none tracking-tight',
        props.class
      )
    "
  >
    <slot />
  </component>
</template>
