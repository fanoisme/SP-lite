<template>
  <div class="html-preview">
    <div class="html-preview__layout">
      <!-- Left: Input -->
      <div class="html-preview__left">
        <div class="html-preview__section-header">
          <div class="html-preview__section-title">
            <span class="material-symbols-outlined">code</span>
            HTML Source
          </div>
          <label class="html-preview__upload-btn">
            <span class="material-symbols-outlined">upload_file</span>
            Upload
            <input
              type="file"
              accept=".html,.htm"
              class="html-preview__file-hidden"
              @change="handleFileUpload"
            />
          </label>
        </div>

        <div class="html-preview__editor-wrap">
          <CodeEditor
            v-model="inputHtml"
            placeholder="Paste your HTML code here... Use ${variableName} for dynamic values"
            :rows="14"
          />
        </div>

        <!-- Auto-fix badge -->
        <Transition name="badge-pop">
          <div v-if="fixesApplied.length > 0" class="html-preview__fix-badge">
            <span class="material-symbols-outlined">auto_fix_high</span>
            <span>Auto-fixed <strong>{{ fixesApplied.length }}</strong> issue{{ fixesApplied.length > 1 ? 's' : '' }}</span>
          </div>
        </Transition>

        <!-- Variables -->
        <VariableForm
          :variables="variables"
          @update:variables="handleVariableUpdate"
        />
      </div>

      <!-- Right: Preview -->
      <div class="html-preview__right">
        <div class="html-preview__section-header">
          <div class="html-preview__section-title">
            <span class="material-symbols-outlined">preview</span>
            Live Preview
          </div>
          <div class="html-preview__header-actions">
            <Transition name="fade">
              <span v-if="previewHtml" class="html-preview__live-badge">
                <span class="html-preview__live-dot"></span>
                Live
              </span>
            </Transition>
            <Transition name="fade">
              <button
                v-if="wysiwygEnabled"
                class="html-preview__wysiwyg-toggle"
                :class="{ 'html-preview__wysiwyg-toggle--active': wysiwygEnabled && previewHtml }"
                @click="toggleWysiwyg"
                :title="wysiwygMode ? 'Disable inline editing' : 'Enable inline editing'"
              >
                <span class="material-symbols-outlined">{{ wysiwygMode ? 'edit_off' : 'edit' }}</span>
                {{ wysiwygMode ? 'Editing' : 'Edit' }}
              </button>
            </Transition>
          </div>
        </div>

        <div class="html-preview__preview-frame" ref="previewContainerRef">
          <!-- Hint for WYSIWYG mode -->
          <Transition name="badge-pop">
            <div v-if="wysiwygMode && previewHtml && !selectedElement" class="html-preview__hint">
              <span class="material-symbols-outlined">info</span>
              Click any text to edit content &amp; style
            </div>
          </Transition>

          <Transition name="view-fade" mode="out-in">
            <iframe
              v-if="previewHtml"
              ref="iframeRef"
              :key="'preview-' + wysiwygMode"
              :srcdoc="previewSrcdoc"
              class="html-preview__iframe"
              sandbox="allow-same-origin"
              @load="onIframeLoad"
            />
            <div v-else key="empty" class="html-preview__empty">
              <div class="html-preview__empty-icon">
                <span class="material-symbols-outlined">preview</span>
              </div>
              <p class="html-preview__empty-title">No Preview</p>
              <p class="html-preview__empty-sub">Enter HTML code on the left to see a live preview</p>
            </div>
          </Transition>

          <!-- Floating Style Toolbar -->
          <Transition name="toolbar-pop">
            <div
              v-if="selectedElement && wysiwygMode"
              class="html-preview__toolbar"
              :style="toolbarPosition"
              @mousedown.prevent
            >
              <div class="html-preview__toolbar-row" @mousedown.stop>
                <!-- Font Family -->
                <select
                  v-model="styleConfig.fontFamily"
                  class="html-preview__tb-select"
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
                <div class="html-preview__tb-size">
                  <input
                    :value="styleConfig.fontSize"
                    type="number"
                    min="6"
                    max="72"
                    class="html-preview__tb-input"
                    @input="onFontSizeInput"
                    @change="onFontSizeInput"
                  />
                  <span class="html-preview__tb-unit">pt</span>
                </div>

                <div class="html-preview__tb-divider"></div>

                <!-- Font Color -->
                <div class="html-preview__tb-color-wrap" title="Font Color">
                  <input
                    v-model="styleConfig.fontColor"
                    type="color"
                    class="html-preview__tb-color"
                    @input="applyLiveStyle"
                  />
                </div>

                <!-- Background Color -->
                <div class="html-preview__tb-color-wrap" title="Background Color">
                  <input
                    v-model="styleConfig.bgColor"
                    type="color"
                    class="html-preview__tb-color"
                    @input="applyLiveStyle"
                  />
                  <button
                    class="html-preview__tb-clear-bg"
                    v-if="styleConfig.bgColor !== '#ffffff'"
                    @click="styleConfig.bgColor = '#ffffff'; applyLiveStyle()"
                    title="Remove background"
                  >×</button>
                </div>

                <div class="html-preview__tb-divider"></div>

                <!-- Bold -->
                <button
                  class="html-preview__tb-btn"
                  :class="{ 'html-preview__tb-btn--active': styleConfig.fontWeight === 'bold' }"
                  @click="toggleBold"
                  title="Bold"
                >
                  <span class="material-symbols-outlined">format_bold</span>
                </button>

                <!-- Italic -->
                <button
                  class="html-preview__tb-btn"
                  :class="{ 'html-preview__tb-btn--active': styleConfig.fontStyle === 'italic' }"
                  @click="toggleItalic"
                  title="Italic"
                >
                  <span class="material-symbols-outlined">format_italic</span>
                </button>

                <!-- Underline -->
                <button
                  class="html-preview__tb-btn"
                  :class="{ 'html-preview__tb-btn--active': styleConfig.textDecoration === 'underline' }"
                  @click="toggleUnderline"
                  title="Underline"
                >
                  <span class="material-symbols-outlined">format_underlined</span>
                </button>

                <div class="html-preview__tb-divider"></div>

                <!-- Alignment -->
                <button
                  class="html-preview__tb-btn"
                  :class="{ 'html-preview__tb-btn--active': styleConfig.textAlign === 'left' }"
                  @click="setAlign('left')"
                  title="Align Left"
                >
                  <span class="material-symbols-outlined">format_align_left</span>
                </button>
                <button
                  class="html-preview__tb-btn"
                  :class="{ 'html-preview__tb-btn--active': styleConfig.textAlign === 'center' }"
                  @click="setAlign('center')"
                  title="Align Center"
                >
                  <span class="material-symbols-outlined">format_align_center</span>
                </button>
                <button
                  class="html-preview__tb-btn"
                  :class="{ 'html-preview__tb-btn--active': styleConfig.textAlign === 'right' }"
                  @click="setAlign('right')"
                  title="Align Right"
                >
                  <span class="material-symbols-outlined">format_align_right</span>
                </button>
                <button
                  class="html-preview__tb-btn"
                  :class="{ 'html-preview__tb-btn--active': styleConfig.textAlign === 'justify' }"
                  @click="setAlign('justify')"
                  title="Justify"
                >
                  <span class="material-symbols-outlined">format_align_justify</span>
                </button>

                <div class="html-preview__tb-divider"></div>

                <!-- Done -->
                <button class="html-preview__tb-btn html-preview__tb-btn--save" @click="doneEdit" title="Done">
                  <span class="material-symbols-outlined">check</span>
                </button>
                <!-- Revert -->
                <button class="html-preview__tb-btn html-preview__tb-btn--cancel" @click="revertCurrent" title="Revert">
                  <span class="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { useHtmlFixer } from '../composables/useHtmlFixer'
