<script setup lang="ts">
import { onMounted, ref } from 'vue';
import axios from 'axios';

type Task = {
    title: string;
    description: string;
};

const tasks = ref<Task[]>([]);
const newTask = ref('');
const newDescription = ref('');

const addTask = async () => {
    if (!newTask.value.trim()) return;

    try {
        const { data } = await axios.post('/shift/tasks', {
            title: newTask.value.trim(),
            description: newDescription.value.trim(),
        });

        tasks.value.push(data);
        newTask.value = '';
        newDescription.value = '';
    } catch (err) {
        console.error('Failed to add task', err);
    }
};

onMounted(async () => {
    const { data } = await axios.get('/shift/tasks');
    tasks.value = data.data;
});
</script>

<template>
    <div class="mx-auto max-w-4xl p-6">
        <h1 class="mb-4 text-2xl font-bold">Task List</h1>
        <div class="mb-4">
            <input
                v-model="newTask"
                type="text"
                placeholder="Enter a new task"
                class="mb-2 w-full rounded border border-gray-300 px-4 py-2"
            />
            <textarea
                v-model="newDescription"
                placeholder="Enter a description"
                class="mb-2 w-full rounded border border-gray-300 px-4 py-2"
            ></textarea>
            <button
                @click="addTask"
                class="mt-2 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
            >
                Add Task
            </button>
        </div>
        <ul class="space-y-2">
            <li
                v-for="(task, index) in tasks"
                :key="index"
                class="rounded bg-white p-4 shadow"
            >
                <p><strong>Title:</strong> {{ task.title }}</p>
                <p><strong>Description:</strong> {{ task.description }}</p>
            </li>
        </ul>
    </div>
</template>
