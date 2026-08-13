<template>
  <div class="ddlayout">
    <DdSidebar />
    <main class="ddlayout__main">
      <RouterView v-slot="{ Component }">
        <Transition name="dd-fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
  </div>
</template>

<script setup>
import { RouterView } from 'vue-router'
import DdSidebar from '../components/DdSidebar.vue'
</script>

<style scoped>
.ddlayout {
  max-width: 1440px; margin: 0 auto;
  padding: var(--space-lg, 24px) var(--space-xl, 32px);
  display: flex; align-items: flex-start; gap: var(--space-lg, 24px);
}
.ddlayout__main { flex: 1; min-width: 0; }

.dd-fade-enter-active { transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
.dd-fade-leave-active { transition: all 0.15s ease-in; }
.dd-fade-enter-from { opacity: 0; transform: translateY(8px); }
.dd-fade-leave-to { opacity: 0; }

@media (max-width: 900px) {
  .ddlayout { flex-direction: column; padding: var(--space-md, 16px); gap: var(--space-md, 16px); }
  .ddlayout__main { width: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  .dd-fade-enter-active, .dd-fade-leave-active { transition-duration: 0.01ms; }
}
</style>
