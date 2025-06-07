<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from '../axios-config'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Button } from './ui/button'

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


onMounted(fetchTask)
</script>

<template>
    <Card class="mx-auto mt-6 w-full max-w-xl">
        <CardHeader class="flex items-center justify-between">
            <CardTitle>Task Details</CardTitle>
            <Button variant="outline" size="sm" @click="goBack">Back to List</Button>
        </CardHeader>
        <CardContent>
            <div v-if="loading" class="text-gray-500 text-center py-8">Loading...</div>
            <div v-else-if="error" class="text-red-600 text-center py-8">{{ error }}</div>
            <div v-else-if="task" class="space-y-1">
                <div><span class="font-semibold">Title:</span> {{ task.title }}</div>
                <div><span class="font-semibold">Status:</span> {{ task.status }}</div>
                <div><span class="font-semibold">Priority:</span> {{ task.priority }}</div>
                <div class="mt-4">
                    <router-link
                        v-if="task"
                        :to="{ name: 'edit-task', params: { id: task.id.toString() } }"
                        class="px-3 py-1 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition inline-block text-center"
                        title="Click to edit, Ctrl+Click to open in new tab"
                    >
                        Edit Task
                    </router-link>
                </div>
            </div>
        </CardContent>
    </Card>
</template>
