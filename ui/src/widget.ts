import { createApp } from 'vue';
import WidgetApp from './widget/WidgetApp.vue';
import './widget/widget.css';

const runtimeConfig = window.shiftWidgetConfig;
const rootId = 'shift-widget-root';

if (runtimeConfig && !document.getElementById(rootId)) {
    const root = document.createElement('div');
    root.id = rootId;
    document.body.appendChild(root);

    createApp(WidgetApp, { config: runtimeConfig }).mount(root);
}
