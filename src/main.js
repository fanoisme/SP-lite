import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.js'
import LiIcon from './lib/components/LiIcon.vue'
import './assets/tokens.css'
import './assets/global.css'

const app = createApp(App)
app.component('LiIcon', LiIcon)
app.use(router)
app.mount('#app')
