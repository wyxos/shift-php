<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

axios.defaults.withCredentials = true

type Task = {
    id: number
    title: string
    status: string
    priority: string
}

const router = useRouter()
const tasks = ref<Task[]>([])
const loading = ref(true)
const error = ref<string|null>(null)

async function fetchTasks() {
    loading.value = true
    error.value = null
    try {
        const response = await axios.post('/shift/api/tasks/list')
        tasks.value = response.data.data
    } catch (e: any) {
        error.value = e.response?.data?.error || e.message || 'Unknown error'
    } finally {
        loading.value = false
    }
}

function viewTask(taskId: number) {
    router.push({ name: 'task-details', params: { id: taskId.toString() } })
}

function editTask(taskId: number) {
    router.push({ name: 'edit-task', params: { id: taskId.toString() } })
}

onMounted(fetchTasks)
</script>

<template>
    <div class="max-w-xl mx-auto mt-12 p-6 bg-white rounded-2xl shadow-lg">
        <div class="flex items-center justify-between mb-6">
            <h1 class="text-2xl font-bold">Tasks</h1>
            <button
                @click="router.push({ name: 'create-task' })"
                class="px-4 py-2 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition"
            >
                + Create
            </button>
        </div>

        <div v-if="loading" class="text-gray-500 text-center py-8">Loading...</div>
        <div v-else-if="error" class="text-red-600 text-center py-8">{{ error }}</div>

        <ul v-else class="divide-y divide-gray-100">
            <li
                v-for="task in tasks"
                :key="task.id"
                class="flex flex-col sm:flex-row sm:items-center sm:gap-4 py-3"
            >
                <span class="flex-1 text-lg font-medium">{{ task.title }}</span>
                <span class="inline-block text-xs px-2 py-1 rounded-full"
                      :class="task.status === 'pending'
            ? 'bg-yellow-50 text-yellow-600 border border-yellow-200'
            : task.status === 'completed'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-gray-100 text-gray-500 border border-gray-200'"
                >{{ task.status }}</span>
                <span class="ml-2 text-xs uppercase text-gray-400">{{ task.priority }}</span>
                <button
                    @click="editTask(task.id)"
                    class="ml-2 mt-2 sm:mt-0 px-3 py-1 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition"
                >
                    Edit
                </button>
            </li>
        </ul>
    </div>
</template>
