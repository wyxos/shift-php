<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, type LocationQueryRaw } from 'vue-router';

type TaskSurface = 'tasks' | 'requirements';
type RouteQuery = LocationQueryRaw;

const props = withDefaults(
    defineProps<{
        activeSurface: TaskSurface;
        query?: RouteQuery;
    }>(),
    {
        query: () => ({}),
    },
);

const emit = defineEmits<{
    'set-surface': [surface: TaskSurface];
}>();

const tasksTo = computed(() => ({ path: '/tasks', query: props.query }));
const requirementsTo = computed(() => ({ path: '/requirements', query: props.query }));
const tasksHref = computed(() => hrefFor('/tasks'));
const requirementsHref = computed(() => hrefFor('/requirements'));

function tabClass(surface: TaskSurface) {
    return [
        props.activeSurface === surface
            ? 'bg-primary text-primary-foreground'
            : 'border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground',
        'rounded-md border px-3 py-2 text-sm font-medium transition-colors',
    ];
}

function onTabClick(event: MouseEvent, surface: TaskSurface) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) {
        return;
    }

    event.preventDefault();
    emit('set-surface', surface);
}

function hrefFor(path: string) {
    const params = new URLSearchParams();

    Object.entries(props.query).forEach(([key, value]) => {
        const values = Array.isArray(value) ? value : [value];

        values.forEach((entry) => {
            if (entry !== null && entry !== undefined) {
                params.append(key, String(entry));
            }
        });
    });

    const search = params.toString();

    return `/shift${path}${search ? `?${search}` : ''}`;
}
</script>

<template>
    <div class="mb-4 flex flex-wrap items-center gap-2" role="tablist" aria-label="SHIFT work area">
        <RouterLink :to="tasksTo" custom>
            <a
                :href="tasksHref"
                role="tab"
                data-testid="tasks-tab"
                :aria-current="activeSurface === 'tasks' ? 'page' : undefined"
                :aria-selected="activeSurface === 'tasks'"
                :class="tabClass('tasks')"
                @click="onTabClick($event, 'tasks')"
            >
                Tasks
            </a>
        </RouterLink>
        <RouterLink :to="requirementsTo" custom>
            <a
                :href="requirementsHref"
                role="tab"
                data-testid="requirements-tab"
                :aria-current="activeSurface === 'requirements' ? 'page' : undefined"
                :aria-selected="activeSurface === 'requirements'"
                :class="tabClass('requirements')"
                @click="onTabClick($event, 'requirements')"
            >
                Requirements
            </a>
        </RouterLink>
    </div>
</template>
