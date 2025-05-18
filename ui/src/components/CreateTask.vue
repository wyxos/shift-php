<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

axios.defaults.withCredentials = true

const router = useRouter()
const createError = ref<string|null>(null)
const loading = ref(false)

const newTask = ref({
    title: '',
    status: 'pending',
    priority: 'medium',
})

async function createTask() {
    createError.value = null
    loading.value = true
    try {
        await axios.post('/shift/api/tasks', newTask.value)
        router.push({ name: 'task-list' })
    } catch (e: any) {
        createError.value =
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
</script>

<template>
    <div class="max-w-xl mx-auto mt-12 p-6 bg-white rounded-2xl shadow-lg">
        <div class="flex items-center justify-between mb-6">
            <h1 class="text-2xl font-bold">Create Task</h1>
            <button
                @click="cancel"
                class="px-4 py-2 rounded text-xs font-semibold bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 transition"
            >
                Cancel
            </button>
        </div>

        <form @submit.prevent="createTask" class="space-y-3">
            <div>
                <label class="block text-sm font-medium mb-1">Title</label>
                <input v-model="newTask.title" required type="text" class="w-full border rounded px-2 py-1" />
            </div>
            <div class="flex gap-4">
                <div>
                    <label class="block text-sm font-medium mb-1">Status</label>
                    <select v-model="newTask.status" class="border rounded px-2 py-1">
                        <option value="pending">Pending</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1">Priority</label>
                    <select v-model="newTask.priority" class="border rounded px-2 py-1">
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                    </select>
                </div>
            </div>
            <div v-if="createError" class="text-red-600 text-sm">{{ createError }}</div>
            <div>
                <button
                    type="submit"
                    class="mt-2 px-4 py-1 rounded bg-emerald-600 text-white font-bold hover:bg-emerald-700"
                    :disabled="loading"
                >
                    {{ loading ? 'Creating...' : 'Create' }}
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
