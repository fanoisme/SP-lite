<template>
  <div class="ftl-preview">
    <!-- Glass header: tab bar + one contextual primary action -->
    <header class="ftl-preview__header">
      <div class="ftl-preview__tabs">
        <button
          class="ftl-preview__tab"
          :class="{ 'ftl-preview__tab--active': tab === 'editor' }"
          @click="tab = 'editor'"
        >
          <span class="material-symbols-outlined">edit_note</span>
          Editor
        </button>
        <button
          class="ftl-preview__tab"
          :class="{ 'ftl-preview__tab--active': tab === 'pdf' }"
          @click="tab = 'pdf'"
        >
          <span class="material-symbols-outlined">picture_as_pdf</span>
          PDF
        </button>
      </div>

      <div class="ftl-preview__header-action">
        <!-- Editor: update live preview -->
        <button
          v-if="tab === 'editor'"
          class="ftl-preview__cta"
          @click="handleRender"
          :disabled="!inputFtl.trim() || processing"
        >
          <div v-if="processing" class="ftl-preview__btn-spinner"></div>
          <span v-else class="material-symbols-outlined">play_arrow</span>
          {{ processing ? 'Updating…' : 'Update Preview' }}
          <span class="ftl-preview__btn-shine"></span>
        </button>

        <!-- PDF: render real Flying Saucer PDF + download -->
        <template v-else>
          <button
            class="ftl-preview__cta"
            @click="renderFlyingSaucerPdf"
            :disabled="!inputFtl.trim() || pdf.rendering.value"
          >
            <span class="material-symbols-outlined">{{ pdf.rendering.value ? 'hourglass_top' : 'flare' }}</span>
            {{ pdf.rendering.value ? 'Rendering…' : 'Render Flying Saucer PDF' }}
          </button>
          <button
            v-if="pdf.pdfUrl.value"
            class="ftl-preview__icon-btn"
            @click="downloadPdf"
            title="Download PDF"
          >
            <span class="material-symbols-outlined">download</span>
          </button>
        </template>
      </div>
    </header>

    <!-- ── Editor tab: code (~42%) | live A4 preview (~58%) ── -->
    <div v-if="tab === 'editor'" class="ftl-preview__editor">
      <!-- Left: code panel -->
      <section class="ftl-preview__panel ftl-preview__panel--code">
        <div class="ftl-preview__panel-head">
          <div class="ftl-preview__panel-title">
            <span class="material-symbols-outlined">code</span>
            FTL Template
          </div>
          <label class="ftl-preview__upload-btn">
            <span class="material-symbols-outlined">upload_file</span>
            Upload
            <input
              type="file"
              accept=".ftl,.ftlh,.html,.htm"
              class="ftl-preview__file-hidden"
              @change="handleFileUpload"
            />
          </label>
        </div>

        <div class="ftl-preview__editor-wrap">
          <CodeEditor
            v-model="inputFtl"
            placeholder="Paste your FTL template here... Use ${variableName} and <#if>, <#list> directives"
            :rows="12"
          />
        </div>

        <Transition name="badge-pop">
          <div v-if="fixesApplied.length > 0" class="ftl-preview__fix-badge">
            <span class="material-symbols-outlined">auto_fix_high</span>
            <span>Auto-fixed <strong>{{ fixesApplied.length }}</strong> issue{{ fixesApplied.length > 1 ? 's' : '' }}</span>
          </div>
        </Transition>

        <!-- Collapsible Variables -->
        <details class="ftl-preview__vars" :open="variables.length > 0">
          <summary class="ftl-preview__vars-head">
            <span class="ftl-preview__vars-label">
              <span class="material-symbols-outlined">tune</span>
              Variables
            </span>
            <span v-if="variables.length" class="ftl-preview__vars-count">{{ variables.length }}</span>
          </summary>
          <div class="ftl-preview__vars-body">
            <VariableForm
              :variables="variables"
              @update:variables="handleVariableUpdate"
            />
          </div>
        </details>

        <Transition name="slide-up">
          <div v-if="errors.length > 0" class="ftl-preview__errors">
            <div v-for="(err, i) in errors" :key="i" class="ftl-preview__error">
              <span class="material-symbols-outlined">error</span>
              {{ err }}
            </div>
          </div>
        </Transition>
      </section>
    </div>

    <!-- Live preview popup -->
    <Teleport to="body">
      <div class="ftl-preview__modal-overlay" v-show="showPreviewModal" @click.self="closePreviewModal">
        <div class="ftl-preview__modal">
          <div class="ftl-preview__modal-head">
            <div class="ftl-preview__panel-title"><span class="material-symbols-outlined">picture_as_pdf</span> Live Preview</div>
            <button class="ftl-preview__modal-close" @click="closePreviewModal" title="Close">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <section class="ftl-preview__panel ftl-preview__panel--preview">
        <Transition name="badge-pop">
          <div v-if="previewHtml && !selectedElement && pendingCount === 0" class="ftl-preview__hint">
            <span class="material-symbols-outlined">info</span>
            Click any text to edit content &amp; style
          </div>
        </Transition>

        <Transition name="badge-pop">
          <div v-if="pendingCount > 0" class="ftl-preview__pending-bar">
            <div class="ftl-preview__pending-info">
              <span class="material-symbols-outlined">edit_note</span>
              <strong>{{ pendingCount }}</strong> element{{ pendingCount > 1 ? 's' : '' }} edited
            </div>
            <div class="ftl-preview__pending-actions">
              <button class="ftl-preview__pending-btn ftl-preview__pending-btn--discard" @click="discardAll">
                <span class="material-symbols-outlined">close</span>
                Discard
              </button>
              <button class="ftl-preview__pending-btn ftl-preview__pending-btn--apply" @click="applyAll">
                <span class="material-symbols-outlined">check</span>
                Apply All
              </button>
            </div>
          </div>
        </Transition>

        <div class="ftl-preview__preview-container" ref="previewContainerRef">
          <Transition name="view-fade" mode="out-in">
            <div v-if="previewHtml" key="preview" class="ftl-preview__a4-wrapper">
              <div class="ftl-preview__a4-page">
                <iframe
                  ref="iframeRef"
                  :srcdoc="previewHtml"
                  class="ftl-preview__a4-iframe"
                  sandbox="allow-same-origin"
                  @load="onIframeLoad"
                />
              </div>
            </div>
            <div v-else key="empty" class="ftl-preview__empty">
              <div class="ftl-preview__empty-icon">
                <span class="material-symbols-outlined">edit_note</span>
              </div>
              <p class="ftl-preview__empty-title">No Preview Yet</p>
              <p class="ftl-preview__empty-sub">Enter FTL and click "Update Preview"</p>
            </div>
          </Transition>

          <!-- Floating Style Toolbar (preserved) -->
          <Transition name="toolbar-pop">
            <div
              v-if="selectedElement"
              class="ftl-preview__toolbar"
              :style="toolbarPosition"
              @mousedown.prevent
            >
              <div class="ftl-preview__toolbar-row">
                <!-- Font Family -->
                <select
                  v-model="styleConfig.fontFamily"
                  class="ftl-preview__tb-select"
                  @change="applyLiveStyle"
                >
                  <option value="Arial, sans-serif">Arial</option>
                  <option value="'Times New Roman', serif">Times NR</option>
                  <option value="Georgia, serif">Georgia</option>
                  <option value="Verdana, sans-serif">Verdana</option>
                  <option value="Tahoma, sans-serif">Tahoma</option>
                  <option value="'Courier New', monospace">Courier</option>
                  <option value="'Trebuchet MS', sans-serif">Trebuchet</option>
                </select>

                <!-- Font Size -->
                <div class="ftl-preview__tb-size">
                  <input
                    v-model.number="styleConfig.fontSize"
                    type="number"
                    min="6"
                    max="72"
                    class="ftl-preview__tb-input"
                    @change="applyLiveStyle"
                  />
                  <span class="ftl-preview__tb-unit">px</span>
                </div>

                <div class="ftl-preview__tb-divider"></div>

                <!-- Font Color -->
                <div class="ftl-preview__tb-color-wrap" title="Font Color">
                  <input
                    v-model="styleConfig.fontColor"
                    type="color"
                    class="ftl-preview__tb-color"
                    @input="applyLiveStyle"
                  />
                </div>

                <!-- Background Color -->
                <div class="ftl-preview__tb-color-wrap" title="Background Color">
                  <input
                    v-model="styleConfig.bgColor"
                    type="color"
                    class="ftl-preview__tb-color"
                    @input="applyLiveStyle"
                  />
                  <button
                    class="ftl-preview__tb-clear-bg"
                    v-if="styleConfig.bgColor !== '#ffffff'"
                    @click="styleConfig.bgColor = '#ffffff'; applyLiveStyle()"
                    title="Remove background"
                  >×</button>
                </div>

                <div class="ftl-preview__tb-divider"></div>

                <!-- Bold -->
                <button
                  class="ftl-preview__tb-btn"
                  :class="{ 'ftl-preview__tb-btn--active': styleConfig.fontWeight === 'bold' }"
                  @click="toggleBold"
                  title="Bold"
                >
                  <span class="material-symbols-outlined">format_bold</span>
                </button>

                <!-- Italic -->
                <button
                  class="ftl-preview__tb-btn"
                  :class="{ 'ftl-preview__tb-btn--active': styleConfig.fontStyle === 'italic' }"
                  @click="toggleItalic"
                  title="Italic"
                >
                  <span class="material-symbols-outlined">format_italic</span>
                </button>

                <!-- Underline -->
                <button
                  class="ftl-preview__tb-btn"
                  :class="{ 'ftl-preview__tb-btn--active': styleConfig.textDecoration === 'underline' }"
                  @click="toggleUnderline"
                  title="Underline"
                >
                  <span class="material-symbols-outlined">format_underlined</span>
                </button>

                <div class="ftl-preview__tb-divider"></div>

                <!-- Alignment -->
                <button
                  class="ftl-preview__tb-btn"
                  :class="{ 'ftl-preview__tb-btn--active': styleConfig.textAlign === 'left' }"
                  @click="setAlign('left')"
                  title="Align Left"
                >
                  <span class="material-symbols-outlined">format_align_left</span>
                </button>
                <button
                  class="ftl-preview__tb-btn"
                  :class="{ 'ftl-preview__tb-btn--active': styleConfig.textAlign === 'center' }"
                  @click="setAlign('center')"
                  title="Align Center"
                >
                  <span class="material-symbols-outlined">format_align_center</span>
                </button>
                <button
                  class="ftl-preview__tb-btn"
                  :class="{ 'ftl-preview__tb-btn--active': styleConfig.textAlign === 'right' }"
                  @click="setAlign('right')"
                  title="Align Right"
                >
                  <span class="material-symbols-outlined">format_align_right</span>
                </button>
                <button
                  class="ftl-preview__tb-btn"
                  :class="{ 'ftl-preview__tb-btn--active': styleConfig.textAlign === 'justify' }"
                  @click="setAlign('justify')"
                  title="Justify"
                >
                  <span class="material-symbols-outlined">format_align_justify</span>
                </button>

                <div class="ftl-preview__tb-divider"></div>

                <!-- Done (deselect, keep changes pending) -->
                <button class="ftl-preview__tb-btn ftl-preview__tb-btn--save" @click="doneEdit" title="Done (changes pending)">
                  <span class="material-symbols-outlined">check</span>
                </button>
                <!-- Revert this element -->
                <button class="ftl-preview__tb-btn ftl-preview__tb-btn--cancel" @click="revertCurrent" title="Revert this element">
                  <span class="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </section>
        </div>
      </div>
    </Teleport>

    <!-- ── PDF tab: full-bleed A4 on a frosted canvas ── -->
    <div v-if="tab === 'pdf'" class="ftl-preview__pdf">
      <Transition name="badge-pop">
        <div v-if="!pdf.javaAvailable.value" class="ftl-preview__java-warn">
          <span class="material-symbols-outlined">warning</span>
          <span>Java not detected. Install a JRE (e.g. <a href="https://adoptium.net/temurin/releases/?version=8" target="_blank" rel="noopener">Temurin 8</a>) to enable true Flying Saucer PDF. The preview below is <strong>approximate</strong> — not Flying Saucer (CSS 2.1 not enforced).</span>
        </div>
      </Transition>

      <div class="ftl-preview__canvas">
        <Transition name="view-fade" mode="out-in">
          <iframe
            v-if="pdf.pdfUrl.value"
            key="pdf"
            :src="pdf.pdfUrl.value"
            class="ftl-preview__pdf-iframe"
            title="Flying Saucer PDF"
          ></iframe>
          <div v-else key="empty" class="ftl-preview__empty">
            <div class="ftl-preview__empty-icon">
              <span class="material-symbols-outlined">picture_as_pdf</span>
            </div>
            <p class="ftl-preview__empty-title">No PDF Yet</p>
            <p class="ftl-preview__empty-sub">Click "Render Flying Saucer PDF" to generate</p>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useFtlFixer } from '../composables/useFtlFixer'
