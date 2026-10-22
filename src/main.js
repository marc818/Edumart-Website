import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// Tailwind (utilities only -- see index.css)
import './index.css'

// Global styles -- order matters (same cascade order as the original app)
import './assets/styles/admin.css'
import './assets/styles/student.css'
import './assets/styles/logout-modal.css'
import './assets/styles/lockers.css'
import './assets/styles/home.css'
import './assets/styles/auth.css'
import './assets/styles/responsive.css'
import './assets/styles/redesign.css'

createApp(App).use(createPinia()).use(router).mount('#app')
