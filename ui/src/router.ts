import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import Dashboard from './components/Dashboard.vue';
import TaskListV2 from './components/TaskListV2.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: Dashboard,
  },
  {
    path: '/tasks',
    name: 'task-list',
    component: TaskListV2
  },
  {
    path: '/tasks-v2',
    name: 'task-list-v2',
    redirect: to => ({ path: '/tasks', query: to.query }),
  },
  {
    path: '/tasks-v2/create',
    redirect: '/tasks',
  },
  {
    path: '/tasks/create',
    redirect: '/tasks',
  },
  {
    path: '/tasks/:id/edit',
    redirect: to => ({
      path: '/tasks',
      query: { ...to.query, task: String(to.params.id) },
    }),
  },
  {
    path: '/tasks/:id',
    redirect: to => ({
      path: '/tasks',
      query: { ...to.query, task: String(to.params.id) },
    }),
  }
];

const router = createRouter({
  history: createWebHistory('/shift'),
  routes
});

export default router;
