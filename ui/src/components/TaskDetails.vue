<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import axios from '../axios-config';
import ActionIconButton from '@shared/components/ActionIconButton.vue';
import { getPriorityBadgeClass, getPriorityLabel, getStatusBadgeClass, getStatusLabel } from '@shared/tasks/presentation';
import { ArrowLeft, Pencil } from 'lucide-vue-next';
import { Badge } from '@shift/ui/badge';
import { Button } from '@shift/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shift/ui/card';

type Task = {
    id: number;
    title: string;
    status: string;
    priority: string;
};

const router = useRouter();
const route = useRoute();
const task = ref<Task | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

const detailRows = computed(() => {
    if (!task.value) {
        return [];
    }

    return [
        { label: 'Title', value: task.value.title },
        { label: 'Status', value: getStatusLabel(task.value.status) },
        { label: 'Priority', value: getPriorityLabel(task.value.priority) },
    ];
});

async function fetchTask() {
    const taskId = route.params.id;

    if (!taskId) {
        router.push({ name: 'task-list' });
        return;
    }

    loading.value = true;
    error.value = null;

    try {
        const response = await axios.get(`/shift/api/tasks/${taskId}`);
        task.value = response.data.data;
    } catch (exception: any) {
        error.value = exception.response?.data?.error || exception.message || 'Unknown error';
    } finally {
        loading.value = false;
    }
}

function goBack() {
    router.push({ name: 'task-list' });
}

onMounted(fetchTask);
</script>

<template>
    <div class="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h1 class="text-2xl font-semibold tracking-tight">Task Details</h1>
                <p class="text-muted-foreground text-sm">Inspect the current task state and jump straight into editing.</p>
            </div>

            <div class="flex items-center gap-2">
                <Button variant="outline" @click="goBack">
                    <ArrowLeft class="mr-2 h-4 w-4" />
                    Back
                </Button>
                <ActionIconButton v-if="task" as-child label="Edit task" title="Edit">
                    <router-link :to="{ name: 'edit-task', params: { id: task.id.toString() } }">
                        <Pencil class="h-4 w-4" />
                    </router-link>
                </ActionIconButton>
            </div>
        </div>

        <div v-if="loading" class="text-muted-foreground py-10 text-center text-sm">Loading task details…</div>

        <Card v-else-if="error" class="border-destructive/40">
            <CardHeader>
                <CardTitle>Task Unavailable</CardTitle>
                <CardDescription>{{ error }}</CardDescription>
            </CardHeader>
            <CardContent>
                <Button @click="fetchTask">Retry</Button>
            </CardContent>
        </Card>

        <Card v-else-if="task">
            <CardHeader class="gap-4 pb-2 sm:flex-row sm:items-start sm:justify-between">
                <div class="space-y-2">
                    <CardTitle class="text-xl">{{ task.title }}</CardTitle>
                    <CardDescription>Current task metadata from the embedded SHIFT workspace.</CardDescription>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                    <Badge :class="getStatusBadgeClass(task.status)" variant="outline">
                        {{ getStatusLabel(task.status) }}
                    </Badge>
                    <Badge :class="getPriorityBadgeClass(task.priority)" variant="outline">
                        {{ getPriorityLabel(task.priority) }}
                    </Badge>
                </div>
            </CardHeader>

            <CardContent class="grid gap-4 sm:grid-cols-3">
                <div
                    v-for="row in detailRows"
                    :key="row.label"
                    class="border-border/70 bg-muted/35 rounded-xl border px-4 py-3"
                >
                    <div class="text-muted-foreground text-xs font-medium uppercase tracking-[0.16em]">{{ row.label }}</div>
                    <div class="text-foreground mt-2 text-sm font-medium">{{ row.value }}</div>
                </div>
            </CardContent>
        </Card>
    </div>
</template>