import { useVariableDetector } from '../composables/useVariableDetector'
import { useFtlProcessor } from '../composables/useFtlProcessor'
import { useToast } from '@lib/composables/useToast'
import { useFtlPdfRenderer } from '../composables/useFtlPdfRenderer'
import CodeEditor from './CodeEditor.vue'
import VariableForm from './VariableForm.vue'

const toast = useToast()
const { fix } = useFtlFixer()
const { detect } = useVariableDetector()
const { process: processFtl, processing, errors } = useFtlProcessor()
const pdf = useFtlPdfRenderer()
const tab = ref('editor') // 'editor' | 'pdf'  (top-level tab)

const inputFtl = ref('')
const variables = ref([])
const fixesApplied = ref([])
const previewHtml = ref('')
const showPreviewModal = ref(false)
const iframeRef = ref(null)
const previewContainerRef = ref(null)

const selectedElement = ref(null)
const selectedOriginalHTML = ref('')
const toolbarPosition = ref({ top: '0px', left: '0px' })

const styleConfig = reactive({
  fontFamily: "'Times New Roman', serif",
  fontSize: 12,
  fontColor: '#000000',
  bgColor: '#ffffff',
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  textAlign: 'left',
})

// Pending changes map: element → { tag, origText, inlineStyle, newText }
const pendingChanges = ref(new Map())
const pendingCount = ref(0)

