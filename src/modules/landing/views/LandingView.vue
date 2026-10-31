<template>
  <div class="landing">
    <!-- Header — L1 site header, 80, sticky -->
    <header class="landing__header">
      <div class="landing__wrap landing__header-row">
        <LiLogo size="sm" :animate="true" :show-subtitle="false" />
        <router-link to="/login" class="landing__login-btn">
          <span>Sign In</span>
          <LiIcon name="arrow-right" aria-hidden="true" />
        </router-link>
      </div>
    </header>

    <!-- Hero -->
    <section class="landing__hero">
      <div class="landing__wrap">
        <div class="landing__hero-badge">
          <LiIcon name="zap" aria-hidden="true" />
          <span>Public · Free · No server required</span>
        </div>

        <div class="landing__hero-grid">
          <div class="landing__hero-copy">
            <h1 class="landing__hero-title">
              Tools for QRIS,<br>
              templates &amp; video
            </h1>

            <p class="landing__hero-desc">
              SP-lite is a lightweight toolbox derived from SO-Platform. Sign in to save your
              work across devices, or ask an admin to add your account.
            </p>

            <div class="landing__hero-actions">
              <router-link to="/login" class="landing__cta-primary">
                <span>Get Started</span>
                <LiIcon name="arrow-right" aria-hidden="true" />
              </router-link>
              <a href="#features" class="landing__cta-secondary">
                Learn More
              </a>
            </div>
          </div>

          <div class="landing__hero-art" aria-hidden="true">
            <LiMascot :size="260" animated />
          </div>
        </div>
      </div>
    </section>

    <!-- Features -->
    <section id="features" class="landing__features">
      <div class="landing__wrap">
        <h2 class="landing__section-title">What's Inside</h2>
        <div class="landing__feature-grid">
          <article
            v-for="(feature, index) in features"
            :key="feature.title"
            class="landing__feature-card"
            :style="{ '--reveal-delay': `${index * 100}ms` }"
          >
            <div class="landing__feature-icon" :class="`landing__feature-icon--${feature.color}`">
              <LiIcon :name="feature.icon" aria-hidden="true" />
            </div>
            <h3 class="landing__feature-title">{{ feature.title }}</h3>
            <p class="landing__feature-desc">{{ feature.desc }}</p>
          </article>
        </div>
      </div>
    </section>

    <!-- Site footer -->
    <footer class="landing__footer">
      <div class="landing__wrap landing__footer-row">
        <span>SP-lite · an internal Allo toolbox</span>
        <router-link to="/login">Sign in</router-link>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import LiLogo from '../../../lib/components/LiLogo.vue'
import LiMascot from '../../../lib/components/LiMascot.vue'

const features = [
  {
    icon: 'qr-code',
    color: 'green',
    title: 'QRIS Tools',
    desc: 'Generate and parse EMVCo QRIS codes, client-side. Validate CRC and inspect tags.',
  },
  {
    icon: 'sparkles',
    color: 'yellow',
    title: 'Template Tools',
    desc: 'Convert and preview DOCX to HTML/FTL templates, right in the browser.',
  },
  {
    icon: 'video',
    color: 'blue',
    title: 'Video Frames',
    desc: 'Extract distinct frames from a video. Smart filtering skips similar frames.',
  },
  {
    icon: 'shield',
    color: 'yellow',
    title: 'Admin Panel',
    desc: 'Manage user roles and access from one place, backed by Supabase.',
  },
]

let observer = null

onMounted(() => {
  // Landing is the one marketing surface — it stays light even when the OS
  // or a stored preference says dark (APP.md §5).
  document.documentElement.dataset.theme = 'light'

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
  // restore the stored/OS preference for the rest of the app
  const stored = (() => { try { return localStorage.getItem('sp-theme') } catch { return null } })()
  const osDark = matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.dataset.theme = stored === 'light' || stored === 'dark' ? stored : (osDark ? 'dark' : 'light')
})
</script>

<style scoped>
/* L1 marketing front door (marketing.html): light-only, 1152 column,
   gutters 16/48/144, one yellow CTA per view, scroll reveals allowed here only. */
.landing {
  min-height: 100vh;
  background: var(--color-bg);
  scroll-behavior: smooth;
  display: flex;
  flex-direction: column;
}

.landing__wrap {
  max-width: 1152px;
  margin: 0 auto;
  padding: 0 var(--gutter, 16px);
  width: 100%;
}
@media (min-width: 600px)  { .landing__wrap { padding-inline: 48px; } }
@media (min-width: 1024px) { .landing__wrap { padding-inline: 64px; } }

/* ── Header ── */
.landing__header {
  position: sticky;
  top: 0;
  z-index: 40;
  height: 64px;
  background: var(--color-bg);
  box-shadow: var(--shadow-header);
}
@media (min-width: 1024px) { .landing__header { height: 80px; } }

