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
        <span class="material-symbols-outlined vf__upload-icon">video_file</span>
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
          <span class="material-symbols-outlined">play_arrow</span>
          Extract Frames
        </button>
        <button v-if="frames.length > 0" class="vf__btn" @click="run">
          <span class="material-symbols-outlined">refresh</span>
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
        <span class="material-symbols-outlined">error</span>
        <span>{{ error }}</span>
      </div>

      <!-- Status message -->
      <div class="vf__status" v-if="progress && !processing && !error">
        <span class="material-symbols-outlined">check_circle</span>
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
              <span class="material-symbols-outlined">{{ allSelected ? 'deselect' : 'select_all' }}</span>
              {{ allSelected ? 'Deselect All' : 'Select All' }}
            </button>
            <button class="vf__btn vf__btn--sm vf__btn--primary" @click="download(false)">
              <span class="material-symbols-outlined">download</span>
              All ({{ totalCount }})
            </button>
            <button
              class="vf__btn vf__btn--sm vf__btn--primary"
              :disabled="selectedCount === 0"
              @click="download(true)"
            >
              <span class="material-symbols-outlined">download_done</span>
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
              <span class="material-symbols-outlined">{{ frame.selected ? 'check_box' : 'check_box_outline_blank' }}</span>
            </div>
            <img :src="frame._url" class="vf__thumb" loading="lazy" />
            <div class="vf__card-meta">
              <span class="vf__card-label">Frame {{ i + 1 }}</span>
              <div class="vf__card-details">
                <span class="vf__card-detail">
                  <span class="material-symbols-outlined">schedule</span>
                  {{ formatTime(frame.time) }}
                </span>
                <span class="vf__card-detail">
                  <span class="material-symbols-outlined">aspect_ratio</span>
                  {{ frame.width }}×{{ frame.height }}
                </span>
                <span class="vf__card-detail">
                  <span class="material-symbols-outlined">hard_drive_2</span>
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
  padding: var(--space-lg, 24px);
}

.vf__header {
  margin-bottom: var(--space-xl, 32px);
}

.vf__title {
  font-family: var(--font-display, 'Inter', sans-serif);
  font-size: var(--text-2xl, 24px);
  font-weight: 700;
  color: var(--color-gray-900, #1a1a2e);
  margin: 0 0 var(--space-xs, 4px);
}

.vf__subtitle {
  font-size: var(--text-sm, 13px);
  color: var(--color-gray-500, #808080);
  margin: 0;
}

.vf__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg, 24px);
}

/* ── Upload Zone ── */
.vf__upload-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm, 8px);
  padding: var(--space-2xl, 40px) var(--space-lg, 24px);
  border: 2px dashed var(--color-gray-300, #ccc);
  border-radius: var(--radius-lg, 16px);
  background: var(--color-glass-light, rgba(255, 255, 255, 0.6));
  cursor: pointer;
  transition: all 0.2s ease;
}