let fixCount = 0
let iframeClickHandler = null

watch(inputFtl, (val) => {
  if (val && val.trim()) {
    if (fixCount === 0) {
      const { ftl, fixes } = fix(val)
      if (fixes.length > 0) {
        fixesApplied.value = fixes
        inputFtl.value = ftl
        fixCount++
        return
      }
    }
    variables.value = detect(val)
  } else {
    variables.value = []
    fixesApplied.value = []
    previewHtml.value = ''
    fixCount = 0
  }
})

onMounted(() => { pdf.checkHealth() })

onBeforeUnmount(() => {
  cleanupIframeListener()
  pdf.dispose()
})

function handleVariableUpdate(updated) {
  variables.value = updated
}

function handleFileUpload(e) {
  const file = e.target.files[0]
  e.target.value = ''
  if (!file) return
  fixCount = 0
  const reader = new FileReader()
  reader.onload = (ev) => {
    inputFtl.value = ev.target.result
  }
  reader.readAsText(file)
}

function handleRender() {
  if (!inputFtl.value.trim()) return

  const varMap = {}
  for (const v of variables.value) {
    varMap[v.name] = v.value
  }

  const { ftl: fixedFtl } = fix(inputFtl.value)
  const result = processFtl(fixedFtl, varMap)
  previewHtml.value = wrapA4Preview(result)
  showPreviewModal.value = true

  if (errors.value.length === 0) {
    toast.success('Preview rendered!')
  }
}

function closePreviewModal() {
  // Save any in-progress edit before hiding so it isn't lost when the iframe is hidden.
  if (selectedElement.value) saveToPending()
  showPreviewModal.value = false
}

async function renderFlyingSaucerPdf() {
  if (!inputFtl.value.trim()) return
  const varMap = {}
  for (const v of variables.value) varMap[v.name] = v.value
  const { ftl: fixedFtl } = fix(inputFtl.value)
  const url = await pdf.render(fixedFtl, varMap)
  if (url) {
    tab.value = 'pdf'
    toast.success('Flying Saucer PDF rendered!')
  } else if (!pdf.javaAvailable.value) {
    toast.error('Java not detected — showing approximate preview instead.')
  } else {
    toast.error(pdf.lastError.value || 'PDF render failed')
  }
}

