<template>
  <div class="nf">
    <LiMascot :size="88" animated label="SP-lite mascot looking sorry" />
    <p class="nf__code">404</p>
    <h1 class="nf__title">Page not found</h1>
    <p class="nf__text">The page you're looking for doesn't exist or may have moved.</p>
    <LiButton @click="goHome">Back to dashboard</LiButton>
  </div>
</template>

<script setup>
import LiMascot from '../../../lib/components/LiMascot.vue'
import LiButton from '../../../lib/components/LiButton.vue'
import { firstAccessibleRoute } from '../../../router/index.js'
import { useRouter } from 'vue-router'

const router = useRouter()

function goHome() {
  router.push(firstAccessibleRoute())
}
</script>

<style scoped>
/* L7 status page (errors.html): centred 620, the mascot, the code, one sentence, one action. */
.nf {
  min-height: 60vh;
  display: grid;
  justify-items: center;
  align-content: center;
  gap: var(--space-3);
  text-align: center;
  max-width: 620px;
  margin: 0 auto;
  padding: var(--space-12) var(--space-4);
}

.nf__code {
  margin: var(--space-4) 0 0;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--color-text-muted);
}

.nf__title {
  margin: 0;
  font-size: var(--text-lg);
  line-height: var(--leading-lg);
  font-weight: 600;
  color: var(--color-text-strong);
}

.nf__text {
  margin: 0 0 var(--space-4);
  color: var(--color-text-muted);
}
</style>
