<template>
  <div class="docx-panel">
    <!-- Upload Zone -->
    <Transition name="fade" mode="out-in">
      <div
        v-if="!htmlOutput"
        key="upload"
        class="docx-panel__dropzone"
        :class="{
          'docx-panel__dropzone--active': isDragging,
          'docx-panel__dropzone--loading': converting
        }"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="handleDrop"
        @click="!converting && $refs.fileInput.click()"
      >
        <input
          ref="fileInput"
          type="file"
          accept=".docx"
          class="docx-panel__file-hidden"
          @change="handleFileSelect"
        />

        <div v-if="converting" class="docx-panel__converting">
          <div class="docx-panel__loader">
            <div class="docx-panel__loader-ring"></div>
            <span class="material-symbols-outlined docx-panel__loader-icon">description</span>
          </div>
          <p class="docx-panel__converting-text">Converting your document...</p>
          <div class="docx-panel__progress-bar">
            <div class="docx-panel__progress-fill"></div>
          </div>
        </div>

        <div v-else class="docx-panel__drop-content">
          <div class="docx-panel__drop-icon-wrap" :class="{ 'docx-panel__drop-icon-wrap--bounce': isDragging }">
            <span class="material-symbols-outlined">{{ isDragging ? 'file_download' : 'upload_file' }}</span>
          </div>
          <p class="docx-panel__drop-title">
            {{ isDragging ? 'Drop your file here' : 'Upload Word Document' }}
          </p>
          <p class="docx-panel__drop-sub">Drag & drop a <strong>.docx</strong> file or click to browse</p>
          <div class="docx-panel__drop-formats">
            <span class="docx-panel__format-chip">.docx</span>
          </div>
        </div>
      </div>

      <!-- Output -->
      <div v-else key="output" class="docx-panel__output">
        <!-- Toolbar -->
        <div class="docx-panel__toolbar">
          <div class="docx-panel__toggle-group">
            <button
              class="docx-panel__toggle"
              :class="{ 'docx-panel__toggle--active': viewMode === 'code' }"
              @click="viewMode = 'code'"
            >
              <span class="material-symbols-outlined">code</span>
              Code
            </button>
            <button
              class="docx-panel__toggle"
              :class="{ 'docx-panel__toggle--active': viewMode === 'preview' }"
              @click="viewMode = 'preview'"
            >
              <span class="material-symbols-outlined">preview</span>
              Preview
            </button>
          </div>

          <div class="docx-panel__toolbar-right">
            <div class="docx-panel__file-info">
              <span class="material-symbols-outlined">description</span>
              {{ fileName }}
            </div>
            <button class="docx-panel__new-btn" @click="reset">
              <span class="material-symbols-outlined">add</span>
              New
            </button>
          </div>
        </div>

        <!-- Code/Preview Scrollable Area -->
        <div class="docx-panel__content-scroll">
          <Transition name="view-fade" mode="out-in">
            <div v-if="viewMode === 'code'" key="code" class="docx-panel__editor-wrap">
              <CodeEditor
                v-model="htmlOutput"
                :readonly="true"
                :rows="20"
              />
            </div>
            <!-- Preview View -->
            <div v-else key="preview" class="docx-panel__preview-area">
              <iframe
                :srcdoc="htmlOutput"
                class="docx-panel__iframe"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          </Transition>
        </div>

        <!-- Messages -->
        <div v-if="messages.length > 0" class="docx-panel__messages">
          <div
            v-for="(msg, i) in messages"
            :key="i"
            class="docx-panel__msg"
            :class="`docx-panel__msg--${msg.type || 'info'}`"
            :style="{ animationDelay: `${i * 60}ms` }"
          >
            <span class="material-symbols-outlined">
              {{ msg.type === 'warning' ? 'warning' : msg.type === 'error' ? 'error' : 'check_circle' }}
            </span>
            {{ msg.message }}
          </div>
        </div>

        <!-- Actions -->
        <OutputActions
          :content="htmlOutput"
          :filename="downloadName"
          mimeType="text/html"
        />
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useDocxConverter } from '../composables/useDocxConverter'
import { useToast } from '@lib/composables/useToast'
import CodeEditor from './CodeEditor.vue'
import OutputActions from './OutputActions.vue'