function downloadPdf() {
  if (!pdf.pdfUrl.value) return
  const a = document.createElement('a')
  a.href = pdf.pdfUrl.value
  a.download = 'template.pdf'
  a.click()
}

// ── Iframe Click Handling ──

function cleanupIframeListener() {
  if (iframeClickHandler && iframeRef.value) {
    try {
      const doc = iframeRef.value.contentDocument
      if (doc) doc.removeEventListener('click', iframeClickHandler, true)
    } catch (_) {}
    iframeClickHandler = null
  }
}

function onIframeLoad() {
  cleanupIframeListener()
  selectedElement.value = null

  const iframe = iframeRef.value
  if (!iframe) return

  try {
    const doc = iframe.contentDocument
    if (!doc) return

    // Add hover/edit styles
    const styleEl = doc.createElement('style')
    styleEl.textContent = `
      [data-sop-editable]:hover {
        outline: 2px dashed rgba(255,188,37,0.6) !important;
        outline-offset: 3px;
        cursor: pointer !important;
      }
      [data-sop-selected] {
        outline: 2px solid #FFBC25 !important;
        outline-offset: 3px;
      }
      [data-sop-editing] {
        outline: 2px solid #10B981 !important;
        outline-offset: 3px;
        cursor: text !important;
        min-width: 20px;
      }
    `
    doc.head.appendChild(styleEl)

    // Mark text elements as editable
    const textTags = doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, td, th, li, span, a, label, caption')
    textTags.forEach(el => {
      if (el.textContent.trim()) {
        el.setAttribute('data-sop-editable', '')
      }
    })
    // Also mark body children
    Array.from(doc.body.children).forEach(el => {
      if (el.textContent.trim() && !el.hasAttribute('data-sop-editable')) {
        el.setAttribute('data-sop-editable', '')
      }
    })

    iframeClickHandler = (e) => {
      const el = e.target

      // Clicked outside editable → deselect current (keep pending)
      if (!el || !el.hasAttribute('data-sop-editable')) {
        if (selectedElement.value) saveToPending()
        return
      }

      e.preventDefault()
      e.stopPropagation()

      // Already editing this element
      if (el.hasAttribute('data-sop-editing')) return

      // Save current element to pending before switching
      if (selectedElement.value && selectedElement.value !== el) {
        saveToPending()
      }

      // Store original HTML for revert (use pending's orig if already edited)
      if (pendingChanges.value.has(el)) {
        selectedOriginalHTML.value = pendingChanges.value.get(el).origHTML
      } else {
        selectedOriginalHTML.value = el.outerHTML
      }

      // Read computed styles
      const computed = doc.defaultView.getComputedStyle(el)
      styleConfig.fontFamily = computed.fontFamily || "'Times New Roman', serif"
      styleConfig.fontSize = parseInt(computed.fontSize) || 12
      styleConfig.fontColor = rgbToHex(computed.color)
      styleConfig.bgColor = rgbToHex(computed.backgroundColor) || '#ffffff'
      styleConfig.fontWeight = computed.fontWeight || 'normal'
      styleConfig.fontStyle = computed.fontStyle || 'normal'
      styleConfig.textDecoration = computed.textDecoration || 'none'
      styleConfig.textAlign = computed.textAlign || 'left'

      selectedElement.value = el
      el.setAttribute('data-sop-selected', '')

      // Make editable
      el.contentEditable = 'true'
      el.setAttribute('data-sop-editing', '')
      el.focus()

      nextTick(() => positionToolbar(el))
    }

    doc.addEventListener('click', iframeClickHandler, true)
  } catch (_) {}
}

function deselectElement() {
  const el = selectedElement.value
  if (!el) return

  el.removeAttribute('data-sop-selected')
  el.removeAttribute('data-sop-editing')
  el.contentEditable = 'false'
  el.style.outline = ''
  el.style.outlineOffset = ''
}

function positionToolbar(el) {
  const iframe = iframeRef.value
  if (!iframe || !previewContainerRef.value) return

  const iframeRect = iframe.getBoundingClientRect()
  const containerRect = previewContainerRef.value.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()

  const iframeOffsetTop = iframeRect.top - containerRect.top
  const iframeOffsetLeft = iframeRect.left - containerRect.left

  let top = iframeOffsetTop + elRect.top - 52
  let left = iframeOffsetLeft + elRect.left

  if (top < 0) top = iframeOffsetTop + elRect.bottom + 8
  if (left < 0) left = 8

  const maxLeft = containerRect.width - 640
  if (left > maxLeft) left = Math.max(8, maxLeft)

  toolbarPosition.value = { top: top + 'px', left: left + 'px' }
}

// ── Style Application ──

function applyLiveStyle() {
  const el = selectedElement.value
  if (!el) return

  el.style.fontFamily = styleConfig.fontFamily
  el.style.fontSize = styleConfig.fontSize + 'px'
  el.style.color = styleConfig.fontColor
  el.style.backgroundColor = styleConfig.bgColor
  el.style.fontWeight = styleConfig.fontWeight
  el.style.fontStyle = styleConfig.fontStyle
  el.style.textDecoration = styleConfig.textDecoration
  el.style.textAlign = styleConfig.textAlign
}

function toggleBold() {
  styleConfig.fontWeight = styleConfig.fontWeight === 'bold' ? 'normal' : 'bold'
  applyLiveStyle()
}

function toggleItalic() {
  styleConfig.fontStyle = styleConfig.fontStyle === 'italic' ? 'normal' : 'italic'
  applyLiveStyle()
}

function toggleUnderline() {
  styleConfig.textDecoration = styleConfig.textDecoration === 'underline' ? 'none' : 'underline'
  applyLiveStyle()
}