import { useVariableDetector } from '../composables/useVariableDetector'
import { useTemplatePreview } from '../composables/useTemplatePreview'
import { useToast } from '@lib/composables/useToast'
import CodeEditor from './CodeEditor.vue'
import VariableForm from './VariableForm.vue'

const toast = useToast()
const { fix } = useHtmlFixer()
const { detect } = useVariableDetector()
const { inject } = useTemplatePreview()

const inputHtml = ref('')
const variables = ref([])
const fixesApplied = ref([])

// ── WYSIWYG state ──
const wysiwygMode = ref(false)
const iframeRef = ref(null)
const previewContainerRef = ref(null)
const selectedElement = ref(null)
const selectedOriginalHTML = ref('')
const toolbarPosition = ref({ top: '0px', left: '0px' })
const skipIframeRender = ref(false)

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

let lastFixedSource = null
let iframeClickHandler = null
let syncDebounceTimer = null

// ── Computed ──

const wysiwygEnabled = computed(() => !!inputHtml.value && inputHtml.value.trim().length > 0)

// Preview HTML for iframe srcdoc — uses wrapVars when WYSIWYG mode is on
const previewHtml = computed(() => {
  if (!inputHtml.value) return ''
  const varMap = {}
  for (const v of variables.value) {
    varMap[v.name] = v.value
  }
  return inject(inputHtml.value, varMap, { wrapVars: wysiwygMode.value })
})

