<template>
  <div class="landing">
    <!-- Mesh Background -->
    <div class="landing__mesh" aria-hidden="true">
      <div class="landing__orb landing__orb--1"></div>
      <div class="landing__orb landing__orb--2"></div>
      <div class="landing__orb landing__orb--3"></div>
    </div>

    <!-- Header -->
    <header class="landing__header">
      <LiLogo size="sm" :animate="true" :show-subtitle="false" />
      <router-link to="/login" class="landing__login-btn">
        <span class="landing__login-btn-text">Sign In</span>
        <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
      </router-link>
    </header>

    <!-- Hero -->
    <section class="landing__hero">
      <div class="landing__hero-badge">
        <span class="material-symbols-outlined" aria-hidden="true">bolt</span>
        <span>Public · Free · No server required</span>
      </div>

      <h1 class="landing__hero-title">
        <span class="landing__hero-line landing__hero-line--1">Tools for QRIS,</span>
        <span class="landing__hero-line landing__hero-line--2">templates & video</span>
        <span class="landing__hero-gradient">now with accounts</span>
      </h1>

      <p class="landing__hero-desc">
        SP-lite is a lightweight toolbox derived from SO-Platform. Sign in to save your
        work across devices, or ask an admin to add your account.
      </p>

      <div class="landing__hero-actions">
        <router-link to="/login" class="landing__cta-primary">
          <span>Get Started</span>
          <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
        </router-link>
        <a href="#features" class="landing__cta-secondary">
          Learn More
        </a>
      </div>
    </section>

    <!-- Features -->
    <section id="features" class="landing__features">
      <h2 class="landing__section-title">What's Inside</h2>
      <div class="landing__feature-grid">
        <div
          v-for="(feature, index) in features"
          :key="feature.title"
          class="landing__feature-card"
          :style="{ '--reveal-delay': `${index * 100}ms` }"
        >
          <div class="landing__feature-icon" :class="`landing__feature-icon--${feature.color}`">
            <span class="material-symbols-outlined" aria-hidden="true">{{ feature.icon }}</span>
          </div>
          <h3 class="landing__feature-title">{{ feature.title }}</h3>
          <p class="landing__feature-desc">{{ feature.desc }}</p>
          <span class="landing__feature-arrow material-symbols-outlined" aria-hidden="true">arrow_forward</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import LiLogo from '../../../lib/components/LiLogo.vue'

const features = [
  {
    icon: 'qr_code_2',
    color: 'green',
    title: 'QRIS Tools',
    desc: 'Generate and parse EMVCo QRIS codes, client-side. Validate CRC and inspect tags.',
  },
  {
    icon: 'auto_awesome',
    color: 'yellow',
    title: 'Template Tools',
    desc: 'Convert and preview DOCX to HTML/FTL templates, right in the browser.',
  },
  {
    icon: 'videocam',
    color: 'blue',
    title: 'Video Frames',
    desc: 'Extract distinct frames from a video. Smart filtering skips similar frames.',
  },
  {
    icon: 'admin_panel_settings',
    color: 'yellow',
    title: 'Admin Panel',
    desc: 'Manage user roles and access from one place, backed by Supabase.',
  },
]

let observer = null

onMounted(() => {
  const cards = document.querySelectorAll('.landing__feature-card')

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('landing__feature-card--visible')
          observer.unobserve(entry.target)
        }
      })
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  )

  cards.forEach((card) => observer.observe(card))
})

onUnmounted(() => {
  if (observer) {
    observer.disconnect()
    observer = null
  }
})
</script>

<style scoped>
.landing {
  position: relative;
  min-height: 100vh;
  overflow-x: hidden;
  background: var(--color-page-bg, #E6E6E6);
  scroll-behavior: smooth;
}

/* ── Mesh Background ── */
.landing__mesh {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: var(--z-base, 0);
}

.landing__orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(30px);
  opacity: 0.3;
  animation: landing-drift 25s cubic-bezier(0.4, 0, 0.2, 1) infinite alternate;
}

