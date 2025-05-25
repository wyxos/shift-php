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
    } catch (e: any) {
        fetchError.value = e.response?.data?.error || e.message || 'Unknown error'
    } finally {
        fetchLoading.value = false
    }
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

        await axios.put(`/shift/api/tasks/${taskId}`, {
            ...editTaskData.value,
            source_url,
            environment
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
