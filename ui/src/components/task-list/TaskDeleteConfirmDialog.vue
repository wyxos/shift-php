<script setup lang="ts">
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@shift/ui/alert-dialog';
import { computed } from 'vue';

type TaskSurface = 'tasks' | 'requirements';

const props = defineProps<{
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
    <AlertDialog v-model:open="openModel">
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Delete {{ noun }}</AlertDialogTitle>
                <AlertDialogDescription> Delete {{ title }} from SHIFT? This cannot be undone. </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel @click="openModel = false">Cancel</AlertDialogCancel>
                <AlertDialogAction
                    class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    data-testid="confirm-task-delete"
                    @click="emit('confirm')"
                >
                    Delete {{ noun }}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
</template>