.landing__header-row {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.landing__login-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  height: 36px;
  padding: 0 var(--space-4);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-pill);
  background: var(--color-bg);
  color: var(--color-text);
  font-weight: 600;
  font-size: var(--text-sm);
  text-decoration: none;
  transition: background var(--dur-quick), color var(--dur-quick);
}

.landing__login-btn:hover {
  background: var(--color-accent);
  color: var(--color-on-accent);
}

.landing__login-btn:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

/* ── Hero ── */
.landing__hero {
  padding: var(--space-15, 60px) 0;
}

.landing__hero-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  height: 28px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-pill);
  background: var(--color-accent-tint);
  color: var(--color-text);
  font-size: var(--text-xs);
  font-weight: 600;
  margin-bottom: var(--space-6);
}

.landing__hero-grid {
  display: grid;
  gap: var(--space-8);
  align-items: center;
}
@media (min-width: 900px) {
  .landing__hero-grid { grid-template-columns: 7fr 5fr; }
}

.landing__hero-title {
  margin: 0 0 var(--space-4);
  font-size: clamp(36px, 5vw + 10px, 64px);
  line-height: 1.08;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--color-text-strong);
}

.landing__hero-desc {
  margin: 0 0 var(--space-8);
  max-width: 46ch;
  font-size: var(--text-base);
  line-height: var(--leading-base);
  color: var(--color-text-muted);
}

.landing__hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.landing__cta-primary {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  height: 48px;
  padding: 0 var(--space-6);
  border-radius: var(--radius-pill);
  background: var(--color-accent);
  color: var(--color-on-accent);
  font-weight: 700;
  font-size: var(--text-base);
  text-decoration: none;
  transition: background var(--dur-quick), box-shadow var(--dur-short) var(--ease-out), transform var(--dur-instant);
}

.landing__cta-primary:hover {
  background: var(--color-accent-strong);
  box-shadow: 0 6px 16px -6px rgba(255, 165, 0, 0.55);
}

.landing__cta-primary:active { transform: scale(0.97); }

.landing__cta-primary:focus-visible,
.landing__cta-secondary:focus-visible {
  outline: 2px solid var(--color-on-accent);
  outline-offset: 2px;
}

.landing__cta-secondary {
  display: inline-flex;
  align-items: center;
  height: 48px;
  padding: 0 var(--space-4);
  border-radius: var(--radius-pill);
  color: var(--color-text-strong);
  font-weight: 600;
  font-size: var(--text-base);
  text-decoration: none;
}

.landing__cta-secondary:hover { text-decoration: underline; text-underline-offset: 4px; }

.landing__hero-art {
  display: grid;
  place-items: center;
}

/* ── Features ── */
.landing__features {
  padding: var(--space-15, 60px) 0;
  border-top: 1px solid var(--color-border);
}

.landing__section-title {
  margin: 0 0 var(--space-8);
  font-size: var(--text-lg);
  line-height: var(--leading-lg);
  font-weight: 700;
  color: var(--color-text-strong);
}

.landing__feature-grid {
  display: grid;
  gap: var(--space-4);
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
}

.landing__feature-card {
  padding: var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg);
  box-shadow: var(--shadow-card);
  opacity: 0;
  transform: translateY(8px);
  transition: opacity var(--dur-long) var(--ease-enter) var(--reveal-delay), transform var(--dur-long) var(--ease-enter) var(--reveal-delay);
}

.landing__feature-card--visible {
  opacity: 1;
  transform: none;
}

.landing__feature-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
}

.landing__feature-icon--yellow { background: var(--color-accent-soft); color: var(--color-accent-text); }
.landing__feature-icon--green  { background: var(--color-success-soft); color: var(--color-success); }
.landing__feature-icon--blue   { background: var(--color-info-soft); color: var(--color-info); }

.landing__feature-title {
  margin: 0 0 var(--space-2);
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-text-strong);
}

.landing__feature-desc {
  margin: 0;
  font-size: var(--text-sm);
  line-height: var(--leading-sm);
  color: var(--color-text-muted);
}

/* ── Footer ── */
.landing__footer {
  margin-top: auto;
  padding: var(--space-8) 0;
  background: var(--color-inverse);
  color: var(--color-on-inverse);
}

.landing__footer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  font-size: var(--text-sm);
}

.landing__footer a {
  color: var(--color-on-inverse);
  font-weight: 600;
  text-decoration: none;
}

.landing__footer a:hover { text-decoration: underline; }

@media (prefers-reduced-motion: reduce) {
  .landing__feature-card { opacity: 1; transform: none; transition: none; }
  .landing { scroll-behavior: auto; }
}
</style>