const toast = useToast()
const { convert, converting } = useDocxConverter()

const fileInput = ref(null)
const isDragging = ref(false)
const htmlOutput = ref('')
const viewMode = ref('preview')
const messages = ref([])
const fileName = ref('')

const downloadName = computed(() => {
  const name = fileName.value
  return name ? name.replace(/\.docx$/i, '.html') : 'converted.html'
})

function handleDrop(e) {
  isDragging.value = false
  const file = e.dataTransfer.files[0]
  if (file) processFile(file)
}

function handleFileSelect(e) {
  const file = e.target.files[0]
  e.target.value = ''
  if (file) processFile(file)
}

async function processFile(file) {
  if (!file.name.endsWith('.docx')) {
    toast.error('Please select a .docx file')
    return
  }

  fileName.value = file.name

  try {
    const result = await convert(file)
    htmlOutput.value = result.html
    messages.value = result.messages
    viewMode.value = 'preview'
    toast.success('Document converted successfully!')
  } catch (e) {
    toast.error(`Conversion failed: ${e.message}`)
  }
}

function reset() {
  htmlOutput.value = ''
  messages.value = []
  viewMode.value = 'preview'
  fileName.value = ''
  if (fileInput.value) fileInput.value.value = ''
}
</script>

<style scoped>
.docx-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-md, 16px);
  overflow: hidden;
  min-height: 0;
}

/* ── Dropzone ── */
.docx-panel__dropzone {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 280px;
  border: 2px dashed rgba(0, 0, 0, 0.1);
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(255, 188, 37, 0.02), rgba(255, 149, 0, 0.02));
  cursor: pointer;
  transition: all 0.4s var(--ease-smooth, cubic-bezier(0.4, 0, 0.2, 1));
  overflow: hidden;
}

.docx-panel__dropzone:hover {
  border-color: rgba(255, 188, 37, 0.4);
  background: linear-gradient(135deg, rgba(255, 188, 37, 0.05), rgba(255, 149, 0, 0.05));
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(255, 188, 37, 0.1);
}

.docx-panel__dropzone--active {
  border-color: var(--cta-primary-bg, #FFBC25);
  background: linear-gradient(135deg, rgba(255, 188, 37, 0.08), rgba(255, 149, 0, 0.08));
  transform: scale(1.01);
  box-shadow: 0 12px 40px rgba(255, 188, 37, 0.15);
}

.docx-panel__dropzone--loading {
  cursor: default;
  border-style: solid;
  border-color: rgba(255, 188, 37, 0.3);
}

.docx-panel__dropzone--loading:hover {
  transform: none;
  box-shadow: none;
}

.docx-panel__file-hidden {
  display: none;
}

.docx-panel__drop-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px;
}

.docx-panel__drop-icon-wrap {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--cta-primary-bg, #FFBC25), #FF9500);
  border-radius: 18px;
  box-shadow: 0 6px 20px rgba(255, 188, 37, 0.25);
  transition: transform 0.3s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
}

.docx-panel__drop-icon-wrap--bounce {
  transform: scale(1.15) translateY(-4px);
}

.docx-panel__drop-icon-wrap .material-symbols-outlined {
  font-size: 32px;
  color: #fff;
}

.docx-panel__drop-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-on-surface, #1a1a2e);
  margin: 0;
}

.docx-panel__drop-sub {
  font-size: 13px;
  color: #8e8ea0;
  margin: 0;
}

.docx-panel__drop-sub strong {
  color: #555;
}

.docx-panel__drop-formats {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}

.docx-panel__format-chip {
  padding: 3px 10px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  color: #666;
}

/* ── Converting Animation ── */
.docx-panel__converting {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px;
}

