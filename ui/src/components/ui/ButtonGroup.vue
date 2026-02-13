<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'
import { Button } from '@shift/ui/button'

type Option = {
  value: string
  label: string
}

const props = withDefaults(defineProps<{
  modelValue?: string
  options: Option[]
  disabled?: boolean
  columns?: 2 | 3 | 4
  class?: string
  testIdPrefix?: string
  ariaLabel?: string
}>(), {
  columns: 3,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const columnsClass = computed(() => {
  switch (props.columns) {
    case 2:
      return 'grid-cols-2'
    case 4:
      return 'grid-cols-4'
    default:
      return 'grid-cols-3'
  }
})
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="ariaLabel"
    :class="cn('grid gap-2', columnsClass, props.class)"
  >
    <Button
      v-for="option in options"
      :key="option.value"
      role="radio"
      type="button"
      size="sm"
      :disabled="disabled"
      :aria-checked="modelValue === option.value"
      :variant="modelValue === option.value ? 'default' : 'outline'"
      :data-testid="testIdPrefix ? `${testIdPrefix}-${option.value}` : undefined"
      @click="emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </Button>
  </div>
</template>

