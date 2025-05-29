<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import axios from '../axios-config';

const router = useRouter();
const createError = ref<string | null>(null);
const loading = ref(false);
const isUploading = ref(false);
const uploadError = ref<string | null>(null);
const uploadedFiles = ref<any[]>([]);
const tempIdentifier = ref(Date.now().toString());

const newTask = ref({
    title: '',
    description: '',
    priority: 'medium',
});

async function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    isUploading.value = true;
    uploadError.value = null;

    try {
        const formData = new FormData();
        formData.append('temp_identifier', tempIdentifier.value);

        // Add all files to the formData
        Array.from(input.files).forEach((file, index) => {
            formData.append(`attachments[${index}]`, file);
        });

        // Upload files immediately
        const response = await axios.post('/shift/api/attachments/upload-multiple', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });

        // Add the uploaded files to our list
        if (response.data.files && Array.isArray(response.data.files)) {
            uploadedFiles.value = [...uploadedFiles.value, ...response.data.files];
        }
    } catch (error: any) {
        uploadError.value = error.response?.data?.message || 'Error uploading files';
        console.error('Upload error:', error);
    } finally {
        isUploading.value = false;
        // Clear the file input
        input.value = '';
    }
}

// Remove a temporary file
async function removeFile(file: any) {
    try {
        await axios.delete('/shift/api/attachments/remove-temp', {
            params: { path: file.path }
        });

        // Remove from the list
        uploadedFiles.value = uploadedFiles.value.filter(f => f.path !== file.path);
    } catch (error) {
        console.error('Error removing file:', error);
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

        // Create the payload with task data and temp_identifier for attachments
        const payload = {
            title: newTask.value.title,
            description: newTask.value.description,
            priority: newTask.value.priority,
            source_url,
            environment,
            temp_identifier: uploadedFiles.value.length > 0 ? tempIdentifier.value : undefined
        };

        // Create the task using authenticated user information
        await axios.post('/shift/api/tasks', payload);

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
            <div>
                <label class="mb-1 block text-sm font-medium">Priority</label>
                <select v-model="newTask.priority" class="rounded border px-2 py-1">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                </select>
            </div>
            <div>
                <label class="mb-1 block text-sm font-medium">Attachments</label>
                <input
                    type="file"
                    @change="handleFileChange"
                    multiple
                    class="w-full rounded border px-2 py-1"
                    :disabled="isUploading"
                />

                <!-- Upload error message -->
                <div v-if="uploadError" class="text-red-500 text-sm mt-1">{{ uploadError }}</div>

                <!-- Loading indicator -->
                <div v-if="isUploading" class="text-blue-500 text-sm mt-1">Uploading files...</div>

                <!-- List of uploaded files -->
                <div v-if="uploadedFiles.length > 0" class="mt-3">
                    <p class="text-sm text-gray-600">Uploaded files:</p>
                    <ul class="mt-2 divide-y divide-gray-200 border border-gray-200 rounded-md">
                        <li v-for="file in uploadedFiles" :key="file.path" class="flex items-center justify-between py-2 px-3 text-sm">
                            <div class="flex items-center">
                                <svg class="h-5 w-5 text-gray-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clip-rule="evenodd" />
                                </svg>
                                <span class="truncate">{{ file.original_filename }}</span>
                            </div>
                            <button
                                type="button"
                                @click="removeFile(file)"
                                class="text-red-600 hover:text-red-900"
                                :disabled="loading"
                            >
                                Remove
                            </button>
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
