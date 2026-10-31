import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.js'
import LiIcon from './lib/components/LiIcon.vue'
import { initTheme } from './composables/useTheme.js'
import './assets/tokens.css'
import './assets/global.css'

// Applied before mount: no light-flash on dark-theme reloads.
initTheme()

const app = createApp(App)
app.component('LiIcon', LiIcon)
app.use(router)
app.mount('#app')
