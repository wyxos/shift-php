<script lang="ts" setup>
import { computed } from 'vue'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const props = defineProps<{
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'primary' | 'accent'
  class?: string
}>()

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground',
        primary:
          'border-transparent bg-primary/10 text-primary border-primary/20 hover:bg-primary/20',
        accent:
          'border-transparent bg-accent/10 text-accent-foreground border-accent/20 hover:bg-accent/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

const badgeClass = computed(() => {
  return cn(badgeVariants({ variant: props.variant }), props.class)
})
</script>

<template>
  <div :class="badgeClass">
    <slot />
  </div>
</template>
