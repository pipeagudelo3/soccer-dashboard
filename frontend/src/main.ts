import './assets/main.css';

import { createPinia } from 'pinia';
import { createApp } from 'vue';

import App from './App.vue';
import { configurePinia } from './PiniaConfig.js';
import router from './router';
import { registerSessionNavigation } from '@/router/sessionNavigation.js';
import { AuthService } from './services/AuthService.js';

const app = createApp(App);
const pinia = createPinia();

configurePinia(pinia);

app.use(pinia);
void AuthService.reconcileSession();
app.use(router);
registerSessionNavigation(router);

app.mount('#app');
