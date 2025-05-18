<script setup lang="ts">
import { ref, onMounted } from 'vue';
import axios from 'axios';

interface Task {
  id: number;
  name: string;
  description: string;
  status: string;
  // Add other properties as needed
}

const tasks = ref<Task[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const fetchTasks = async () => {
  try {
    loading.value = true;
    const response = await axios.get('/shift/api/tasks', {
      headers: {
        'Accept': 'application/json'
      }
    });

    // With axios, we don't need to check response.ok or parse JSON
    // Axios automatically throws errors for non-2xx responses
    // and automatically parses JSON responses

    tasks.value = response.data.data || [];
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An error occurred while fetching tasks';
    console.error('Error fetching tasks:', err);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchTasks();
});
</script>

<template>
  <div class="dashboard">
    <h1>Tasks Dashboard</h1>

    <div v-if="loading" class="loading">
      Loading tasks...
    </div>

    <div v-else-if="error" class="error">
      <p>{{ error }}</p>
      <button @click="fetchTasks">Try Again</button>
    </div>

    <div v-else-if="tasks.length === 0" class="no-tasks">
      <p>No tasks found.</p>
    </div>

    <div v-else class="tasks-container">
      <div v-for="task in tasks" :key="task.id" class="task-card">
        <h3>{{ task.name }}</h3>
        <p>{{ task.description }}</p>
        <div class="task-status">
          Status: <span :class="task.status.toLowerCase()">{{ task.status }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.loading, .error, .no-tasks {
  text-align: center;
  margin: 40px 0;
}

.error {
  color: #e74c3c;
}

.tasks-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.task-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 16px;
  background-color: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.task-status {
  margin-top: 10px;
  font-weight: bold;
}

.completed {
  color: #27ae60;
}

.pending {
  color: #f39c12;
}

.failed {
  color: #e74c3c;
}
</style>
