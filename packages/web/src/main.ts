/** App entry point — initializes Vue with router, Pinia, and Nuxt UI. */
import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ui from '@nuxt/ui/vue-plugin'

import App from '@/App.vue'
import router from '@/router'
import '@/icons' // registers Simple Icons subset for i-simple-icons:* usage

const pinia = createPinia()
const app = createApp(App)

app.use(router)
app.use(pinia)
app.use(ui)

app.mount('#app')

// Register service worker for PWA installability
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
}
