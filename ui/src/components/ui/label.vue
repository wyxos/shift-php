<script lang="ts" setup>
import { cn } from '@/lib/utils'

const props = defineProps<{
  htmlFor?: string
  class?: string
  required?: boolean
}>()
</script>

<template>
  <label
    :for="htmlFor"
    :class="
      cn(
        'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        props.class
      )
    "
  >
    <slot />
    <span v-if="required" class="ml-1 text-destructive">*</span>
  </label>
</template>