.landing__orb--1 {
  width: clamp(300px, 50vw, 600px);
  height: clamp(300px, 50vw, 600px);
  background: radial-gradient(circle, var(--color-yellow-100, #FFF3D6), transparent 70%);
  top: -15%;
  right: -10%;
  animation-duration: 22s;
}

.landing__orb--2 {
  width: clamp(250px, 40vw, 500px);
  height: clamp(250px, 40vw, 500px);
  background: radial-gradient(circle, var(--color-blue-100, #E6E6FF), transparent 70%);
  bottom: -10%;
  left: 10%;
  animation-duration: 28s;
  animation-delay: -5s;
}

.landing__orb--3 {
  width: clamp(200px, 35vw, 400px);
  height: clamp(200px, 35vw, 400px);
  background: radial-gradient(circle, var(--color-yellow-100, #FFF3D6), transparent 70%);
  top: 50%;
  left: 50%;
  opacity: 0.2;
  animation-duration: 32s;
  animation-delay: -10s;
}

@keyframes landing-drift {
  0% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -20px) scale(1.05); }
  66% { transform: translate(-20px, 15px) scale(0.95); }
  100% { transform: translate(10px, -10px) scale(1.02); }
}

/* ── Header ── */
.landing__header {
  position: relative;
  z-index: var(--z-content, 10);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-l) var(--space-xl);
  animation: landing-fade-in 800ms var(--ease-smooth) both;
}

.landing__login-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: var(--space-s) var(--space-xl);
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid var(--glass-border);
  color: var(--color-gray-800);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  transition:
    transform 300ms var(--ease-smooth),
    background 300ms var(--ease-smooth),
    box-shadow 300ms var(--ease-smooth);
}

.landing__login-btn:hover {
  background: rgba(255, 255, 255, 0.85);
  color: var(--color-on-surface);
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}

.landing__login-btn:active {
  transform: scale(0.97);
}

.landing__login-btn .material-symbols-outlined {
  font-size: 16px;
  transition: transform 300ms var(--ease-smooth);
}

.landing__login-btn:hover .material-symbols-outlined {
  transform: translateX(3px);
}

/* ── Hero ── */
.landing__hero {
  position: relative;
  z-index: var(--z-content, 10);
  max-width: 720px;
  margin: 0 auto;
  padding: clamp(40px, 8vw, 100px) var(--space-xl) clamp(32px, 5vw, 72px);
  text-align: center;
}

.landing__hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid var(--glass-border);
  font-size: 12px;
  font-weight: 600;
  color: var(--color-on-surface-variant);
  margin-bottom: clamp(16px, 3vw, 32px);
  animation: landing-fade-in 800ms var(--ease-smooth) 100ms both;
}

.landing__hero-badge .material-symbols-outlined {
  font-size: 16px;
  color: var(--color-warning, #FF6B00);
}

.landing__hero-title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(32px, 6vw, 60px);
  line-height: 1.1;
  letter-spacing: -1.5px;
  color: var(--color-on-surface);
  margin: 0 0 clamp(12px, 2vw, 28px);
}

.landing__hero-line {
  display: block;
}

.landing__hero-line--1 {
  animation: landing-hero-in 800ms var(--ease-smooth) 200ms both;
}

.landing__hero-line--2 {
  animation: landing-hero-in 800ms var(--ease-smooth) 350ms both;
}

.landing__hero-gradient {
  display: block;
  background: linear-gradient(
    105deg,
    #FFBC25 0%,
    #FF6B00 25%,
    #FFBC25 50%,
    #FF6B00 75%,
    #FFBC25 100%
  );
  background-size: 250% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation:
    landing-hero-in 800ms var(--ease-smooth) 500ms both,
    landing-shimmer 6s var(--ease-smooth) infinite;
}

@keyframes landing-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: -100% 50%; }
}

@keyframes landing-hero-in {
  from {
    opacity: 0;
    transform: translateY(30px);
    filter: blur(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0);
  }
}