function setAlign(align) {
  styleConfig.textAlign = align
  applyLiveStyle()
}

// ── Pending Changes ──

function buildInlineStyle() {
  const styles = []
  styles.push(`font-family: ${styleConfig.fontFamily}`)
  styles.push(`font-size: ${styleConfig.fontSize}px`)
  styles.push(`color: ${styleConfig.fontColor}`)
  if (styleConfig.bgColor !== '#ffffff') styles.push(`background-color: ${styleConfig.bgColor}`)
  if (styleConfig.fontWeight !== 'normal') styles.push(`font-weight: ${styleConfig.fontWeight}`)
  if (styleConfig.fontStyle !== 'normal') styles.push(`font-style: ${styleConfig.fontStyle}`)
  if (styleConfig.textDecoration !== 'none') styles.push(`text-decoration: ${styleConfig.textDecoration}`)
  if (styleConfig.textAlign !== 'left') styles.push(`text-align: ${styleConfig.textAlign}`)
  return styles.join('; ')
}

function saveToPending() {
  const el = selectedElement.value
  if (!el) return

  const inlineStyle = buildInlineStyle()
  const tag = el.tagName.toLowerCase()
  const newText = el.innerText.trim()

  // Store or update pending change
  pendingChanges.value.set(el, {
    tag,
    inlineStyle,
    newText,
    origHTML: selectedOriginalHTML.value || el.outerHTML,
  })

  pendingCount.value = pendingChanges.value.size

  // Deselect but keep element styled
  el.removeAttribute('data-sop-selected')
  el.removeAttribute('data-sop-editing')
  el.contentEditable = 'false'
  el.style.outline = ''
  el.style.outlineOffset = ''
  selectedElement.value = null
}

function doneEdit() {
  saveToPending()
  toast.info('Edit saved. Click "Apply All" to update template.')
}

function revertCurrent() {
  const el = selectedElement.value
  if (!el) return

  // Remove from pending if exists
  if (pendingChanges.value.has(el)) {
    const pending = pendingChanges.value.get(el)
    // Restore original HTML
    const temp = document.createElement('div')
    temp.innerHTML = pending.origHTML
    el.textContent = temp.textContent
    el.removeAttribute('style')
    pendingChanges.value.delete(el)
    pendingCount.value = pendingChanges.value.size
  } else {
    // Restore from selectedOriginalHTML
    const temp = document.createElement('div')
    temp.innerHTML = selectedOriginalHTML.value
    el.textContent = temp.textContent
    el.removeAttribute('style')
  }

  deselectElement()
  selectedElement.value = null
}

function discardAll() {
  // Revert all pending changes in preview
  for (const [el, pending] of pendingChanges.value) {
    const temp = document.createElement('div')
    temp.innerHTML = pending.origHTML
    el.textContent = temp.textContent
    el.removeAttribute('style')
    el.removeAttribute('data-sop-selected')
    el.removeAttribute('data-sop-editing')
  }
  pendingChanges.value.clear()
  pendingCount.value = 0
  selectedElement.value = null
  toast.info('All changes discarded.')
}

function applyAll() {
  if (pendingChanges.value.size === 0) return

  // Save current element first if editing
  if (selectedElement.value) {
    saveToPending()
  }

  const count = pendingChanges.value.size
  let ftl = inputFtl.value

  // Apply each pending change to FTL template
  for (const [el, change] of pendingChanges.value) {
    const { tag, inlineStyle, newText } = change

    // Get original text from the stored original HTML
    const temp = document.createElement('div')
    temp.innerHTML = change.origHTML
    const origText = temp.textContent.trim()
    const origTextEscaped = escapeRegex(origText)

    // Strategy 1: Exact match by tag + text
    const textRegex = new RegExp(`(<${tag}[^>]*>)(${origTextEscaped})(</${tag}>)`, 'gi')
    const match = textRegex.exec(ftl)

    if (match) {
      const existingStyleMatch = match[1].match(/style="([^"]*)"/)
      let newTagOpen
      if (existingStyleMatch) {
        newTagOpen = match[1].replace(/style="[^"]*"/, `style="${inlineStyle}"`)
      } else {
        newTagOpen = match[1].replace(/<(\w+)/, `<$1 style="${inlineStyle}"`)
      }
      const replacement = `${newTagOpen}${newText}${match[3]}`
      ftl = ftl.substring(0, match.index) + replacement + ftl.substring(match.index + match[0].length)
    } else {
      // Strategy 2: Find by tag + first line
      const firstLine = origText.split('\n')[0].trim().substring(0, 50)
      if (firstLine.length > 3) {
        const lineRegex = new RegExp(`(<${tag}[^>]*>)[^<]*${escapeRegex(firstLine)}[^<]*(</${tag}>)`, 'gi')
        const lineMatch = lineRegex.exec(ftl)
        if (lineMatch) {
          let newTagOpen = lineMatch[1]
          const existingStyle = newTagOpen.match(/style="([^"]*)"/)
          if (existingStyle) {
            newTagOpen = newTagOpen.replace(/style="[^"]*"/, `style="${inlineStyle}"`)
          } else {
            newTagOpen = newTagOpen.replace(/<(\w+)/, `<$1 style="${inlineStyle}"`)
          }
          const replacement = `${newTagOpen}${newText}${lineMatch[2]}`
          ftl = ftl.substring(0, lineMatch.index) + replacement + ftl.substring(lineMatch.index + lineMatch[0].length)
        }
      }
    }
  }

  inputFtl.value = ftl
  pendingChanges.value.clear()
  pendingCount.value = 0
  selectedElement.value = null

  toast.success(`${count} change${count > 1 ? 's' : ''} applied!`)

  if (previewHtml.value) {
    handleRender()
  }
}

