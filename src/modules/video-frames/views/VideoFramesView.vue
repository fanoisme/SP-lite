<template>
  <div class="vf">
    <div class="vf__header">
      <h1 class="vf__title">Video Frames</h1>
      <p class="vf__subtitle">Extract distinct frames from video — 100% browser-side</p>
    </div>

    <div class="vf__body">
      <!-- Upload -->
      <div
        class="vf__upload-zone"
        :class="{ 'vf__upload-zone--drag': dragging }"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop.prevent="onDrop"
        @click="$refs.input.click()"
      >
        <LiIcon name="file-video" class="vf__upload-icon" />
        <span class="vf__upload-text">{{ fileName || 'Drop video here or click to browse' }}</span>
        <span class="vf__upload-hint">MP4, WebM, MOV — max 500MB</span>
        <input ref="input" type="file" accept="video/*" hidden @change="onFile" />
      </div>

      <!-- Threshold slider -->
      <div class="vf__options" v-if="fileName && !processing && frames.length === 0">
        <label class="vf__slider-label">
          <span>Sensitivity</span>
          <span class="vf__slider-value">{{ (threshold * 100).toFixed(0) }}%</span>
        </label>
        <input type="range" class="vf__slider" v-model.number="threshold" min="0.01" max="0.30" step="0.01" />
        <span class="vf__slider-hint">Lower = more frames, Higher = only major changes</span>
      </div>

      <!-- Actions -->
      <div class="vf__actions" v-if="fileName && !processing">
        <button v-if="frames.length === 0" class="vf__btn vf__btn--primary" @click="run">
          <LiIcon name="play" />
          Extract Frames
        </button>
        <button v-if="frames.length > 0" class="vf__btn" @click="run">
          <LiIcon name="rotate-cw" />
          Re-extract
        </button>
      </div>

      <!-- Progress -->
      <div class="vf__progress" v-if="processing">
        <div class="vf__spinner"></div>
        <span>{{ progress }}</span>
      </div>

      <!-- Error -->
      <div class="vf__error" v-if="error">
        <LiIcon name="circle-x" />
        <span>{{ error }}</span>
      </div>

      <!-- Status message -->
      <div class="vf__status" v-if="progress && !processing && !error">
        <LiIcon name="circle-check" />
        <span>{{ progress }}</span>
      </div>

      <!-- Toolbar + Grid -->
      <template v-if="frames.length > 0">
        <!-- Toolbar -->
        <div class="vf__toolbar">
          <div class="vf__toolbar-info">
            <span class="vf__toolbar-count">{{ totalCount }} frames</span>
            <span class="vf__toolbar-size">{{ formatSize(totalSize) }}</span>
            <span class="vf__toolbar-sep">·</span>
            <span class="vf__toolbar-selected">{{ selectedCount }} selected ({{ formatSize(selectedSize) }})</span>
          </div>
          <div class="vf__toolbar-actions">
            <button class="vf__btn vf__btn--sm" @click="toggleAll">
              <LiIcon :name="allSelected ? 'square-x' : 'list-checks'" />
              {{ allSelected ? 'Deselect All' : 'Select All' }}
            </button>
            <button class="vf__btn vf__btn--sm vf__btn--primary" @click="download(false)">
              <LiIcon name="download" />
              All ({{ totalCount }})
            </button>
            <button
              class="vf__btn vf__btn--sm vf__btn--primary"
              :disabled="selectedCount === 0"
              @click="download(true)"
            >
              <LiIcon name="file-check" />
              Selected ({{ selectedCount }})
            </button>
          </div>
        </div>

        <!-- Frame Grid -->
        <div class="vf__grid">
          <div
            v-for="(frame, i) in frames"
            :key="i"
            class="vf__card"
            :class="{ 'vf__card--selected': frame.selected }"
            @click="toggleSelect(i)"
          >
            <div class="vf__card-check">
              <LiIcon :name="frame.selected ? 'square-check' : 'square'" />
            </div>
            <img :src="frame._url" class="vf__thumb" loading="lazy" />
            <div class="vf__card-meta">
              <span class="vf__card-label">Frame {{ i + 1 }}</span>
              <div class="vf__card-details">
                <span class="vf__card-detail">
                  <LiIcon name="clock" />
                  {{ formatTime(frame.time) }}
                </span>
                <span class="vf__card-detail">
                  <LiIcon name="frame" />
                  {{ frame.width }}×{{ frame.height }}
                </span>
                <span class="vf__card-detail">
                  <LiIcon name="hard-drive" />
                  {{ formatSize(frame.size) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useVideoFrames } from '../composables/useVideoFrames.js'

const {
  processing, progress, frames, error: extractError, selectedCount, totalCount, totalSize, selectedSize,
  extract, downloadZip, reset, selectAll, deselectAll, toggleSelect, toggleAll, formatSize, formatTime
} = useVideoFrames()

const file = ref(null)
const fileName = ref('')
const dragging = ref(false)
const threshold = ref(0.05)
const error = ref(null)

const allSelected = computed(() => frames.value.length > 0 && frames.value.every(f => f.selected))

function onFile(e) {
  const f = e.target.files?.[0]
  if (f) setFile(f)
}

function onDrop(e) {
  dragging.value = false
  const f = e.dataTransfer.files?.[0]
  if (f?.type.startsWith('video/')) setFile(f)
}

function setFile(f) {
  reset()
  file.value = f
  fileName.value = f.name
  error.value = null
}

async function run() {
  error.value = null
  await extract(file.value, threshold.value)
  if (extractError.value) error.value = extractError.value
}

async function download(selectedOnly) {
  await downloadZip(fileName.value, selectedOnly)
}
</script>

<style scoped>
.vf {
  max-width: 1100px;
  margin: 0 auto;
  padding: var(--space-4);
}

.vf__header {
  margin-bottom: var(--space-6);
}

.vf__title {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--color-text-strong);
  margin: 0 0 var(--space-1);
}

