import { createRouter, createWebHistory } from 'vue-router';
import TaskList from './components/TaskList.vue';
import TaskListV2 from './components/TaskListV2.vue';
import TaskCreateV2 from './components/TaskCreateV2.vue';
import TaskDetails from './components/TaskDetails.vue';
import CreateTask from './components/CreateTask.vue';
import EditTask from './components/EditTask.vue';

const routes = [
  {
    path: '/',
    name: 'task-list',
    component: TaskList
  },
  {
    path: '/tasks-v2',
    name: 'task-list-v2',
    component: TaskListV2
  },
  {
    path: '/tasks-v2/create',
    name: 'create-task-v2',
    component: TaskCreateV2
  },
  {
    path: '/tasks/create',
    name: 'create-task',
    component: CreateTask
  },
  {
    path: '/tasks/:id/edit',
    name: 'edit-task',
    component: EditTask
  },
  {
    path: '/tasks/:id',
    name: 'task-details',
    component: TaskDetails
  }
];

const router = createRouter({
  history: createWebHistory('/shift'),
  routes
});

export default router;
