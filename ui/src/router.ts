import { createRouter, createWebHistory } from 'vue-router';
import Dashboard from './components/Dashboard.vue';
import HelloWorld from './components/HelloWorld.vue';

const routes = [
  {
    path: '/',
    name: 'home',
    component: HelloWorld,
    props: { msg: 'Vite + Vue' }
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: Dashboard
  }
];

const router = createRouter({
  history: createWebHistory('/shift'),
  routes
});

export default router;
