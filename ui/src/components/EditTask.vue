<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from 'axios'

axios.defaults.withCredentials = true

const router = useRouter()
const route = useRoute()
const editError = ref<string|null>(null)
const loading = ref(false)
const fetchLoading = ref(true)
const fetchError = ref<string|null>(null)
const attachments = ref<File[]>([])
const existingAttachments = ref<any[]>([])
const deletedAttachmentIds = ref<number[]>([])

const editTaskData = ref({
    title: '',
    description: '',
    status: 'pending',
    priority: 'medium',
})

async function fetchTask() {
    const taskId = route.params.id
    if (!taskId) {
        router.push({ name: 'task-list' })
        return
    }

    fetchLoading.value = true
    fetchError.value = null
    try {
        const response = await axios.get(`/shift/api/tasks/${taskId}`)
        const task = response.data
        editTaskData.value = {
            title: task.title,
            description: task.description || '',
            status: task.status,
            priority: task.priority,
        }

        // Load existing attachments if available
        if (task.attachments && Array.isArray(task.attachments)) {
            existingAttachments.value = task.attachments
        }
    } catch (e: any) {
        fetchError.value = e.response?.data?.error || e.message || 'Unknown error'
    } finally {
        fetchLoading.value = false
    }
}

function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement
    if (input.files) {
        attachments.value = Array.from(input.files)
    }
}

function deleteAttachment(attachmentId: number) {
    deletedAttachmentIds.value.push(attachmentId)
    existingAttachments.value = existingAttachments.value.filter(
        attachment => attachment.id !== attachmentId
    )
}

async function updateTask() {
    const taskId = route.params.id
    if (!taskId) {
        router.push({ name: 'task-list' })
        return
    }

    editError.value = null
    loading.value = true
    try {
        // Get the current URL for the source_url
        const source_url = window.location.origin

        // Get the environment from the config or default to 'production'
        const environment = import.meta.env.VITE_APP_ENV || 'production'

        // Create FormData to handle file uploads
        const formData = new FormData()

        // Add task data
        formData.append('title', editTaskData.value.title)
        formData.append('description', editTaskData.value.description)
        formData.append('status', editTaskData.value.status)
        formData.append('priority', editTaskData.value.priority)
        formData.append('source_url', source_url)
        formData.append('environment', environment)

        // Add deleted attachment IDs
        deletedAttachmentIds.value.forEach((id, index) => {
            formData.append(`deleted_attachment_ids[${index}]`, id.toString())
        })

        // Add new attachments
        attachments.value.forEach((file, index) => {
            formData.append(`attachments[${index}]`, file)
        })

        await axios.put(`/shift/api/tasks/${taskId}`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        })
        router.push({ name: 'task-list' })
    } catch (e: any) {
        editError.value =
            e.response?.data?.error ||
            e.response?.data?.message ||
            e.message ||
            'Unknown error'
    } finally {
        loading.value = false
    }
}

function cancel() {
    router.push({ name: 'task-list' })
}

onMounted(fetchTask)
</script>

<template>
    <div class="max-w-xl mx-auto mt-12 p-6 bg-white rounded-2xl shadow-lg">
        <div class="flex items-center justify-between mb-6">
            <h1 class="text-2xl font-bold">Edit Task</h1>
            <button
                @click="cancel"
                class="px-4 py-2 rounded text-xs font-semibold bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 transition"
            >
                Cancel
            </button>
        </div>

        <div v-if="fetchLoading" class="text-gray-500 text-center py-8">Loading task data...</div>
        <div v-else-if="fetchError" class="text-red-600 text-center py-8">{{ fetchError }}</div>
        <form v-else @submit.prevent="updateTask" class="space-y-3">
            <div>
                <label class="block text-sm font-medium mb-1">Title</label>
                <input v-model="editTaskData.title" required type="text" class="w-full border rounded px-2 py-1" />
            </div>
            <div>
                <label class="block text-sm font-medium mb-1">Description</label>
                <textarea
                    v-model="editTaskData.description"
                    rows="4"
                    class="w-full border rounded px-2 py-1"
                ></textarea>
            </div>
            <div class="flex gap-4">
                <div>
                    <label class="block text-sm font-medium mb-1">Status</label>
                    <select v-model="editTaskData.status" class="border rounded px-2 py-1">
                        <option value="pending">Pending</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1">Priority</label>
                    <select v-model="editTaskData.priority" class="border rounded px-2 py-1">
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                    </select>
                </div>
            </div>

            <!-- Existing Attachments -->
            <div v-if="existingAttachments.length > 0" class="mt-4">
                <label class="block text-sm font-medium mb-1">Existing Attachments</label>
                <div class="border rounded p-2 bg-gray-50">
                    <div v-for="attachment in existingAttachments" :key="attachment.id" class="flex justify-between items-center py-1">
                        <div class="flex items-center">
                            <svg class="h-4 w-4 text-gray-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clip-rule="evenodd" />
                            </svg>
                            <a :href="attachment.url" target="_blank" class="text-sm text-blue-600 hover:underline">
                                {{ attachment.original_filename }}
                            </a>
                        </div>
                        <button
                            type="button"
                            @click="deleteAttachment(attachment.id)"
                            class="text-xs text-red-600 hover:text-red-800"
                        >
                            Remove
                        </button>
                    </div>
                </div>
            </div>

            <!-- New Attachments -->
            <div class="mt-4">
                <label class="block text-sm font-medium mb-1">Add New Attachments</label>
                <input
                    type="file"
                    @change="handleFileChange"
                    multiple
                    class="w-full border rounded px-2 py-1"
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
            <div v-if="editError" class="text-red-600 text-sm">{{ editError }}</div>
            <div>
                <button
                    type="submit"
                    class="mt-2 px-4 py-1 rounded bg-amber-600 text-white font-bold hover:bg-amber-700"
                    :disabled="loading"
                >
                    {{ loading ? 'Saving...' : 'Save' }}
                </button>
                <button
                    type="button"
                    @click="cancel"
                    class="ml-2 px-4 py-1 rounded bg-gray-200 text-gray-600 font-bold hover:bg-gray-300"
                    :disabled="loading"
                >
                    Cancel
                </button>
            </div>
        </form>
    </div>
</template>
