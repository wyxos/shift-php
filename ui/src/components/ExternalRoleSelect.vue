<script setup lang="ts">
defineProps<{
    modelValue: string;
    groups: Array<{
        label: string;
        options: Array<{ value: string; label: string }>;
    }>;
    label: string;
    disabled?: boolean;
}>();

const emit = defineEmits<{
    'update:modelValue': [value: string];
}>();

function updateRole(event: Event): void {
    emit('update:modelValue', (event.target as HTMLSelectElement).value);
}
</script>

<template>
    <select
        :value="modelValue"
        class="border-input bg-background focus:border-ring focus-visible:border-ring h-9 w-full rounded-md border px-3 text-sm transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        :aria-label="label"
        :disabled="disabled"
        data-shift-field-control
        @change="updateRole"
    >
        <optgroup v-for="group in groups" :key="group.label" :label="group.label">
            <option v-for="role in group.options" :key="role.value" :value="role.value">
                {{ role.label }}
            </option>
        </optgroup>
    </select>
</template>
