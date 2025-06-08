<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import axios from '../axios-config';
import { Pencil, Trash2, Plus } from 'lucide-vue-next';
import Button from './ui/button.vue';
import Card from './ui/card.vue';
import CardHeader from './ui/card-header.vue';
import CardTitle from './ui/card-title.vue';
import CardContent from './ui/card-content.vue';
import Badge from './ui/badge.vue';

type Task = {
    id: number;
    title: string;
    status: string;
    priority: string;
};

const router = useRouter();
const tasks = ref<Task[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const deleteLoading = ref<number | null>(null);

async function fetchTasks() {
    loading.value = true;
    error.value = null;
    try {
        const response = await axios.get('/shift/api/tasks');
        tasks.value = response.data.data;
    } catch (e: any) {
        error.value = e.response?.data?.error || e.message || 'Unknown error';
    } finally {
        loading.value = false;
    }
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

onMounted(fetchTasks);
</script>

<template>
    <Card class="w-full">
        <CardHeader class="flex flex-row items-center justify-between">
            <CardTitle>Tasks</CardTitle>
            <Button
                variant="primary"
                size="sm"
                @click="router.push({ name: 'create-task' })"
            >
                <Plus class="h-4 w-4 mr-1" />
                Create
            </Button>
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