.landing__hero-desc {
  font-size: clamp(15px, 2vw, 18px);
  line-height: 1.6;
  color: var(--color-on-surface-variant);
  margin: 0 auto clamp(24px, 3.5vw, 44px);
  max-width: 480px;
  animation: landing-fade-in 800ms var(--ease-smooth) 650ms both;
}

.landing__hero-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(8px, 1.5vw, 16px);
  animation: landing-fade-in 800ms var(--ease-smooth) 800ms both;
}

.landing__cta-primary {
  display: inline-flex;
  align-items: center;
  gap: var(--space-s);
  padding: clamp(10px, 1.2vw, 16px) clamp(20px, 2.5vw, 36px);
  border-radius: var(--radius-pill);
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(13px, 1.3vw, 16px);
  text-decoration: none;
  box-shadow: var(--shadow-glow);
  transition:
    transform 350ms var(--ease-spring),
    background 300ms var(--ease-out),
    box-shadow 400ms var(--ease-out);
}

.landing__cta-primary:hover {
  background: var(--cta-primary-hover);
  box-shadow: var(--shadow-glow-intense);
  transform: translateY(-4px);
}

.landing__cta-primary:active {
  transform: scale(0.97);
  transition-duration: 120ms;
}

.landing__cta-primary .material-symbols-outlined {
  font-size: 18px;
  transition: transform 300ms var(--ease-smooth);
}

.landing__cta-primary:hover .material-symbols-outlined {
  transform: translateX(4px);
}

.landing__cta-secondary {
  display: inline-flex;
  align-items: center;
  padding: clamp(10px, 1.2vw, 16px) clamp(18px, 2vw, 32px);
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid var(--glass-border);
  color: var(--color-gray-700);
  font-weight: 600;
  font-size: clamp(13px, 1.3vw, 16px);
  text-decoration: none;
  transition:
    transform 300ms var(--ease-smooth),
    background 300ms var(--ease-smooth),
    box-shadow 300ms var(--ease-smooth);
}

.landing__cta-secondary:hover {
  background: rgba(255, 255, 255, 0.75);
  color: var(--color-on-surface);
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}

.landing__cta-secondary:active {
  transform: scale(0.97);
  transition-duration: 120ms;
}

/* ── Features ── */
.landing__features {
  position: relative;
  z-index: var(--z-content, 10);
  max-width: 900px;
  margin: 0 auto;
  padding: clamp(32px, 4vw, 48px) var(--space-xl) clamp(60px, 8vw, 100px);
}

.landing__section-title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(20px, 3vw, 30px);
  color: var(--color-on-surface);
  text-align: center;
  margin: 0 0 clamp(24px, 3.5vw, 40px);
  letter-spacing: -0.5px;
}

.landing__feature-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: clamp(12px, 1.5vw, 22px);
}

.landing__feature-card {
  position: relative;
  padding: clamp(20px, 2.5vw, 28px) clamp(16px, 2vw, 24px);
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  will-change: transform, opacity;
  opacity: 0;
  transform: translateY(32px);
  transition:
    opacity 700ms var(--ease-smooth),
    transform 700ms var(--ease-smooth),
    box-shadow 400ms var(--ease-out);
  transition-delay: var(--reveal-delay, 0ms);
  cursor: default;
  overflow: hidden;
}

.landing__feature-card--visible {
  opacity: 1;
  transform: translateY(0);
}

.landing__feature-card:hover {
  transform: translateY(-6px);
  box-shadow: var(--shadow-lg);
}

.landing__feature-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-l);
  position: relative;
  overflow: hidden;
}

.landing__feature-icon::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  opacity: 0.12;
  transition: opacity 400ms var(--ease-out);
}

.landing__feature-card:hover .landing__feature-icon::before {
  opacity: 0.2;
}

.landing__feature-icon .material-symbols-outlined {
  font-size: 20px;
  position: relative;
  z-index: 1;
}

