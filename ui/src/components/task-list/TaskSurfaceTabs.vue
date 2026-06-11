<script setup lang="ts">
type TaskSurface = 'tasks' | 'requirements';

defineProps<{
    activeSurface: TaskSurface;
}>();

const emit = defineEmits<{
    'set-surface': [surface: TaskSurface];
}>();
</script>

<template>
    <div class="mb-4 flex flex-wrap items-center gap-2" role="tablist" aria-label="SHIFT work area">
        <button
            type="button"
            role="tab"
            data-testid="tasks-tab"
            :aria-selected="activeSurface === 'tasks'"
            :class="[
                activeSurface === 'tasks'
                    ? 'bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                'rounded-md border px-3 py-2 text-sm font-medium transition-colors',
            ]"
            @click="emit('set-surface', 'tasks')"
        >
            Tasks
        </button>
        <button
            type="button"
            role="tab"
            data-testid="requirements-tab"
            :aria-selected="activeSurface === 'requirements'"
            :class="[
                activeSurface === 'requirements'
                    ? 'bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                'rounded-md border px-3 py-2 text-sm font-medium transition-colors',
            ]"
            @click="emit('set-surface', 'requirements')"
        >
            Requirements
        </button>
    </div>
</template>
