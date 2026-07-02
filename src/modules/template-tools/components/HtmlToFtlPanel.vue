<template>
  <div class="ftl-panel">
    <!-- Step indicator -->
    <div class="ftl-panel__steps">
      <div class="ftl-panel__step" :class="{ 'ftl-panel__step--done': ftlOutput }">
        <span class="ftl-panel__step-num">1</span>
        <span class="ftl-panel__step-label">Input HTML</span>
      </div>
      <div class="ftl-panel__step-line" :class="{ 'ftl-panel__step-line--done': ftlOutput }"></div>
      <div class="ftl-panel__step" :class="{ 'ftl-panel__step--active': ftlOutput }">
        <span class="ftl-panel__step-num">2</span>
        <span class="ftl-panel__step-label">FTL Output</span>
      </div>
    </div>

    <!-- Input Section -->
    <div class="ftl-panel__section">
      <div class="ftl-panel__section-header">
        <div class="ftl-panel__section-title">
          <span class="material-symbols-outlined">code</span>
          HTML Source
        </div>
        <label class="ftl-panel__upload-btn">
          <span class="material-symbols-outlined">upload_file</span>
          Upload
          <input
            type="file"
            accept=".html,.htm"
            class="ftl-panel__file-hidden"
            @change="handleFileUpload"
          />
        </label>
      </div>

      <div class="ftl-panel__editor-wrap">
        <CodeEditor
          v-model="inputHtml"
          placeholder="Paste your HTML code here..."
          :rows="12"
        />
      </div>

      <!-- Auto-fix badge -->
      <Transition name="badge-pop">
        <div v-if="fixesApplied.length > 0" class="ftl-panel__fix-badge">
          <span class="material-symbols-outlined">auto_fix_high</span>
          <span>Auto-fixed <strong>{{ fixesApplied.length }}</strong> issue{{ fixesApplied.length > 1 ? 's' : '' }}</span>
        </div>
      </Transition>

      <button
        class="ftl-panel__convert-btn"
        @click="handleConvert"
        :disabled="!inputHtml.trim()"
      >
        <span class="material-symbols-outlined">transform</span>
        Convert to FTL
        <span class="ftl-panel__btn-shine"></span>
      </button>
    </div>

    <!-- Output Section -->
    <Transition name="slide-up">
      <div v-if="ftlOutput" class="ftl-panel__section ftl-panel__output-section">
        <div class="ftl-panel__section-header">
          <div class="ftl-panel__section-title">
            <span class="material-symbols-outlined">description</span>
            FTL Template
          </div>
          <div class="ftl-panel__toggle-group">
            <button
              class="ftl-panel__toggle"
              :class="{ 'ftl-panel__toggle--active': viewMode === 'code' }"
              @click="viewMode = 'code'"
            >
              <span class="material-symbols-outlined">code</span>
              Code
            </button>
            <button
              class="ftl-panel__toggle"
              :class="{ 'ftl-panel__toggle--active': viewMode === 'preview' }"
              @click="viewMode = 'preview'"
            >
              <span class="material-symbols-outlined">preview</span>
              Preview
            </button>
            <button
              class="ftl-panel__toggle"
              :class="{ 'ftl-panel__toggle--active': viewMode === 'pdf' }"
              @click="renderPdf"
            >
              <span class="material-symbols-outlined">picture_as_pdf</span>
              PDF
            </button>
          </div>
        </div>

        <Transition name="view-fade" mode="out-in">
          <div v-if="viewMode === 'code'" key="code" class="ftl-panel__editor-wrap">
            <CodeEditor
              v-model="ftlOutput"
              :readonly="true"
              :rows="16"
            />
          </div>
          <div v-else-if="viewMode === 'pdf'" key="pdf" class="ftl-panel__preview-wrap">
            <div class="ftl-panel__a4-page">
              <iframe v-if="pdf.pdfUrl.value" :src="pdf.pdfUrl.value" class="ftl-panel__a4-iframe" title="Flying Saucer PDF"></iframe>
              <div v-else style="padding:24px;text-align:center;color:#999;">
                {{ pdf.rendering.value ? 'Rendering…' : (pdf.javaAvailable.value ? 'Click PDF to render' : 'Java not detected — install a JRE for Flying Saucer PDF.') }}
              </div>
            </div>
          </div>
          <div v-else key="preview" class="ftl-panel__preview-wrap">
            <div class="ftl-panel__a4-page">
              <iframe
                :srcdoc="ftlPreviewHtml"
                class="ftl-panel__a4-iframe"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </Transition>

        <OutputActions
          :content="ftlOutput"
          :filename="downloadName"
          mimeType="text/plain"
        />
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useFtlConverter } from '../composables/useFtlConverter'
import { useHtmlFixer } from '../composables/useHtmlFixer'
import { useFtlPdfRenderer } from '../composables/useFtlPdfRenderer'
import { useToast } from '@lib/composables/useToast'
import CodeEditor from './CodeEditor.vue'
import OutputActions from './OutputActions.vue'