.landing__feature-icon--yellow {
  background: linear-gradient(135deg, var(--color-yellow-100), var(--color-yellow-200));
  color: var(--color-on-warning-container);
  box-shadow: 0 4px 12px rgba(249, 199, 0, 0.2);
}

.landing__feature-icon--yellow::before {
  background: linear-gradient(135deg, var(--color-yellow-400), var(--color-orange-400));
}

.landing__feature-icon--blue {
  background: linear-gradient(135deg, var(--color-blue-100), var(--color-blue-200));
  color: var(--color-on-info-container);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
}

.landing__feature-icon--blue::before {
  background: linear-gradient(135deg, var(--color-blue-400), var(--color-blue-500));
}

.landing__feature-icon--green {
  background: linear-gradient(135deg, var(--color-green-100), var(--color-green-200));
  color: var(--color-on-success-container);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);
}

.landing__feature-icon--green::before {
  background: linear-gradient(135deg, var(--color-green-400), var(--color-green-500));
}

.landing__feature-title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(14px, 1.2vw, 16px);
  color: var(--color-on-surface);
  margin: 0 0 var(--space-s);
}

.landing__feature-desc {
  font-size: clamp(12px, 1.1vw, 13px);
  line-height: 1.6;
  color: var(--color-on-surface-variant);
  margin: 0;
}

.landing__feature-arrow {
  position: absolute;
  bottom: 16px;
  right: 16px;
  font-size: 18px;
  color: var(--color-gray-300);
  opacity: 0;
  transform: translateX(-8px);
  transition: all 300ms var(--ease-smooth);
}

.landing__feature-card:hover .landing__feature-arrow {
  opacity: 1;
  transform: translateX(0);
}

/* ── Animations ── */
@keyframes landing-fade-in {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ── Responsive ── */
@media (max-width: 900px) {
  .landing__header {
    padding: var(--space-l) var(--space-l);
  }

  .landing__hero {
    padding-left: var(--space-l);
    padding-right: var(--space-l);
  }

  .landing__features {
    padding-left: var(--space-l);
    padding-right: var(--space-l);
  }

  .landing__feature-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 640px) {
  .landing__hero-title {
    letter-spacing: -1px;
  }

  .landing__hero-actions {
    flex-direction: column;
    width: 100%;
    max-width: 280px;
    margin-left: auto;
    margin-right: auto;
  }

  .landing__cta-primary,
  .landing__cta-secondary {
    width: 100%;
    justify-content: center;
  }

  .landing__feature-grid {
    grid-template-columns: 1fr;
    max-width: 400px;
    margin: 0 auto;
  }
}

@media (max-width: 480px) {
  .landing__header {
    padding: var(--space-m) var(--space-m);
  }

  .landing__hero {
    padding-top: 32px;
    padding-bottom: 28px;
    padding-left: var(--space-m);
    padding-right: var(--space-m);
  }

  .landing__features {
    padding-left: var(--space-m);
    padding-right: var(--space-m);
  }

  .landing__login-btn {
    padding: var(--space-s) var(--space-l);
  }

  .landing__login-btn-text {
    font-size: 12px;
  }
}

/* ── Reduced Motion ── */
@media (prefers-reduced-motion: reduce) {
  .landing {
    scroll-behavior: auto;
  }

  .landing__orb {
    animation: none;
  }

  .landing__hero-line,
  .landing__hero-gradient,
  .landing__hero-desc,
  .landing__hero-actions,
  .landing__hero-badge,
  .landing__header {
    animation: none;
    opacity: 1;
  }

  .landing__feature-card {
    opacity: 1;
    transform: none;
    transition: box-shadow 200ms var(--ease-out);
  }

  .landing__cta-primary,
  .landing__cta-secondary,
  .landing__login-btn {
    transition: background 200ms var(--ease-out);
  }

  .landing__cta-primary:hover,
  .landing__cta-secondary:hover,
  .landing__login-btn:hover {
    transform: none;
  }

  .landing__feature-card:hover {
    transform: none;
  }

  .landing__feature-arrow {
    transition: none;
  }
}
</style>
