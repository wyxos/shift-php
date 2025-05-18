<script setup lang="ts">
import { ref, onMounted } from 'vue'

type Task = {
    id: number
    title: string
    status: string
    priority: string
}

const tasks = ref<Task[]>([])
const loading = ref(true)
const error = ref<string|null>(null)

async function fetchTasks() {
    loading.value = true
    error.value = null
    try {
        const response = await fetch('/shift/api/tasks', { credentials: 'include' })
        if (!response.ok) throw new Error('Failed to load tasks')
        const result = await response.json()
        // Get the paginated "data" array
        tasks.value = result.data
    } catch (e: any) {
        error.value = e.message || 'Unknown error'
    } finally {
        loading.value = false
    }
}

onMounted(fetchTasks)
</script>

<template>
    <div class="max-w-xl mx-auto mt-12 p-6 bg-white rounded-2xl shadow-lg">
        <h1 class="text-2xl font-bold mb-6">Tasks</h1>

        <div v-if="loading" class="text-gray-500 text-center py-8">Loading...</div>
        <div v-else-if="error" class="text-red-600 text-center py-8">{{ error }}</div>

        <ul v-else class="divide-y divide-gray-100">
            <li
                v-for="task in tasks"
                :key="task.id"
                class="flex flex-col sm:flex-row sm:items-center sm:gap-6 py-3"
            >
                <span class="flex-1 text-lg font-medium">{{ task.title }}</span>
                <span class="inline-block text-xs px-2 py-1 rounded-full"
                      :class="task.status === 'pending'
            ? 'bg-yellow-50 text-yellow-600 border border-yellow-200'
            : task.status === 'completed'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-gray-100 text-gray-500 border border-gray-200'
          "
                >{{ task.status }}</span>
                <span class="ml-2 text-xs uppercase text-gray-400">{{ task.priority }}</span>
            </li>
        </ul>
    </div>
</template>