// The actual srcdoc — skip update when syncing from WYSIWYG back to code
const previewSrcdoc = ref('')
watch(previewHtml, (val) => {
  if (skipIframeRender.value) {
    skipIframeRender.value = false
    return
  }
  previewSrcdoc.value = val
}, { immediate: true })

// ── Watchers ──

watch(inputHtml, (val) => {
  if (val && val.trim()) {
    if (lastFixedSource !== val) {
      const { html, fixes } = fix(val)
      lastFixedSource = html
      if (fixes.length > 0) {
        fixesApplied.value = fixes
        inputHtml.value = html
        return
      }
    }
    variables.value = detect(val)
  } else {
    variables.value = []
    fixesApplied.value = []
    lastFixedSource = null
  }
})

// ── Variable / File handling ──

function handleVariableUpdate(updated) {
  variables.value = updated
}

function handleFileUpload(e) {
  const file = e.target.files[0]
  e.target.value = ''
  if (!file) return
  lastFixedSource = null
  const reader = new FileReader()
  reader.onload = (ev) => {
    inputHtml.value = ev.target.result
  }
  reader.readAsText(file)
}

// Re-render iframe when toggling WYSIWYG on (so onIframeLoad fires with wrapVars)
watch(wysiwygMode, (on) => {
  if (on && previewHtml.value) {
    // Force iframe reload with variable-wrapped spans + editable markers
    nextTick(() => { previewSrcdoc.value = previewHtml.value })
  }
})

// ── WYSIWYG Toggle ──

function toggleWysiwyg() {
  wysiwygMode.value = !wysiwygMode.value
  if (!wysiwygMode.value) {
    deselectElement()
    selectedElement.value = null
  }
}

// ── WYSIWYG: Iframe Load ──

function onIframeLoad() {
  cleanupIframeListener()
  selectedElement.value = null

  if (!wysiwygMode.value) return

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
    const textTags = doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, td, th, li, span, a, label, caption, button')
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

      // Clicked outside editable → deselect current
      if (!el || !el.hasAttribute('data-sop-editable')) {
        if (selectedElement.value) deselectElement()
        return
      }

      e.preventDefault()
      e.stopPropagation()

      // Already editing this element
      if (el.hasAttribute('data-sop-editing')) return

      // Save and deselect previous element
      if (selectedElement.value && selectedElement.value !== el) {
        deselectElement()
      }

      // Store original HTML for revert
      if (!el.hasAttribute('data-sop-selected')) {
        selectedOriginalHTML.value = el.outerHTML
      }

      // Read computed styles
      const computed = doc.defaultView.getComputedStyle(el)
      styleConfig.fontFamily = computed.fontFamily || "'Times New Roman', serif"
      styleConfig.fontSize = Math.round((parseInt(computed.fontSize) || 16) * 0.75) || 12
      styleConfig.fontColor = rgbToHex(computed.color)
      styleConfig.bgColor = rgbToHex(computed.backgroundColor) || '#ffffff'
      styleConfig.fontWeight = computed.fontWeight || 'normal'
      styleConfig.fontStyle = computed.fontStyle || 'normal'
      styleConfig.textDecoration = computed.textDecoration || 'none'
      styleConfig.textAlign = computed.textAlign || 'left'

      selectedElement.value = el
      el.setAttribute('data-sop-selected', '')
      el.setAttribute('data-sop-editing', '')
      el.contentEditable = 'true'
      el.focus()

      // Listen for input to sync to code
      el.addEventListener('input', onElementInput)

      nextTick(() => positionToolbar(el))
    }

    doc.addEventListener('click', iframeClickHandler, true)
  } catch (_) {}
}

