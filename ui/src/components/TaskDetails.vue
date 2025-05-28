<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from '../axios-config'

type Task = {
    id: number
    title: string
    status: string
    priority: string
}

const router = useRouter()
const route = useRoute()
const task = ref<Task | null>(null)
const loading = ref(true)
const error = ref<string|null>(null)

async function fetchTask() {
    const taskId = route.params.id
    if (!taskId) {
        router.push({ name: 'task-list' })
        return
    }

    loading.value = true
    error.value = null
    try {
        const response = await axios.get(`/shift/api/tasks/${taskId}`)
        task.value = response.data.data
    } catch (e: any) {
        error.value = e.response?.data?.error || e.message || 'Unknown error'
    } finally {
        loading.value = false
    }
}

function goBack() {
    router.push({ name: 'task-list' })
}

function editTask() {
    if (task.value) {
        router.push({ name: 'edit-task', params: { id: task.value.id.toString() } })
    }
}

onMounted(fetchTask)
</script>

<template>
    <div class="max-w-xl mx-auto mt-12 p-6 bg-white rounded-2xl shadow-lg">
        <div class="flex items-center justify-between mb-6">
            <h1 class="text-2xl font-bold">Task Details</h1>
            <button
                @click="goBack"
                class="px-4 py-2 rounded text-xs font-semibold bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 transition"
            >
                Back to List
            </button>
        </div>

        <div v-if="loading" class="text-gray-500 text-center py-8">Loading...</div>
        <div v-else-if="error" class="text-red-600 text-center py-8">{{ error }}</div>
        <div v-else-if="task" class="p-4 rounded-xl bg-gray-50 border border-gray-200">
            <div><span class="font-semibold">Title:</span> {{ task.title }}</div>
            <div><span class="font-semibold">Status:</span> {{ task.status }}</div>
            <div><span class="font-semibold">Priority:</span> {{ task.priority }}</div>
            <div class="mt-4">
                <button
                    @click="editTask"
                    class="px-3 py-1 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition"
                >
                    Edit Task
                </button>
            </div>
        </div>
    </div>
</template>
