<template>
  <div class="landing">
    <header class="landing__header">
      <LiLogo size="sm" :animate="true" :show-subtitle="true" />
      <LiButton variant="secondary" size="sm" @click="goLogin">Sign In</LiButton>
    </header>

    <section class="landing__hero">
      <span class="landing__badge">Public · Free · No server required</span>
      <h1 class="landing__title">
        Tools for <span class="landing__title-accent">QRIS, templates, and video</span> — now with accounts
      </h1>
      <p class="landing__subtitle">
        SP-lite is a lightweight toolbox derived from SO-Platform. Sign in to save your work
        across devices, or ask an admin to add your account.
      </p>
      <div class="landing__cta-group">
        <LiButton size="lg" @click="goLogin">Get Started</LiButton>
        <LiButton size="lg" variant="ghost" @click="scrollToFeatures">Learn More</LiButton>
      </div>
    </section>

    <section id="features" class="landing__features">
      <LiCard v-for="f in features" :key="f.title" hover class="landing__feature-card">
        <div class="landing__feature-icon">
          <span class="material-symbols-outlined">{{ f.icon }}</span>
        </div>
        <h3 class="landing__feature-title">{{ f.title }}</h3>
        <p class="landing__feature-desc">{{ f.desc }}</p>
      </LiCard>
    </section>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import LiLogo from '../../../lib/components/LiLogo.vue'
import LiButton from '../../../lib/components/LiButton.vue'
import LiCard from '../../../lib/components/LiCard.vue'

const router = useRouter()

const features = [
  { icon: 'qr_code_2', title: 'QRIS Tools', desc: 'Generate and parse EMVCo QRIS codes, client-side.' },
  { icon: 'auto_awesome', title: 'Template Tools', desc: 'Convert and preview DOCX → HTML/FTL templates.' },
  { icon: 'movie', title: 'Video Frames', desc: 'Extract distinct frames from a video, canvas-based.' },
  { icon: 'admin_panel_settings', title: 'Admin Panel', desc: 'Manage user roles and access from one place.' },
]

function goLogin() {
  router.push({ name: 'login' })
}

function scrollToFeatures() {
  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
}
</script>

<style scoped>
.landing {
  max-width: 1080px;
  margin: 0 auto;
  padding: var(--space-xl, 24px) var(--space-l, 16px) var(--space-3xl, 48px);
  display: flex;
  flex-direction: column;
  gap: var(--space-3xl, 48px);
}

.landing__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.landing__hero {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-l, 16px);
  padding: var(--space-3xl, 48px) 0;
}

.landing__badge {
  display: inline-flex;
  padding: 6px 14px;
  border-radius: var(--radius-pill, 999px);
  background: var(--color-yellow-100, #FFF3D6);
  color: var(--color-orange-500, #FF3000);
  font-size: var(--text-xs, 14px);
  font-weight: 600;
}

.landing__title {
  font-size: clamp(28px, 5vw, 44px);
  font-weight: 800;
  line-height: 1.15;
  color: var(--color-gray-900, #1a1a2e);
  max-width: 720px;
  margin: 0;
}

.landing__title-accent {
  background: linear-gradient(90deg, #FFAF03, #FF6B00);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.landing__subtitle {
  max-width: 560px;
  color: var(--color-gray-600, #808080);
  font-size: var(--text-sm, 16px);
  line-height: 1.6;
  margin: 0;
}

.landing__cta-group {
  display: flex;
  gap: var(--space-m, 12px);
  flex-wrap: wrap;
  justify-content: center;
}

.landing__features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-l, 16px);
}

.landing__feature-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-s, 8px);
}

.landing__feature-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm, 12px);
  background: var(--color-yellow-100, #FFF3D6);
  color: var(--color-orange-400, #FF6B00);
  display: flex;
  align-items: center;
  justify-content: center;
}

.landing__feature-title {
  margin: 0;
  font-size: var(--text-sm, 16px);
  font-weight: 700;
  color: var(--color-gray-900, #1a1a2e);
}

.landing__feature-desc {
  margin: 0;
  font-size: var(--text-xs, 14px);
  color: var(--color-gray-600, #808080);
  line-height: 1.5;
}

</style>
