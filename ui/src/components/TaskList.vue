<script lang="ts" setup>
import { onMounted, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import axios from '../axios-config';
import { Pencil, Trash2, Plus, Filter } from 'lucide-vue-next';
import Button from './ui/button.vue';
import Card from './ui/card.vue';
import CardHeader from './ui/card-header.vue';
import CardTitle from './ui/card-title.vue';
import CardContent from './ui/card-content.vue';
import Badge from './ui/badge.vue';
import Label from './ui/label.vue';

type Task = {
    id: number;
    title: string;
    status: string;
    priority: string;
};

const router = useRouter();
const route = useRoute();
const tasks = ref<Task[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const deleteLoading = ref<number | null>(null);

// Status options, mirrored from app
const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'awaiting-feedback', label: 'Awaiting Feedback' },
    { value: 'completed', label: 'Completed' },
    { value: 'closed', label: 'Closed' },
];

// Track selected statuses as an array for checkbox filters
const selectedStatuses = ref<string[]>([]);

function getAllStatusValues(): string[] {
    return statusOptions.map((o) => o.value);
}

function normalizeStatusesFromRoute(q: unknown): string[] {
    if (!q || (Array.isArray(q) && q.length === 0)) return getAllStatusValues();
    if (Array.isArray(q)) {
        const vals = q.map(String).filter(Boolean);
        return vals.length ? vals : getAllStatusValues();
    }
    return [String(q)].filter(Boolean);
}

async function fetchTasks() {
    loading.value = true;
    error.value = null;
    try {
        // Send array of statuses only when a subset is selected; if all selected, omit to show all
        const params: Record<string, any> = {};
        if (
            selectedStatuses.value.length > 0 &&
            selectedStatuses.value.length < statusOptions.length
        ) {
            params.status = selectedStatuses.value;
        }

        const response = await axios.get('/shift/api/tasks', { params });
        tasks.value = response.data.data;
    } catch (e: any) {
        error.value = e.response?.data?.error || e.message || 'Unknown error';
    } finally {
        loading.value = false;
    }
}

// Update URL when filters change
function updateUrlWithFilters() {
    const isAll = selectedStatuses.value.length === statusOptions.length;
    router.push({
        query: {
            ...(isAll ? {} : { status: selectedStatuses.value }),
        },
    });
}

// Watch for changes to the status checkboxes
watch(
    selectedStatuses,
    () => {
        fetchTasks();
        updateUrlWithFilters();
    },
    { deep: true },
);

function resetFilters() {
    selectedStatuses.value = getAllStatusValues();
    fetchTasks();
    router.push({ query: {} });
}

async function deleteTask(taskId: number) {
    if (!confirm('Are you sure you want to delete this task?')) {
        return;
    }

    deleteLoading.value = taskId;
    error.value = null;

    try {
        await axios.delete(`/shift/api/tasks/${taskId}`);
        // Remove the task from the list
        tasks.value = tasks.value.filter((task) => task.id !== taskId);
    } catch (e: any) {
        error.value = e.response?.data?.error || e.message || 'Failed to delete task';
    } finally {
        deleteLoading.value = null;
    }
}

function getStatusVariant(status: string) {
    switch (status) {
        case 'pending':
            return 'accent';
        case 'completed':
            return 'primary';
        default:
            return 'outline';
    }
}

// Initialize filters from URL parameters on mount
onMounted(() => {
    // Preload statuses from URL; if none provided, default to all checked
    selectedStatuses.value = normalizeStatusesFromRoute(route.query.status);
    fetchTasks();
});
</script>

<template>
    <Card class="w-full">
        <CardHeader class="flex flex-row items-center justify-between">
            <CardTitle>Tasks</CardTitle>
            <div class="flex items-center gap-4">
                <div class="flex items-center gap-3">
                    <Filter class="h-4 w-4 text-muted-foreground" />
                    <Label class="text-sm">Status:</Label>
                    <div class="flex flex-wrap items-center gap-3">
                        <label
                            v-for="option in statusOptions"
                            :key="option.value"
                            class="flex items-center gap-2 text-sm"
                        >
                            <input
                                type="checkbox"
                                :value="option.value"
                                v-model="selectedStatuses"
                            />
                            <span>{{ option.label }}</span>
                        </label>
                    </div>
                    <Button variant="secondary" size="sm" @click="resetFilters">Reset</Button>
                </div>
                <Button
                    variant="primary"
                    size="sm"
                    @click="router.push({ name: 'create-task' })"
                >
                    <Plus class="h-4 w-4 mr-1" />
                    Create
                </Button>
            </div>
        </CardHeader>

        <CardContent>
            <div v-if="loading" class="py-8 text-center text-muted-foreground">Loading...</div>
            <div v-else-if="error" class="py-8 text-center text-destructive">{{ error }}</div>
            <div v-else-if="tasks.length === 0" class="py-8 text-center text-muted-foreground">No tasks found</div>

            <ul v-else class="divide-y divide-border">
                <li v-for="task in tasks" :key="task.id" class="flex flex-col py-4 sm:flex-row sm:items-center sm:gap-4">
                    <span class="flex-1 text-lg font-medium text-card-foreground">{{ task.title }}</span>
                    <Badge :variant="getStatusVariant(task.status)">
                        {{ task.status }}
                    </Badge>
                    <span class="ml-2 text-xs text-muted-foreground uppercase">{{ task.priority }}</span>
                    <div class="mt-2 flex space-x-2 sm:mt-0">
                        <router-link
                            :to="{ name: 'edit-task', params: { id: task.id.toString() } }"
                            class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-3"
                            title="Edit"
                        >
                            <Pencil class="h-4 w-4" />
                        </router-link>
                        <Button
                            variant="destructive"
                            size="sm"
                            :disabled="deleteLoading === task.id"
                            @click="deleteTask(task.id)"
                            title="Delete"
                        >
                            <span v-if="deleteLoading === task.id">Deleting...</span>
                            <Trash2 v-else class="h-4 w-4" />
                        </Button>
                    </div>
                </li>
            </ul>
        </CardContent>
    </Card>
</template>
