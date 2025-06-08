<script lang="ts" setup>
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: string
  error?: string
}>()
</script>

<template>
  <div :class="cn('space-y-2', props.class)">
    <slot />
    <p v-if="error" class="text-sm font-medium text-destructive">
      {{ error }}
    </p>
  </div>
</template>