.vf__subtitle {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  margin: 0;
}

.vf__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* ── Upload Zone ── */
.vf__upload-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-8) var(--space-4);
  border: 2px dashed var(--color-border-strong);
  border-radius: var(--radius-lg);
  background: var(--color-bg);
  cursor: pointer;
  transition: all 0.2s ease;
}

.vf__upload-zone:hover,
.vf__upload-zone--drag {
  border-color: var(--color-accent);
  background: rgba(255, 188, 37, 0.05);
}

.vf__upload-icon { font-size: 40px; color: var(--color-text-placeholder); }
.vf__upload-text { font-weight: 600; color: var(--color-text); }
.vf__upload-hint { font-size: var(--text-xs); color: var(--color-text-placeholder); }

/* ── Slider ── */
.vf__options { display: flex; flex-direction: column; gap: var(--space-1); }

.vf__slider-label {
  display: flex; justify-content: space-between;
  font-size: var(--text-sm); font-weight: 600; color: var(--color-text);
}

.vf__slider-value { color: var(--color-accent); font-weight: 700; }
.vf__slider { width: 100%; accent-color: var(--color-accent); }
.vf__slider-hint { font-size: var(--text-xs); color: var(--color-text-placeholder); }

/* ── Actions ── */
.vf__actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }

.vf__btn {
  display: inline-flex; align-items: center; gap: var(--space-1);
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm); font-weight: 600;
  border: none; border-radius: var(--radius-md);
  cursor: pointer; transition: all 0.2s ease;
  background: var(--color-surface-2); color: var(--color-text);
}

.vf__btn:hover { background: var(--color-border); }
.vf__btn:disabled { opacity: 0.4; cursor: not-allowed; }

.vf__btn--primary {
  background: var(--color-accent); color: var(--color-text-strong);
}
.vf__btn--primary:hover { background: var(--color-accent-strong); }
.vf__btn--primary:disabled { background: var(--color-accent); opacity: 0.4; }

.vf__btn--sm {
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-xs);
}

.vf__btn .li-icon { font-size: 18px; }

/* ── Progress ── */
.vf__progress {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-3);
  background: var(--color-bg);
  border-radius: var(--radius-md);
  font-size: var(--text-sm); color: var(--color-text-muted);
}

.vf__spinner {
  width: 18px; height: 18px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: vf-spin 0.8s linear infinite;
}

@keyframes vf-spin { to { transform: rotate(360deg); } }

/* ── Error / Status ── */
.vf__error {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-3);
  background: rgba(200, 62, 59, 0.08); border-radius: var(--radius-md);
  font-size: var(--text-sm); color: var(--color-danger);
}
.vf__error .li-icon { font-size: 18px; }

.vf__status {
  display: flex; align-items: center; gap: var(--space-2);
  font-size: var(--text-sm); color: var(--color-success);
}
.vf__status .li-icon { font-size: 18px; }

/* ── Toolbar ── */
.vf__toolbar {
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--color-bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.vf__toolbar-info {
  display: flex; align-items: center; gap: var(--space-2);
  font-size: var(--text-sm); color: var(--color-text-muted);
}

.vf__toolbar-count { font-weight: 700; color: var(--color-text); }
.vf__toolbar-size { font-size: var(--text-xs); color: var(--color-text-placeholder); }
.vf__toolbar-sep { color: var(--color-border-strong); }
.vf__toolbar-selected { font-weight: 600; color: var(--color-accent); }

.vf__toolbar-actions {
  display: flex; gap: var(--space-1); flex-wrap: wrap;
}

/* ── Frame Grid ── */
.vf__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-3);
}

.vf__card {
  position: relative;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-bg);
  box-shadow: var(--shadow-card);
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
}

.vf__card:hover {
  box-shadow: var(--shadow-pop);
  transform: translateY(-2px);
}

.vf__card--selected {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 1px var(--color-accent), var(--shadow-card);
}

.vf__card--selected:hover {
  box-shadow: 0 0 0 1px var(--color-accent), var(--shadow-pop);
}

.vf__card-check {
  position: absolute;
  top: var(--space-1);
  left: var(--space-1);
  z-index: 2;
  color: var(--color-accent);
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
}

.vf__card-check .li-icon { font-size: 22px; }

.vf__thumb {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  display: block;
}

.vf__card-meta {
  padding: var(--space-2) var(--space-3);
}

.vf__card-label {
  display: block;
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: var(--space-1);
}

.vf__card-details {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.vf__card-detail {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 10px;
  font-weight: 500;
  color: var(--color-text-muted);
}

.vf__card-detail .li-icon {
  font-size: 12px;
}

/* ── Responsive ── */
@media (max-width: 640px) {
  .vf__grid {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-2);
  }

  .vf__toolbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .vf__toolbar-actions {
    width: 100%;
  }

  .vf__toolbar-actions .vf__btn {
    flex: 1;
    justify-content: center;
  }

  .vf__card-meta {
    padding: var(--space-1) var(--space-2);
  }

  .vf__card-details {
    gap: var(--space-1);
  }
}
</style>
