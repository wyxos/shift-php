<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';

axios.defaults.withCredentials = true;

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

function editTask(taskId: number) {
    router.push({ name: 'edit-task', params: { id: taskId.toString() } });
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
        tasks.value = tasks.value.filter(task => task.id !== taskId);
    } catch (e: any) {
        error.value = e.response?.data?.error || e.message || 'Failed to delete task';
    } finally {
        deleteLoading.value = null;
    }
}

onMounted(fetchTasks);
</script>

<template>
    <div class="mx-auto mt-12 max-w-xl rounded-2xl bg-white p-6 shadow-lg">
        <div class="mb-6 flex items-center justify-between">
            <h1 class="text-2xl font-bold">Tasks</h1>
            <button
                @click="router.push({ name: 'create-task' })"
                class="rounded border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
            >
                + Create
            </button>
        </div>

        <div v-if="loading" class="py-8 text-center text-gray-500">Loading...</div>
        <div v-else-if="error" class="py-8 text-center text-red-600">{{ error }}</div>
        <div v-else-if="tasks.length === 0" class="py-8 text-center text-gray-500">No tasks found</div>

        <ul v-else class="divide-y divide-gray-100">
            <li v-for="task in tasks" :key="task.id" class="flex flex-col py-3 sm:flex-row sm:items-center sm:gap-4">
                <span class="flex-1 text-lg font-medium">{{ task.title }}</span>
                <span
                    class="inline-block rounded-full px-2 py-1 text-xs"
                    :class="
                        task.status === 'pending'
                            ? 'border border-yellow-200 bg-yellow-50 text-yellow-600'
                            : task.status === 'completed'
                              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border border-gray-200 bg-gray-100 text-gray-500'
                    "
                    >{{ task.status }}</span
                >
                <span class="ml-2 text-xs text-gray-400 uppercase">{{ task.priority }}</span>
                <button
                    @click="editTask(task.id)"
                    class="mt-2 ml-2 rounded border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 sm:mt-0"
                >
                    Edit
                </button>
                <button
                    @click="deleteTask(task.id)"
                    :disabled="deleteLoading === task.id"
                    class="mt-2 ml-2 rounded border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100 sm:mt-0"
                >
                    {{ deleteLoading === task.id ? 'Deleting...' : 'Delete' }}
                </button>
            </li>
        </ul>
    </div>
</template>
