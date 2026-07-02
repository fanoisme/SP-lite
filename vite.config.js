import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// GitHub Pages serves this repo at https://<user>.github.io/SP-lite/
export default defineConfig({
  base: '/SP-lite/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
      '@lib': resolve(import.meta.dirname, 'src/lib'),
    }
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/vue/') || id.includes('node_modules/vue-router/')) {
            return 'vendor-vue'
          }
          if (id.includes('node_modules/docx-preview/') || id.includes('node_modules/jszip/')) {
            return 'vendor-docx-preview'
          }
        }
      }
    }
  }
})
