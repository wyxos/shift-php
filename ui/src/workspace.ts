import { initializeTheme } from '@shift/composables/useAppearance';
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { configureWorkspaceErrorReporting } from './error-reporting';
import './style.css';

initializeTheme();

const app = createApp(App);
configureWorkspaceErrorReporting(app, router);
app.use(router).mount('#app');