.docx-panel__loader {
  position: relative;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.docx-panel__loader-ring {
  position: absolute;
  inset: 0;
  border: 3px solid rgba(255, 188, 37, 0.15);
  border-top-color: var(--cta-primary-bg, #FFBC25);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.docx-panel__loader-icon {
  font-size: 24px;
  color: var(--cta-primary-bg, #FFBC25);
  animation: pulse-icon 1.5s ease-in-out infinite;
}

@keyframes pulse-icon {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.docx-panel__converting-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-on-surface, #1a1a2e);
  margin: 0;
}

.docx-panel__progress-bar {
  width: 200px;
  height: 4px;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 4px;
  overflow: hidden;
}

.docx-panel__progress-fill {
  height: 100%;
  width: 40%;
  background: linear-gradient(90deg, var(--cta-primary-bg, #FFBC25), #FF9500);
  border-radius: 4px;
  animation: progress-slide 1.2s ease-in-out infinite;
}

@keyframes progress-slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}

/* ── Output ── */
.docx-panel__output {
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: outputReveal 0.5s var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1)) both;
  min-height: 0;
}

@keyframes outputReveal {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ── Toolbar ── */
.docx-panel__toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.docx-panel__toggle-group {
  display: flex;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 12px;
  padding: 3px;
}

.docx-panel__toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  background: transparent;
  color: #8e8ea0;
  font-family: inherit;
  transition: all 0.25s var(--ease-smooth, cubic-bezier(0.4, 0, 0.2, 1));
}

.docx-panel__toggle .material-symbols-outlined {
  font-size: 17px;
}

.docx-panel__toggle:hover {
  color: #555;
}

.docx-panel__toggle--active {
  background: white;
  color: var(--color-on-surface, #1a1a2e);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  font-weight: 600;
}

.docx-panel__toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.docx-panel__file-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #8e8ea0;
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 8px;
}

.docx-panel__file-info .material-symbols-outlined {
  font-size: 16px;
  color: var(--cta-primary-bg, #FFBC25);
}

.docx-panel__new-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  border: 1.5px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  background: transparent;
  color: #666;
  font-family: inherit;
  transition: all 0.25s ease;
}

.docx-panel__new-btn .material-symbols-outlined {
  font-size: 16px;
}

.docx-panel__new-btn:hover {
  border-color: var(--cta-primary-bg, #FFBC25);
  color: var(--color-on-surface, #1a1a2e);
  background: rgba(255, 188, 37, 0.05);
}

/* ── Content scrollable area ── */
.docx-panel__content-scroll {
  height: 400px;
  overflow: hidden;
  border-radius: 12px;
}

.docx-panel__editor-wrap {
  height: 100%;
  overflow: hidden;
}

.docx-panel__editor-wrap .code-editor {
  height: 100%;
}

.docx-panel__editor-wrap .code-editor__wrapper {
  height: 100%;
  overflow: hidden;
}

.docx-panel__editor-wrap .code-editor__textarea {
  height: 100%;
  overflow-y: auto;
}

/* ── Preview ── */
.docx-panel__preview-area {
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  overflow: hidden;
  background: white;
  height: 100%;
}

.docx-panel__iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

/* ── Messages ── */
.docx-panel__messages {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 80px;
  overflow-y: auto;
}

.docx-panel__msg {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 10px 14px;
  border-radius: 10px;
  animation: msgSlide 0.4s var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1)) both;
}

@keyframes msgSlide {
  from { opacity: 0; transform: translateX(-8px); }
  to { opacity: 1; transform: translateX(0); }
}

.docx-panel__msg .material-symbols-outlined {
  font-size: 16px;
}

.docx-panel__msg--warning {
  background: rgba(255, 107, 0, 0.06);
  color: #c45e00;
}
.docx-panel__msg--error {
  background: rgba(200, 62, 59, 0.06);
  color: var(--color-error, #C83E3B);
}
.docx-panel__msg--info {
  background: rgba(16, 185, 129, 0.06);
  color: #059669;
}

/* ── Transitions ── */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.view-fade-enter-active {
  transition: all 0.3s var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1));
}
.view-fade-leave-active {
  transition: all 0.15s ease-in;
}
.view-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.view-fade-leave-to {
  opacity: 0;
}
</style>
