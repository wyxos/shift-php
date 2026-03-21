import { createApp } from 'vue';
import { initializeTheme } from '@shift/composables/useAppearance';
import './style.css';
import App from './App.vue';
import router from './router';

initializeTheme();

createApp(App).use(router).mount('#app');