// ── WYSIWYG: Element input → sync to code ──

function onElementInput() {
  clearTimeout(syncDebounceTimer)
  syncDebounceTimer = setTimeout(syncPreviewToCode, 300)
}

function syncPreviewToCode() {
  const iframe = iframeRef.value
  if (!iframe) return

  try {
    const doc = iframe.contentDocument
    if (!doc || !doc.body) return

    // Temporarily deselect to clean up SOP attributes from output
    const activeEl = selectedElement.value
    if (activeEl) {
      activeEl.removeAttribute('data-sop-selected')
      activeEl.removeAttribute('data-sop-editing')
    }

    let bodyHtml = doc.body.innerHTML

    // Restore attributes on active element
    if (activeEl) {
      activeEl.setAttribute('data-sop-selected', '')
      activeEl.setAttribute('data-sop-editing', '')
    }

    // Reverse variable substitution: <span data-sop-var="X">Y</span> → ${X}
    bodyHtml = bodyHtml.replace(/<span\s+data-sop-var="([^"]*)">(.*?)<\/span>/gi, '${$1}')

    // Clean up SOP data attributes from output
    bodyHtml = bodyHtml.replace(/\s*data-sop-editable(?:="[^"]*")?/g, '')
    bodyHtml = bodyHtml.replace(/\s*data-sop-selected(?:="[^"]*")?/g, '')
    bodyHtml = bodyHtml.replace(/\s*data-sop-editing(?:="[^"]*")?/g, '')
    bodyHtml = bodyHtml.replace(/\s*data-sop-var="[^"]*"/g, '')

    // Skip the next iframe srcdoc update to avoid cursor jump
    skipIframeRender.value = true
    lastFixedSource = bodyHtml   // prevent fixer from re-processing synced content
    inputHtml.value = bodyHtml
  } catch (_) {}
}

// ── WYSIWYG: Toolbar ──

function deselectElement() {
  const el = selectedElement.value
  if (!el) return

  el.removeEventListener('input', onElementInput)
  el.removeAttribute('data-sop-selected')
  el.removeAttribute('data-sop-editing')
  el.contentEditable = 'false'
  el.style.outline = ''
  el.style.outlineOffset = ''
}

function doneEdit() {
  deselectElement()
  selectedElement.value = null
  toast.info('Edit applied to source code.')
}

function revertCurrent() {
  const el = selectedElement.value
  if (!el) return

  if (selectedOriginalHTML.value) {
    // Restore original: need to replace the element's content
    const temp = document.createElement('div')
    temp.innerHTML = selectedOriginalHTML.value
    const orig = temp.firstElementChild
    if (orig) {
      el.innerHTML = orig.innerHTML
      // Restore original inline styles
      el.removeAttribute('style')
      if (orig.hasAttribute('style')) {
        el.setAttribute('style', orig.getAttribute('style'))
      }
    }
  }

  deselectElement()
  selectedElement.value = null

  // Sync reverted state to code
  syncPreviewToCode()
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

function onFontSizeInput(e) {
  const val = parseInt(e.target.value)
  if (!isNaN(val) && val >= 1) {
    styleConfig.fontSize = val
    applyLiveStyle()
  }
}

function applyLiveStyle() {
  const el = selectedElement.value
  if (!el) return

  el.style.fontFamily = styleConfig.fontFamily
  el.style.fontSize = styleConfig.fontSize + 'pt'
  el.style.color = styleConfig.fontColor
  el.style.backgroundColor = styleConfig.bgColor
  el.style.fontWeight = styleConfig.fontWeight
  el.style.fontStyle = styleConfig.fontStyle
  el.style.textDecoration = styleConfig.textDecoration
  el.style.textAlign = styleConfig.textAlign

  // Sync style changes to code too
  clearTimeout(syncDebounceTimer)
  syncDebounceTimer = setTimeout(syncPreviewToCode, 300)
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

// ── Helpers ──

function rgbToHex(rgb) {
  if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return '#ffffff'
  if (rgb.startsWith('#')) return rgb
  const match = rgb.match(/\d+/g)
  if (!match || match.length < 3) return '#000000'
  return '#' + match.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('')
}

function cleanupIframeListener() {
  try {
    const iframe = iframeRef.value
    if (iframe && iframe.contentDocument) {
      iframe.contentDocument.removeEventListener('click', iframeClickHandler, true)
    }
  } catch (_) {}
  iframeClickHandler = null
}

onBeforeUnmount(() => {
  cleanupIframeListener()
  clearTimeout(syncDebounceTimer)
})
</script>

<style scoped>
.html-preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-md, 16px);
}

.html-preview__layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  min-height: 520px;
}

@media (max-width: 900px) {
  .html-preview__layout {
    grid-template-columns: 1fr;
  }
}

.html-preview__left,
.html-preview__right {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ── Section Header ── */
.html-preview__section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.html-preview__section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-on-surface, #1a1a2e);
}

.html-preview__section-title .material-symbols-outlined {
  font-size: 20px;
  color: var(--cta-primary-bg, #FFBC25);
}

.html-preview__header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.html-preview__upload-btn {
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

.html-preview__upload-btn .material-symbols-outlined {
  font-size: 16px;
}

.html-preview__upload-btn:hover {
  border-color: var(--cta-primary-bg, #FFBC25);
  color: var(--color-on-surface, #1a1a2e);
  background: rgba(255, 188, 37, 0.05);
}

.html-preview__file-hidden { display: none; }

/* ── Editor Wrap ── */
.html-preview__editor-wrap {
  max-height: 400px;
  overflow: hidden;
}

.html-preview__editor-wrap .code-editor {
  height: 100%;
}

.html-preview__editor-wrap .code-editor__wrapper {
  height: 100%;
  overflow: hidden;
}

.html-preview__editor-wrap .code-editor__textarea {
  height: 100%;
  overflow-y: auto;
}

/* ── Fix Badge ── */
.html-preview__fix-badge {
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

.html-preview__fix-badge .material-symbols-outlined {
  font-size: 18px;
  color: var(--cta-primary-bg, #FFBC25);
}

/* ── Live Badge ── */
.html-preview__live-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-success, #10B981);
  padding: 4px 10px;
  background: rgba(16, 185, 129, 0.08);
  border-radius: 20px;
}

.html-preview__live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-success, #10B981);
  animation: livePulse 1.5s infinite;
}

@keyframes livePulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

/* ── WYSIWYG Toggle ── */
.html-preview__wysiwyg-toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border: 1.5px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  background: transparent;
  color: #666;
  font-family: inherit;
  transition: all 0.25s ease;
}

.html-preview__wysiwyg-toggle .material-symbols-outlined {
  font-size: 16px;
}

.html-preview__wysiwyg-toggle:hover {
  border-color: var(--cta-primary-bg, #FFBC25);
  color: var(--color-on-surface, #1a1a2e);
}

.html-preview__wysiwyg-toggle--active {
  background: rgba(16, 185, 129, 0.08);
  border-color: rgba(16, 185, 129, 0.3);
  color: var(--color-success, #10B981);
}

/* ── Hint ── */
.html-preview__hint {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: rgba(26, 26, 46, 0.85);
  backdrop-filter: blur(8px);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  color: #fff;
  pointer-events: none;
  white-space: nowrap;
}

.html-preview__hint .material-symbols-outlined {
  font-size: 16px;
  color: var(--cta-primary-bg, #FFBC25);
}

/* ── Preview Frame ── */
.html-preview__preview-frame {
  flex: 1;
  position: relative;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  overflow: hidden;
  background: white;
  min-height: 420px;
}

.html-preview__iframe {
  width: 100%;
  height: 100%;
  min-height: 420px;
  border: none;
  display: block;
}

/* ── Empty State ── */
.html-preview__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 420px;
  gap: 12px;
}

.html-preview__empty-icon {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 18px;
}

.html-preview__empty-icon .material-symbols-outlined {
  font-size: 32px;
  color: #ccc;
}

.html-preview__empty-title {
  font-size: 16px;
  font-weight: 700;
  color: #999;
  margin: 0;
}

.html-preview__empty-sub {
  font-size: 13px;
  color: #bbb;
  margin: 0;
}

/* ── Floating Toolbar ── */
.html-preview__toolbar {
  position: absolute;
  z-index: 100;
  background: rgba(26, 26, 46, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 6px 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  max-width: 640px;
}

.html-preview__toolbar-row {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.html-preview__tb-select {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 12px;
  padding: 4px 6px;
  font-family: inherit;
  cursor: pointer;
  outline: none;
}

.html-preview__tb-select option {
  background: #1a1b26;
  color: #e0e0e0;
}

.html-preview__tb-size {
  display: flex;
  align-items: center;
  gap: 2px;
}

.html-preview__tb-input {
  width: 44px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 12px;
  padding: 4px 6px;
  text-align: center;
  font-family: inherit;
  outline: none;
}

.html-preview__tb-unit {
  font-size: 10px;
  color: #888;
}

.html-preview__tb-divider {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.12);
  margin: 0 4px;
}

.html-preview__tb-color-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.html-preview__tb-color {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  cursor: pointer;
  padding: 0;
  background: none;
}

.html-preview__tb-color::-webkit-color-swatch-wrapper { padding: 2px; }
.html-preview__tb-color::-webkit-color-swatch { border-radius: 3px; border: none; }

.html-preview__tb-clear-bg {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #C83E3B;
  color: #fff;
  border: none;
  font-size: 10px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.html-preview__tb-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #aaa;
  cursor: pointer;
  transition: all 0.15s ease;
  padding: 0;
}

.html-preview__tb-btn .material-symbols-outlined {
  font-size: 18px;
}

.html-preview__tb-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.html-preview__tb-btn--active {
  background: rgba(255, 188, 37, 0.2);
  color: var(--cta-primary-bg, #FFBC25);
}

.html-preview__tb-btn--save {
  background: rgba(16, 185, 129, 0.2);
  color: var(--color-success, #10B981);
}

.html-preview__tb-btn--save:hover {
  background: rgba(16, 185, 129, 0.35);
}

.html-preview__tb-btn--cancel {
  background: rgba(200, 62, 59, 0.15);
  color: #C83E3B;
}

.html-preview__tb-btn--cancel:hover {
  background: rgba(200, 62, 59, 0.3);
}

/* ── Transitions ── */
.badge-pop-enter-active {
  transition: all 0.4s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
}
.badge-pop-leave-active { transition: all 0.2s ease; }
.badge-pop-enter-from {
  opacity: 0;
  transform: scale(0.9) translateY(-4px);
}
.badge-pop-leave-to { opacity: 0; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.view-fade-enter-active {
  transition: all 0.3s var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1));
}
.view-fade-leave-active { transition: all 0.15s ease-in; }
.view-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.view-fade-leave-to { opacity: 0; }

.toolbar-pop-enter-active {
  transition: all 0.3s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
}
.toolbar-pop-leave-active { transition: all 0.15s ease; }
.toolbar-pop-enter-from {
  opacity: 0;
  transform: translateY(6px) scale(0.95);
}
.toolbar-pop-leave-to { opacity: 0; }
</style>