// ── Helpers ──

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function rgbToHex(rgb) {
  if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return '#ffffff'
  if (rgb.startsWith('#')) return rgb
  const match = rgb.match(/\d+/g)
  if (!match || match.length < 3) return '#000000'
  return '#' + match.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('')
}

function wrapA4Preview(bodyHtml) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A4; margin: 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Times New Roman', 'Georgia', serif;
      font-size: 12pt;
      line-height: 1.5;
      color: #000;
      padding: 15mm;
      background: white;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    img { max-width: 100%; height: auto; }
    table { width: 100%; border-collapse: collapse; margin: 10pt 0; }
    td, th { padding: 6pt 8pt; border: 1px solid #ccc; text-align: left; vertical-align: top; }
    th { background: #f0f0f0; font-weight: bold; }
    h1 { font-size: 18pt; margin: 12pt 0 6pt; }
    h2 { font-size: 14pt; margin: 10pt 0 4pt; }
    h3 { font-size: 12pt; margin: 8pt 0 4pt; }
    p { margin: 6pt 0; }
    ul, ol { margin: 6pt 0 6pt 20pt; }
    a { color: #0066cc; text-decoration: underline; }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`
}
</script>

<style scoped>
.ftl-preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-md, 16px);
  height: 100%;
}

/* ── Glass header + tab bar ── */
.ftl-preview__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md, 16px);
  padding: 10px 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: var(--shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.06));
}

.ftl-preview__tabs {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.05);
}

.ftl-preview__tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--color-on-surface-variant, #808080);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all var(--dur-micro, 120ms) var(--ease-smooth, cubic-bezier(0.4, 0, 0.2, 1));
}

.ftl-preview__tab .material-symbols-outlined { font-size: 18px; }

.ftl-preview__tab:hover:not(.ftl-preview__tab--active) {
  color: var(--color-on-surface, #1a1a2e);
  background: rgba(255, 255, 255, 0.5);
}

.ftl-preview__tab--active {
  background: #fff;
  color: var(--color-on-surface, #1a1a2e);
  box-shadow: var(--shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.08));
}

.ftl-preview__tab--active .material-symbols-outlined {
  color: var(--cta-primary-bg, #FFBC25);
}

.ftl-preview__header-action {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

/* ── Primary CTA (contextual, per tab) ── */
.ftl-preview__cta {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 22px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--cta-primary-bg, #FFBC25), #FF9500);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(255, 188, 37, 0.3);
  transition: all var(--dur-micro, 120ms) var(--ease-smooth, cubic-bezier(0.4, 0, 0.2, 1));
}

.ftl-preview__cta .material-symbols-outlined { font-size: 18px; }

.ftl-preview__cta:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 24px rgba(255, 188, 37, 0.4);
}

.ftl-preview__cta:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }

.ftl-preview__btn-shine {
  position: absolute;
  top: 0; left: -100%;
  width: 100%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  transition: left 0.5s ease;
  pointer-events: none;
}
.ftl-preview__cta:hover:not(:disabled) .ftl-preview__btn-shine { left: 100%; }

.ftl-preview__btn-spinner {
  width: 16px; height: 16px;
  border: 2.5px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.ftl-preview__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px; height: 38px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.5);
  color: var(--color-on-surface-variant, #666);
  cursor: pointer;
  font-family: inherit;
  transition: all var(--dur-micro, 120ms) ease;
}
.ftl-preview__icon-btn:hover {
  border-color: var(--cta-primary-bg, #FFBC25);
  color: var(--color-on-surface, #1a1a2e);
  background: rgba(255, 188, 37, 0.08);
}
.ftl-preview__icon-btn .material-symbols-outlined { font-size: 20px; }

/* ── Editor tab: code panel (preview opens in a popup) ── */
.ftl-preview__editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-md, 16px);
}

.ftl-preview__panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: var(--shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.06));
  min-width: 0;
}

.ftl-preview__panel--preview {
  flex: 1;
  min-height: 0; /* fill the modal; the A4 scrolls inside */
}

