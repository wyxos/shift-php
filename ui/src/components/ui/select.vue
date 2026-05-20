<script lang="ts" setup>
import { Select as SharedSelect, type SelectOption, type SelectOptionValue } from '@shift/ui/select';
import type { HTMLAttributes } from 'vue';

defineOptions({
    inheritAttrs: false,
});

const props = withDefaults(
    defineProps<{
        modelValue?: SelectOptionValue;
        options?: SelectOption[];
        placeholder?: string;
        searchPlaceholder?: string;
        emptyLabel?: string;
        disabled?: boolean;
        searchable?: boolean;
        align?: 'start' | 'center' | 'end';
        class?: HTMLAttributes['class'];
        triggerClass?: HTMLAttributes['class'];
        contentClass?: HTMLAttributes['class'];
        testId?: string;
        ariaLabel?: string;
    }>(),
    {
        options: () => [],
        placeholder: 'Select an option',
        searchPlaceholder: 'Search options...',
        emptyLabel: 'No options found.',
        disabled: false,
        searchable: false,
        align: 'start',
        class: undefined,
        triggerClass: undefined,
        contentClass: undefined,
        testId: undefined,
        ariaLabel: undefined,
        modelValue: undefined,
    },
);

const emit = defineEmits<{
    'update:modelValue': [value: SelectOptionValue];
}>();
</script>

<template>
    <SharedSelect
        v-bind="{ ...$attrs, ...props }"
        :model-value="modelValue"
        @update:modelValue="emit('update:modelValue', $event)"
    />
</template>
