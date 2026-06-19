import { initializeTheme } from '@shift/composables/useAppearance';
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import './style.css';

initializeTheme();

createApp(App).use(router).mount('#app');
