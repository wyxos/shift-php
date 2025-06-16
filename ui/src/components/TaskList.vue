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
import Select from './ui/select.vue';
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
const statusFilter = ref<string>('');

// Status options for the filter
const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'awaiting-feedback', label: 'Awaiting Feedback' },
    { value: 'completed', label: 'Completed' },
    { value: 'closed', label: 'Closed' },
];

async function fetchTasks() {
    loading.value = true;
    error.value = null;
    try {
        // Add status filter to request if selected
        const params: Record<string, string> = {};
        if (statusFilter.value) {
            params.status = statusFilter.value;
        }

        const response = await axios.get('/shift/api/tasks', { params });
        tasks.value = response.data.data;
    } catch (e: any) {
        error.value = e.response?.data?.error || e.message || 'Unknown error';
    } finally {
        loading.value = false;
    }
}

// Update URL when filter changes
function updateUrlWithFilters() {
    router.push({
        query: {
            ...(statusFilter.value ? { status: statusFilter.value } : {})
        }
    });
}

// Watch for changes to the status filter
watch(statusFilter, () => {
    fetchTasks();
    updateUrlWithFilters();
});

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
    // Check if status filter is in URL
    if (route.query.status) {
        statusFilter.value = route.query.status as string;
    }

    fetchTasks();
});
</script>

<template>
    <Card class="w-full">
        <CardHeader class="flex flex-row items-center justify-between">
            <CardTitle>Tasks</CardTitle>
            <div class="flex items-center gap-4">
                <div class="flex items-center gap-2">
                    <Filter class="h-4 w-4 text-muted-foreground" />
                    <Label for="status-filter" class="text-sm">Status:</Label>
                    <Select
                        id="status-filter"
                        v-model="statusFilter"
                        class="w-40"
                    >
                        <option v-for="option in statusOptions" :key="option.value" :value="option.value">
                            {{ option.label }}
                        </option>
                    </Select>
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
                        <Button
                            variant="secondary"
                            size="sm"
                            @click="router.push({ name: 'edit-task', params: { id: task.id.toString() } })"
                            title="Edit"
                        >
                            <Pencil class="h-4 w-4" />
                        </Button>
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
