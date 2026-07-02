<template>
  <div class="reader">
    <!-- Drop Zone -->
    <div
      class="reader__dropzone"
      :class="{ 'reader__dropzone--active': dragging }"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="handleDrop"
      @paste="handlePaste"
      tabindex="0"
    >
      <span class="material-symbols-outlined reader__dropzone-icon">qr_code_scanner</span>
      <p class="reader__dropzone-text">
        Drop QR image here, paste from clipboard (Ctrl+V), or
        <label class="reader__browse">
          browse files
          <input type="file" accept="image/*" @change="handleFile" hidden />
        </label>
      </p>
    </div>

    <!-- Or paste raw value -->
    <div class="reader__or">
      <span>or paste QR value directly</span>
    </div>
    <div class="reader__raw-input">
      <textarea
        v-model="rawValue"
        class="reader__textarea"
        placeholder="Paste EMVCo QRIS string here..."
        rows="3"
      ></textarea>
      <button class="reader__parse-btn" @click="handleParseRaw" :disabled="parsing || !rawValue.trim()">
        <span v-if="parsing" class="reader__spinner"></span>
        <span v-else>Parse</span>
      </button>
    </div>

    <!-- Error -->
    <div v-if="error" class="reader__error">
      <span class="material-symbols-outlined">error</span>
      {{ error }}
    </div>

    <!-- Decoded image preview -->
    <div v-if="decodedImage" class="reader__preview">
      <img :src="decodedImage" alt="QR" class="reader__preview-img" />
      <span class="reader__preview-label">Decoded from image</span>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import jsQR from 'jsqr'
import { useQris } from '../composables/useQris.js'

const emit = defineEmits(['parsed'])

const { parsing, error, parse } = useQris()

const dragging = ref(false)
const rawValue = ref('')
const decodedImage = ref(null)

function handleDrop(e) {
  dragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file && file.type.startsWith('image/')) {
    decodeImageFile(file)
  }
}

function handleFile(e) {
  const file = e.target.files?.[0]
  if (file) decodeImageFile(file)
}

function handlePaste(e) {
  const items = e.clipboardData?.items
  if (!items) return

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const file = item.getAsFile()
      if (file) decodeImageFile(file)
      return
    }
  }
}

async function handleParseRaw() {
  const data = await parse(rawValue.value.trim())
  if (data) emit('parsed', data)
}

function decodeImageFile(file) {
  const reader = new FileReader()
  reader.onload = (e) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height)

      if (code) {
        decodedImage.value = e.target.result
        rawValue.value = code.data
        // Auto-parse
        parse(code.data).then(data => {
          if (data) emit('parsed', data)
        })
      } else {
        error.value = 'Could not decode QR code from image'
      }
    }
    img.src = e.target.result
  }
  reader.readAsDataURL(file)
}
</script>

<style scoped>
.reader {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── Drop Zone ── */
.reader__dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px 24px;
  border: 2px dashed rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-lg, 24px);
  background: rgba(255, 255, 255, 0.3);
  cursor: pointer;
  transition: all 200ms var(--ease-out);
  outline: none;
}

.reader__dropzone:hover,
.reader__dropzone--active {
  border-color: var(--cta-primary-bg, #FFBC25);
  background: rgba(255, 188, 37, 0.04);
}

.reader__dropzone-icon {
  font-size: 40px;
  color: var(--color-gray-300, #CCC);
}

.reader__dropzone:hover .reader__dropzone-icon,
.reader__dropzone--active .reader__dropzone-icon {
  color: var(--cta-primary-bg, #FFBC25);
}

.reader__dropzone-text {
  font-size: 13px;
  color: var(--color-gray-500, #999);
  text-align: center;
  margin: 0;
  line-height: 1.6;
}

.reader__browse {
  color: var(--cta-primary-bg, #FFBC25);
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
}

/* ── Or Divider ── */
.reader__or {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  color: var(--color-gray-400, #B3B3B3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.reader__or::before,
.reader__or::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(0, 0, 0, 0.06);
}

/* ── Raw Input ── */
.reader__raw-input {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.reader__textarea {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: var(--radius-xs, 8px);
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-gray-900, #333);
  background: rgba(255, 255, 255, 0.6);
  resize: vertical;
  outline: none;
  transition: border-color 200ms;
}

.reader__textarea:focus {
  border-color: var(--color-yellow-400, #F9C700);
}

.reader__parse-btn {
  padding: 10px 20px;
  background: var(--cta-primary-bg, #FFBC25);
  color: var(--cta-primary-text, #1E1E1E);
  border: none;
  border-radius: var(--radius-pill, 999px);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 200ms;
  font-family: var(--font-body, 'Inter', sans-serif);
  white-space: nowrap;
}

.reader__parse-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.reader__parse-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.reader__spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(0, 0, 0, 0.2);
  border-bottom-color: transparent;
  border-radius: 50%;
  animation: reader-spin 600ms linear infinite;
}

@keyframes reader-spin {
  to { transform: rotate(360deg); }
}

/* ── Error ── */
.reader__error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--color-error-container, #FDECEE);
  color: var(--color-on-error-container, #A33129);
  border-radius: var(--radius-xs, 8px);
  font-size: 13px;
  font-weight: 500;
}

.reader__error .material-symbols-outlined {
  font-size: 18px;
  flex-shrink: 0;
}

/* ── Preview ── */
.reader__preview {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-md, 16px);
}

.reader__preview-img {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-xs, 8px);
  object-fit: contain;
}

.reader__preview-label {
  font-size: 12px;
  color: var(--color-gray-500, #999);
}
</style>