/* ── Preview popup modal ── */
.ftl-preview__modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-lg, 24px);
  background: rgba(15, 17, 26, 0.55);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.ftl-preview__modal {
  display: flex;
  flex-direction: column;
  width: min(96vw, 940px);
  max-height: 92vh;
  padding: 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow: var(--shadow-xl, 0 20px 60px rgba(0, 0, 0, 0.3));
}
.ftl-preview__modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.ftl-preview__modal-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.05);
  color: var(--color-on-surface-variant, #666);
  cursor: pointer;
  transition: all 0.2s ease;
}
.ftl-preview__modal-close:hover {
  background: rgba(0, 0, 0, 0.1);
  color: var(--color-on-surface, #1a1a2e);
}
.ftl-preview__modal-close .material-symbols-outlined { font-size: 20px; }

.ftl-preview__panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ftl-preview__panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-on-surface, #1a1a2e);
}
.ftl-preview__panel-title .material-symbols-outlined {
  font-size: 20px;
  color: var(--cta-primary-bg, #FFBC25);
}

.ftl-preview__upload-btn {
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
  color: var(--color-on-surface-variant, #666);
  font-family: inherit;
  transition: all 0.25s ease;
}
.ftl-preview__upload-btn .material-symbols-outlined { font-size: 16px; }
.ftl-preview__upload-btn:hover {
  border-color: var(--cta-primary-bg, #FFBC25);
  color: var(--color-on-surface, #1a1a2e);
  background: rgba(255, 188, 37, 0.05);
}
.ftl-preview__file-hidden { display: none; }

.ftl-preview__editor-wrap {
  /* Fixed compact height — the code scrolls inside; no longer stretches to the A4. */
  height: clamp(280px, 46vh, 440px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.ftl-preview__editor-wrap .code-editor,
.ftl-preview__editor-wrap .code-editor__wrapper { height: 100%; flex: 1; overflow: hidden; }
.ftl-preview__editor-wrap .code-editor__textarea { height: 100%; overflow-y: auto; }

.ftl-preview__fix-badge {
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
.ftl-preview__fix-badge .material-symbols-outlined { font-size: 18px; color: var(--cta-primary-bg, #FFBC25); }

/* Collapsible Variables */
.ftl-preview__vars {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.4);
  overflow: hidden;
}
.ftl-preview__vars-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  cursor: pointer;
  list-style: none;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-on-surface, #1a1a2e);
}
.ftl-preview__vars-head::-webkit-details-marker { display: none; }
.ftl-preview__vars-label { display: inline-flex; align-items: center; gap: 8px; }
.ftl-preview__vars-label .material-symbols-outlined { font-size: 18px; color: var(--cta-primary-bg, #FFBC25); }
.ftl-preview__vars-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: rgba(255, 188, 37, 0.15);
  color: #8b6914;
  font-size: 11px;
  font-weight: 700;
}
.ftl-preview__vars-body { padding: 4px 14px 14px; }

.ftl-preview__errors { display: flex; flex-direction: column; gap: 6px; }
.ftl-preview__error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(200, 62, 59, 0.06);
  border: 1px solid rgba(200, 62, 59, 0.1);
  border-radius: 10px;
  font-size: 13px;
  color: var(--color-error, #C83E3B);
}
.ftl-preview__error .material-symbols-outlined { font-size: 16px; }

.ftl-preview__hint {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(255, 188, 37, 0.06);
  border: 1px solid rgba(255, 188, 37, 0.15);
  border-radius: 8px;
  font-size: 12px;
  color: #8b6914;
}
.ftl-preview__hint .material-symbols-outlined { font-size: 16px; color: var(--cta-primary-bg, #FFBC25); }

/* ── Pending Changes Bar (preserved) ── */
.ftl-preview__pending-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.04));
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 10px;
}
.ftl-preview__pending-info { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #065f46; }
.ftl-preview__pending-info .material-symbols-outlined { font-size: 18px; color: var(--color-success, #10B981); }
.ftl-preview__pending-actions { display: flex; gap: 6px; }
.ftl-preview__pending-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s ease;
}
.ftl-preview__pending-btn .material-symbols-outlined { font-size: 15px; }
.ftl-preview__pending-btn--discard { background: rgba(0, 0, 0, 0.06); color: #666; }
.ftl-preview__pending-btn--discard:hover { background: rgba(0, 0, 0, 0.1); }
.ftl-preview__pending-btn--apply {
  background: linear-gradient(135deg, var(--color-success, #10B981), #059669);
  color: #fff;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}
.ftl-preview__pending-btn--apply:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4); }

/* ── Preview container (canvas look) ── */
.ftl-preview__preview-container {
  position: relative;
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background:
    radial-gradient(circle at 1px 1px, rgba(0, 0, 0, 0.06) 1px, transparent 0) 0 0 / 18px 18px,
    #f3f4f6;
  border-radius: 14px;
  overflow: auto;
  min-height: 0; /* fill the modal body; the A4 scrolls inside */
  padding: 4px;
}

.ftl-preview__a4-wrapper {
  padding: 24px;
  animation: a4Reveal 0.5s var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1)) both;
}
@keyframes a4Reveal {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
.ftl-preview__a4-page {
  width: 210mm;
  min-height: 297mm;
  background: white;
  box-shadow: var(--shadow-lg, 0 10px 30px rgba(0, 0, 0, 0.12));
  border-radius: 3px;
  overflow: hidden;
}
.ftl-preview__a4-iframe { width: 100%; min-height: 297mm; border: none; display: block; }

.ftl-preview__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 380px;
  gap: 12px;
}
.ftl-preview__empty-icon {
  width: 72px; height: 72px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 20px;
}
.ftl-preview__empty-icon .material-symbols-outlined { font-size: 36px; color: #ccc; }
.ftl-preview__empty-title { font-size: 16px; font-weight: 700; color: #999; margin: 0; }
.ftl-preview__empty-sub { font-size: 13px; color: #bbb; margin: 0; }

/* ── Floating Toolbar (preserved verbatim) ── */
.ftl-preview__toolbar {
  position: absolute;
  z-index: 100;
  background: #1a1b26;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 6px 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.15);
  max-width: calc(100% - 16px);
}
.ftl-preview__toolbar-row { display: flex; align-items: center; gap: 4px; flex-wrap: nowrap; }
.ftl-preview__tb-select {
  padding: 6px 24px 6px 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 7px;
  font-size: 11px;
  font-family: inherit;
  color: #e0e0e0;
  background: rgba(255, 255, 255, 0.06);
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
  min-width: 90px;
}
.ftl-preview__tb-select:focus { outline: none; border-color: var(--cta-primary-bg, #FFBC25); }
.ftl-preview__tb-select option { background: #1a1b26; color: #e0e0e0; }
.ftl-preview__tb-size { display: flex; align-items: center; gap: 3px; }
.ftl-preview__tb-input {
  width: 44px;
  padding: 6px 4px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 7px;
  font-size: 11px;
  font-family: inherit;
  color: #e0e0e0;
  background: rgba(255, 255, 255, 0.06);
  text-align: center;
}
.ftl-preview__tb-input:focus { outline: none; border-color: var(--cta-primary-bg, #FFBC25); }
.ftl-preview__tb-unit { font-size: 10px; color: #888; font-weight: 500; }
.ftl-preview__tb-divider { width: 1px; height: 20px; background: rgba(255, 255, 255, 0.1); margin: 0 2px; flex-shrink: 0; }
.ftl-preview__tb-color-wrap { position: relative; display: flex; align-items: center; gap: 2px; }
.ftl-preview__tb-color {
  width: 26px; height: 26px;
  border: 2px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  cursor: pointer;
  padding: 1px;
  background: transparent;
}
.ftl-preview__tb-color::-webkit-color-swatch-wrapper { padding: 0; }
.ftl-preview__tb-color::-webkit-color-swatch { border: none; border-radius: 3px; }
.ftl-preview__tb-clear-bg {
  width: 16px; height: 16px;
  border: none; border-radius: 50%;
  background: rgba(231, 76, 60, 0.8);
  color: white; font-size: 10px; line-height: 1;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  padding: 0;
}
.ftl-preview__tb-btn {
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px;
  border: none; border-radius: 7px;
  background: transparent; color: #999;
  cursor: pointer; font-family: inherit;
  transition: all 0.15s ease;
  flex-shrink: 0;
}
.ftl-preview__tb-btn .material-symbols-outlined { font-size: 17px; }
.ftl-preview__tb-btn:hover { color: #e0e0e0; background: rgba(255, 255, 255, 0.08); }
.ftl-preview__tb-btn--active { color: var(--cta-primary-bg, #FFBC25); background: rgba(255, 188, 37, 0.12); }
.ftl-preview__tb-btn--active:hover { background: rgba(255, 188, 37, 0.18); }
.ftl-preview__tb-btn--save { color: var(--color-success, #10B981); }
.ftl-preview__tb-btn--save:hover { background: rgba(16, 185, 129, 0.12); }
.ftl-preview__tb-btn--cancel { color: #e74c3c; }
.ftl-preview__tb-btn--cancel:hover { background: rgba(231, 76, 60, 0.12); }

/* ── PDF tab ── */
.ftl-preview__pdf {
  display: flex;
  flex-direction: column;
  gap: var(--space-md, 16px);
  flex: 1;
  min-height: 0;
}
.ftl-preview__canvas {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  overflow: auto;
  /* Cap to viewport so the PDF page scrolls inside the canvas, not the page. */
  min-height: 360px;
  max-height: calc(100vh - 200px);
  padding: 28px;
  border-radius: 16px;
  background:
    radial-gradient(circle at 1px 1px, rgba(0, 0, 0, 0.05) 1px, transparent 0) 0 0 / 20px 20px,
    #f3f4f6;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.04);
}
.ftl-preview__pdf-iframe {
  width: 210mm;
  min-height: 297mm;
  border: none;
  display: block;
  background: white;
  box-shadow: var(--shadow-lg, 0 10px 30px rgba(0, 0, 0, 0.12));
  border-radius: 3px;
}

/* ── Java Fallback Banner (preserved) ── */
.ftl-preview__java-warn {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(255, 107, 0, 0.06);
  border: 1px solid rgba(255, 107, 0, 0.18);
  border-radius: 10px;
  font-size: 12px;
  color: #c45e00;
  line-height: 1.5;
}
.ftl-preview__java-warn .material-symbols-outlined { font-size: 18px; color: #FF6B00; flex-shrink: 0; margin-top: 1px; }
.ftl-preview__java-warn a { color: #c45e00; text-decoration: underline; }

/* ── Transitions (preserved) ── */
.badge-pop-enter-active { transition: all 0.4s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)); }
.badge-pop-leave-active { transition: all 0.2s ease; }
.badge-pop-enter-from { opacity: 0; transform: scale(0.9) translateY(-4px); }
.badge-pop-leave-to { opacity: 0; }
.slide-up-enter-active { transition: all 0.4s var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1)); }
.slide-up-leave-active { transition: all 0.2s ease-in; }
.slide-up-enter-from { opacity: 0; transform: translateY(12px); }
.slide-up-leave-to { opacity: 0; }
.view-fade-enter-active { transition: all 0.3s var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1)); }
.view-fade-leave-active { transition: all 0.15s ease-in; }
.view-fade-enter-from { opacity: 0; transform: translateY(8px); }
.view-fade-leave-to { opacity: 0; }
.toolbar-pop-enter-active { transition: all 0.25s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)); }
.toolbar-pop-leave-active { transition: all 0.15s ease-in; }
.toolbar-pop-enter-from { opacity: 0; transform: scale(0.92) translateY(6px); }
.toolbar-pop-leave-to { opacity: 0; transform: scale(0.95); }

/* ── Responsive (≤1100px / ≤900px breakpoints) ── */
@media (max-width: 1100px) {
  .ftl-preview__editor { grid-template-columns: 40fr 60fr; gap: 12px; }
  .ftl-preview__panel { padding: 12px; }
}

@media (max-width: 900px) {
  .ftl-preview__editor {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
  }
  .ftl-preview__editor-wrap { min-height: 200px; max-height: 320px; }
  .ftl-preview__header { flex-wrap: wrap; gap: 10px; }
  .ftl-preview__cta { padding: 9px 16px; font-size: 12px; }
  /* On narrow screens, pin the toolbar full-width at the pane top. !important is
     required to override the inline `left` set by positionToolbar() in JS. */
  .ftl-preview__toolbar {
    left: 8px !important;
    right: 8px;
  }
}
</style>
