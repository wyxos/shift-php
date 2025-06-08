<script lang="ts" setup>
import { computed } from 'vue'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const props = defineProps<{
  variant?: 'default' | 'circle' | 'rounded'
  class?: string
  width?: string
  height?: string
}>()

const skeletonVariants = cva(
  'animate-pulse bg-muted',
  {
    variants: {
      variant: {
        default: 'rounded-md',
        circle: 'rounded-full',
        rounded: 'rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

const skeletonClass = computed(() => {
  return cn(
    skeletonVariants({ variant: props.variant }),
    props.class
  )
})

const skeletonStyle = computed(() => {
  const style: Record<string, string> = {}

  if (props.width) {
    style.width = props.width
  }

  if (props.height) {
    style.height = props.height
  }

  return style
})
</script>

<template>
  <div :class="skeletonClass" :style="skeletonStyle">
    <slot />
  </div>
</template>
