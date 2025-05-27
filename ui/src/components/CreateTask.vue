<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';

axios.defaults.withCredentials = true;

const router = useRouter();
const createError = ref<string | null>(null);
const loading = ref(false);
const attachments = ref<File[]>([]);

const newTask = ref({
    title: '',
    description: '',
    status: 'pending',
    priority: 'medium',
});

function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
        attachments.value = Array.from(input.files);
    }
}

async function createTask() {
    createError.value = null;
    loading.value = true;

    try {
        // Get the current URL for the source_url
        const source_url = window.location.origin;

        // Get the environment from the config or default to 'production'
        const environment = import.meta.env.VITE_APP_ENV || 'production';

        // Create FormData to handle file uploads
        const formData = new FormData();

        // Add task data
        formData.append('title', newTask.value.title);
        formData.append('description', newTask.value.description);
        formData.append('status', newTask.value.status);
        formData.append('priority', newTask.value.priority);
        formData.append('source_url', source_url);
        formData.append('environment', environment);

        // Add attachments
        attachments.value.forEach((file, index) => {
            formData.append(`attachments[${index}]`, file);
        });

        // Create the task using authenticated user information
        await axios.post('/shift/api/tasks', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });

        router.push({ name: 'task-list' });
    } catch (e: any) {
        createError.value = e.response?.data?.error || e.response?.data?.message || e.message || 'Unknown error';
    } finally {
        loading.value = false;
    }
}

function cancel() {
    router.push({ name: 'task-list' });
}
</script>

<template>
    <div class="mx-auto mt-12 max-w-xl rounded-2xl bg-white p-6 shadow-lg">
        <div class="mb-6 flex items-center justify-between">
            <h1 class="text-2xl font-bold">Create Task</h1>
            <button
                @click="cancel"
                class="rounded border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
            >
                Cancel
            </button>
        </div>

        <form @submit.prevent="createTask" class="space-y-3">
            <div>
                <label class="mb-1 block text-sm font-medium">Title</label>
                <input v-model="newTask.title" required type="text" class="w-full rounded border px-2 py-1" />
            </div>
            <div>
                <label class="mb-1 block text-sm font-medium">Description</label>
                <textarea v-model="newTask.description" type="text" class="w-full rounded border px-2 py-1" rows="3"></textarea>
            </div>
            <div class="flex gap-4">
                <div>
                    <label class="mb-1 block text-sm font-medium">Status</label>
                    <select v-model="newTask.status" class="rounded border px-2 py-1">
                        <option value="pending">Pending</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>
                <div>
                    <label class="mb-1 block text-sm font-medium">Priority</label>
                    <select v-model="newTask.priority" class="rounded border px-2 py-1">
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                    </select>
                </div>
            </div>
            <div>
                <label class="mb-1 block text-sm font-medium">Attachments</label>
                <input
                    type="file"
                    @change="handleFileChange"
                    multiple
                    class="w-full rounded border px-2 py-1"
                />
                <div v-if="attachments.length > 0" class="mt-2">
                    <p class="text-sm text-gray-600">Selected files:</p>
                    <ul class="text-sm text-gray-600 list-disc list-inside">
                        <li v-for="(file, index) in attachments" :key="index">
                            {{ file.name }} ({{ (file.size / 1024).toFixed(2) }} KB)
                        </li>
                    </ul>
                </div>
            </div>
            <div v-if="createError" class="text-sm text-red-600">{{ createError }}</div>
            <div>
                <button type="submit" class="mt-2 rounded bg-emerald-600 px-4 py-1 font-bold text-white hover:bg-emerald-700" :disabled="loading">
                    {{ loading ? 'Creating...' : 'Create' }}
                </button>
                <button
                    type="button"
                    @click="cancel"
                    class="ml-2 rounded bg-gray-200 px-4 py-1 font-bold text-gray-600 hover:bg-gray-300"
                    :disabled="loading"
                >
                    Cancel
                </button>
            </div>
        </form>
    </div>
</template>
