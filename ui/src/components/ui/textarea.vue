<script lang="ts" setup>
import { cn } from '@/lib/utils';

const props = defineProps<{
    modelValue?: string;
    placeholder?: string;
    disabled?: boolean;
    class?: string;
    rows?: number;
}>();

const emit = defineEmits<{
    'update:modelValue': [value: string];
}>();

function onInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    emit('update:modelValue', target.value);
}
</script>

<template>
    <textarea
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :rows="rows ?? 4"
        data-shift-field-control
        :class="
            cn(
                'border-input placeholder:text-muted-foreground focus:border-ring focus-visible:border-ring flex min-h-[60px] w-full rounded-md border bg-transparent px-3 py-2 text-sm transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                props.class,
            )
        "
        @input="onInput"
    />
</template>