const toast = useToast()
const { convert } = useFtlConverter()
const { fix } = useHtmlFixer()
const pdf = useFtlPdfRenderer()

const inputHtml = ref('')
const ftlOutput = ref('')
const viewMode = ref('code')
const fixesApplied = ref([])

const fileName = ref('')

const downloadName = computed(() => {
  const name = fileName.value
  return name ? name.replace(/\.html?$/i, '.ftl') : 'template.ftl'
})

const ftlPreviewHtml = computed(() => {
  if (!ftlOutput.value) return ''
  let preview = ftlOutput.value
  preview = preview.replace(/<#ftl[^>]*>/gi, '')
  preview = preview.replace(/<#if[^>]*>/gi, '')
  preview = preview.replace(/<#elseif[^>]*>/gi, '')
  preview = preview.replace(/<#else\s*\/?>/gi, '')
  preview = preview.replace(/<\/#if>/gi, '')
  preview = preview.replace(/<#list[^>]*>/gi, '')
  preview = preview.replace(/<\/#list>/gi, '')
  preview = preview.replace(/\$\{[^}]*\}/g, '<span style="background:#FFBC2533;padding:2px 6px;border-radius:4px;font-size:0.85em;color:#b8860b;">var</span>')
  return preview
})

function handleFileUpload(e) {
  const file = e.target.files[0]
  e.target.value = ''
  if (!file) return
  fileName.value = file.name
  const reader = new FileReader()
  reader.onload = (ev) => {
    inputHtml.value = ev.target.result
  }
  reader.readAsText(file)
}

function handleConvert() {
  if (!inputHtml.value.trim()) return
  // convert() runs fixForXhtml internally; surface the fixes from useHtmlFixer for the badge only.
  const { fixes } = fix(inputHtml.value)
  if (fixes.length > 0) fixesApplied.value = fixes
  ftlOutput.value = convert(inputHtml.value)
  viewMode.value = 'code'
  toast.success('HTML converted to FTL!')
}

async function renderPdf() {
  if (!ftlOutput.value) return
  const url = await pdf.render(ftlOutput.value, {})
  if (url) {
    viewMode.value = 'pdf'
  } else if (!pdf.javaAvailable.value) {
    toast.error('Java not detected — PDF preview unavailable.')
  } else {
    toast.error(pdf.lastError.value || 'PDF render failed')
  }
}
</script>

<style scoped>
.ftl-panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* ── Steps ── */
.ftl-panel__steps {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 0 20px;
}

.ftl-panel__step {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ftl-panel__step-num {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.06);
  font-size: 12px;
  font-weight: 700;
  color: #aaa;
  transition: all 0.4s ease;
}

.ftl-panel__step--done .ftl-panel__step-num,
.ftl-panel__step--active .ftl-panel__step-num {
  background: linear-gradient(135deg, var(--cta-primary-bg, #FFBC25), #FF9500);
  color: #fff;
  box-shadow: 0 2px 8px rgba(255, 188, 37, 0.3);
}

.ftl-panel__step-label {
  font-size: 13px;
  font-weight: 500;
  color: #aaa;
  transition: color 0.3s ease;
}

.ftl-panel__step--done .ftl-panel__step-label,
.ftl-panel__step--active .ftl-panel__step-label {
  color: var(--color-on-surface, #1a1a2e);
  font-weight: 600;
}

.ftl-panel__step-line {
  flex: 1;
  max-width: 80px;
  height: 2px;
  background: rgba(0, 0, 0, 0.06);
  margin: 0 12px;
  border-radius: 2px;
  transition: background 0.4s ease;
}

.ftl-panel__step-line--done {
  background: linear-gradient(90deg, var(--cta-primary-bg, #FFBC25), #FF9500);
}

/* ── Section ── */
.ftl-panel__section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ftl-panel__section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ftl-panel__section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-on-surface, #1a1a2e);
}

.ftl-panel__section-title .material-symbols-outlined {
  font-size: 20px;
  color: var(--cta-primary-bg, #FFBC25);
}

.ftl-panel__upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  border: 1.5px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  background: transparent;
  color: #666;
  font-family: inherit;
  transition: all 0.25s ease;
}

.ftl-panel__upload-btn .material-symbols-outlined {
  font-size: 16px;
}

.ftl-panel__upload-btn:hover {
  border-color: var(--cta-primary-bg, #FFBC25);
  color: var(--color-on-surface, #1a1a2e);
  background: rgba(255, 188, 37, 0.05);
}

.ftl-panel__file-hidden { display: none; }

/* ── Fix Badge ── */
.ftl-panel__fix-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: linear-gradient(135deg, rgba(255, 188, 37, 0.08), rgba(255, 149, 0, 0.06));
  border: 1px solid rgba(255, 188, 37, 0.15);
  border-radius: 10px;
  font-size: 13px;
  color: #8b6914;
}

.ftl-panel__fix-badge .material-symbols-outlined {
  font-size: 18px;
  color: var(--cta-primary-bg, #FFBC25);
}

/* ── Convert Button ── */
.ftl-panel__convert-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 32px;
  border: none;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--cta-primary-bg, #FFBC25), #FF9500);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.3s var(--ease-smooth, cubic-bezier(0.4, 0, 0.2, 1));
  align-self: flex-start;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(255, 188, 37, 0.3);
}

.ftl-panel__convert-btn .material-symbols-outlined {
  font-size: 20px;
}

.ftl-panel__convert-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 28px rgba(255, 188, 37, 0.4);
}

.ftl-panel__convert-btn:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
}

.ftl-panel__convert-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  box-shadow: none;
}

.ftl-panel__btn-shine {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  transition: left 0.5s ease;
}

.ftl-panel__convert-btn:hover:not(:disabled) .ftl-panel__btn-shine {
  left: 100%;
}

/* ── Toggle Group ── */
.ftl-panel__toggle-group {
  display: flex;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 10px;
  padding: 3px;
}

.ftl-panel__toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  background: transparent;
  color: #8e8ea0;
  font-family: inherit;
  transition: all 0.25s ease;
}

.ftl-panel__toggle .material-symbols-outlined { font-size: 16px; }

.ftl-panel__toggle--active {
  background: white;
  color: var(--color-on-surface, #1a1a2e);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
  font-weight: 600;
}

/* ── Editor Wrap ── */
.ftl-panel__editor-wrap {
  max-height: 400px;
  overflow: hidden;
}

.ftl-panel__editor-wrap .code-editor {
  height: 100%;
}

.ftl-panel__editor-wrap .code-editor__wrapper {
  height: 100%;
  overflow: hidden;
}

.ftl-panel__editor-wrap .code-editor__textarea {
  height: 100%;
  overflow-y: auto;
}

/* ── A4 Preview ── */
.ftl-panel__preview-wrap {
  display: flex;
  justify-content: center;
  padding: 24px;
  background: #eee;
  border-radius: 12px;
}

.ftl-panel__a4-page {
  width: 210mm;
  min-height: 297mm;
  background: white;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
  border-radius: 3px;
  overflow: hidden;
}

.ftl-panel__a4-iframe {
  width: 100%;
  min-height: 297mm;
  border: none;
  display: block;
}

/* ── Transitions ── */
.slide-up-enter-active {
  transition: all 0.5s var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1));
}
.slide-up-leave-active {
  transition: all 0.2s ease-in;
}
.slide-up-enter-from {
  opacity: 0;
  transform: translateY(20px);
}
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.badge-pop-enter-active {
  transition: all 0.4s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
}
.badge-pop-leave-active {
  transition: all 0.2s ease;
}
.badge-pop-enter-from {
  opacity: 0;
  transform: scale(0.9) translateY(-4px);
}
.badge-pop-leave-to {
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
