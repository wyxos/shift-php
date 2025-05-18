<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'

axios.defaults.withCredentials = true

type Task = {
    id: number
    title: string
    status: string
    priority: string
}

const tasks = ref<Task[]>([])
const loading = ref(true)
const error = ref<string|null>(null)
const selectedTask = ref<Task|null>(null)
const creating = ref(false)
const createError = ref<string|null>(null)

const newTask = ref({
    title: '',
    status: 'pending',
    priority: 'medium',
})

const editingTask = ref<Task|null>(null)
const editError = ref<string|null>(null)
const editTaskData = ref({
    title: '',
    status: 'pending',
    priority: 'medium',
})

async function fetchTasks() {
    loading.value = true
    error.value = null
    try {
        const response = await axios.get('/shift/api/tasks')
        tasks.value = response.data.data
    } catch (e: any) {
        error.value = e.response?.data?.error || e.message || 'Unknown error'
    } finally {
        loading.value = false
    }
}

async function createTask() {
    createError.value = null
    try {
        await axios.post('/shift/api/tasks', newTask.value)
        creating.value = false
        newTask.value = { title: '', status: 'pending', priority: 'medium' }
        await fetchTasks()
    } catch (e: any) {
        createError.value =
            e.response?.data?.error ||
            e.response?.data?.message ||
            e.message ||
            'Unknown error'
    }
}

function startEdit(task: Task) {
    editingTask.value = task
    editTaskData.value = {
        title: task.title,
        status: task.status,
        priority: task.priority,
    }
    editError.value = null
}

async function updateTask() {
    if (!editingTask.value) return
    editError.value = null
    try {
        await axios.put(`/shift/api/tasks/${editingTask.value.id}`, editTaskData.value)
        editingTask.value = null
        await fetchTasks()
    } catch (e: any) {
        editError.value =
            e.response?.data?.error ||
            e.response?.data?.message ||
            e.message ||
            'Unknown error'
    }
}

onMounted(fetchTasks)
</script>

<template>
    <div class="max-w-xl mx-auto mt-12 p-6 bg-white rounded-2xl shadow-lg">
        <div class="flex items-center justify-between mb-6">
            <h1 class="text-2xl font-bold">Tasks</h1>
            <button
                @click="creating = true"
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
                    @click="selectedTask = task"
                    class="ml-4 mt-2 sm:mt-0 px-3 py-1 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition"
                >
                    View
                </button>
                <button
                    @click="startEdit(task)"
                    class="ml-2 mt-2 sm:mt-0 px-3 py-1 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition"
                >
                    Edit
                </button>
            </li>
        </ul>

        <!-- Task details panel (from previous step) -->
        <div v-if="selectedTask" class="mt-8 p-4 rounded-xl bg-gray-50 border border-gray-200">
            <div class="flex justify-between items-center mb-2">
                <h2 class="text-lg font-bold">Task Details</h2>
                <button @click="selectedTask = null" class="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <div><span class="font-semibold">Title:</span> {{ selectedTask.title }}</div>
            <div><span class="font-semibold">Status:</span> {{ selectedTask.status }}</div>
            <div><span class="font-semibold">Priority:</span> {{ selectedTask.priority }}</div>
        </div>

        <!-- Create form (modal style, but inline) -->
        <div v-if="creating" class="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
            <div class="flex justify-between items-center mb-2">
                <h2 class="font-bold text-lg">Create Task</h2>
                <button @click="creating = false" class="text-gray-400 hover:text-gray-600">&times;</button>
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
                    <button type="submit" class="mt-2 px-4 py-1 rounded bg-emerald-600 text-white font-bold hover:bg-emerald-700">Create</button>
                </div>
            </form>
        </div>

        <div v-if="editingTask" class="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
            <div class="flex justify-between items-center mb-2">
                <h2 class="font-bold text-lg">Edit Task</h2>
                <button @click="editingTask = null" class="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <form @submit.prevent="updateTask" class="space-y-3">
                <div>
                    <label class="block text-sm font-medium mb-1">Title</label>
                    <input v-model="editTaskData.title" required type="text" class="w-full border rounded px-2 py-1" />
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
                    <button type="submit" class="mt-2 px-4 py-1 rounded bg-amber-600 text-white font-bold hover:bg-amber-700">Save</button>
                    <button type="button" @click="editingTask = null" class="ml-2 px-4 py-1 rounded bg-gray-200 text-gray-600 font-bold hover:bg-gray-300">Cancel</button>
                </div>
            </form>
        </div>
    </div>
</template>