.vf__upload-zone:hover,
.vf__upload-zone--drag {
  border-color: var(--cta-primary-bg, #FFBC25);
  background: rgba(255, 188, 37, 0.05);
}

.vf__upload-icon { font-size: 40px; color: var(--color-gray-400, #999); }
.vf__upload-text { font-weight: 600; color: var(--color-gray-700, #333); }
.vf__upload-hint { font-size: var(--text-xs, 11px); color: var(--color-gray-400, #999); }

/* ── Slider ── */
.vf__options { display: flex; flex-direction: column; gap: var(--space-xs, 4px); }

.vf__slider-label {
  display: flex; justify-content: space-between;
  font-size: var(--text-sm, 13px); font-weight: 600; color: var(--color-gray-700, #333);
}

.vf__slider-value { color: var(--cta-primary-bg, #FFBC25); font-weight: 700; }
.vf__slider { width: 100%; accent-color: var(--cta-primary-bg, #FFBC25); }
.vf__slider-hint { font-size: var(--text-xs, 11px); color: var(--color-gray-400, #999); }

/* ── Actions ── */
.vf__actions { display: flex; gap: var(--space-sm, 8px); flex-wrap: wrap; }

.vf__btn {
  display: inline-flex; align-items: center; gap: var(--space-xs, 4px);
  padding: var(--space-sm, 8px) var(--space-lg, 24px);
  font-size: var(--text-sm, 13px); font-weight: 600;
  border: none; border-radius: var(--radius-md, 12px);
  cursor: pointer; transition: all 0.2s ease;
  background: var(--color-gray-100, #f0f0f0); color: var(--color-gray-700, #333);
}

.vf__btn:hover { background: var(--color-gray-200, #e0e0e0); }
.vf__btn:disabled { opacity: 0.4; cursor: not-allowed; }

.vf__btn--primary {
  background: var(--cta-primary-bg, #FFBC25); color: var(--color-gray-900, #1a1a2e);
}
.vf__btn--primary:hover { background: var(--cta-primary-hover, #e6a820); }
.vf__btn--primary:disabled { background: var(--cta-primary-bg, #FFBC25); opacity: 0.4; }

.vf__btn--sm {
  padding: var(--space-xs, 4px) var(--space-md, 16px);
  font-size: var(--text-xs, 11px);
}

.vf__btn .material-symbols-outlined { font-size: 18px; }

/* ── Progress ── */
.vf__progress {
  display: flex; align-items: center; gap: var(--space-sm, 8px);
  padding: var(--space-md, 16px);
  background: var(--color-glass-light, rgba(255, 255, 255, 0.6));
  border-radius: var(--radius-md, 12px);
  font-size: var(--text-sm, 13px); color: var(--color-gray-600, #555);
}

.vf__spinner {
  width: 18px; height: 18px;
  border: 2px solid var(--color-gray-200, #e0e0e0);
  border-top-color: var(--cta-primary-bg, #FFBC25);
  border-radius: 50%;
  animation: vf-spin 0.8s linear infinite;
}

@keyframes vf-spin { to { transform: rotate(360deg); } }

/* ── Error / Status ── */
.vf__error {
  display: flex; align-items: center; gap: var(--space-sm, 8px);
  padding: var(--space-md, 16px);
  background: rgba(200, 62, 59, 0.08); border-radius: var(--radius-md, 12px);
  font-size: var(--text-sm, 13px); color: var(--color-red-400, #C83E3B);
}
.vf__error .material-symbols-outlined { font-size: 18px; }

.vf__status {
  display: flex; align-items: center; gap: var(--space-sm, 8px);
  font-size: var(--text-sm, 13px); color: var(--color-green-600, #10B981);
}
.vf__status .material-symbols-outlined { font-size: 18px; }

/* ── Toolbar ── */
.vf__toolbar {
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;
  gap: var(--space-sm, 8px);
  padding: var(--space-md, 16px);
  background: var(--color-glass-light, rgba(255, 255, 255, 0.6));
  border-radius: var(--radius-md, 12px);
  border: 1px solid rgba(0, 0, 0, 0.04);
}

.vf__toolbar-info {
  display: flex; align-items: center; gap: var(--space-sm, 8px);
  font-size: var(--text-sm, 13px); color: var(--color-gray-600, #555);
}

.vf__toolbar-count { font-weight: 700; color: var(--color-gray-800, #1a1a2e); }
.vf__toolbar-size { font-size: var(--text-xs, 11px); color: var(--color-gray-400, #999); }
.vf__toolbar-sep { color: var(--color-gray-300, #ccc); }
.vf__toolbar-selected { font-weight: 600; color: var(--cta-primary-bg, #FFBC25); }

.vf__toolbar-actions {
  display: flex; gap: var(--space-xs, 4px); flex-wrap: wrap;
}

/* ── Frame Grid ── */
.vf__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-md, 16px);
}

.vf__card {
  position: relative;
  border-radius: var(--radius-md, 12px);
  overflow: hidden;
  background: var(--color-glass-light, rgba(255, 255, 255, 0.8));
  box-shadow: var(--shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.08));
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
}

.vf__card:hover {
  box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.1));
  transform: translateY(-2px);
}

.vf__card--selected {
  border-color: var(--cta-primary-bg, #FFBC25);
  box-shadow: 0 0 0 1px var(--cta-primary-bg), var(--shadow-sm);
}

.vf__card--selected:hover {
  box-shadow: 0 0 0 1px var(--cta-primary-bg), var(--shadow-md);
}

.vf__card-check {
  position: absolute;
  top: var(--space-xs, 4px);
  left: var(--space-xs, 4px);
  z-index: 2;
  color: var(--cta-primary-bg, #FFBC25);
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
}

.vf__card-check .material-symbols-outlined { font-size: 22px; }

.vf__thumb {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  display: block;
}

.vf__card-meta {
  padding: var(--space-sm, 8px) var(--space-md, 16px);
}

.vf__card-label {
  display: block;
  font-size: var(--text-sm, 13px);
  font-weight: 700;
  color: var(--color-gray-800, #1a1a2e);
  margin-bottom: var(--space-xs, 4px);
}

.vf__card-details {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm, 8px);
}

.vf__card-detail {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 10px;
  font-weight: 500;
  color: var(--color-gray-500, #808080);
}

.vf__card-detail .material-symbols-outlined {
  font-size: 12px;
}

/* ── Responsive ── */
@media (max-width: 640px) {
  .vf__grid {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-sm, 8px);
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
    padding: var(--space-xs, 4px) var(--space-sm, 8px);
  }

  .vf__card-details {
    gap: var(--space-xs, 4px);
  }
}
</style>
