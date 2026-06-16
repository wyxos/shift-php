<script setup lang="ts">
import ConfirmRequestDialog from '@shared/components/ConfirmRequestDialog.vue';
import { computed } from 'vue';

type TaskSurface = 'tasks' | 'requirements';

const props = defineProps<{
    error?: string | null;
    loading?: boolean;
    open: boolean;
    surface: TaskSurface;
    taskTitle?: string | null;
}>();

const emit = defineEmits<{
    'update:open': [open: boolean];
    confirm: [];
}>();

const openModel = computed({
    get: () => props.open,
    set: (value: boolean) => emit('update:open', value),
});
const noun = computed(() => (props.surface === 'requirements' ? 'requirement' : 'task'));
const title = computed(() => props.taskTitle ?? (props.surface === 'requirements' ? 'this requirement' : 'this task'));
</script>

<template>
    <ConfirmRequestDialog
        v-model:open="openModel"
        :confirm-label="`Delete ${noun}`"
        confirm-test-id="confirm-task-delete"
        confirm-variant="destructive"
        :error="error"
        :loading="loading"
        loading-label="Deleting..."
        :title="`Delete ${noun}`"
        @confirm="emit('confirm')"
    >
        Delete {{ title }} from SHIFT? This cannot be undone.
    </ConfirmRequestDialog>
</template>
