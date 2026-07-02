<template>
  <div class="output-actions">
    <button
      class="output-actions__btn output-actions__btn--copy"
      @click="handleCopy"
      :disabled="!content"
    >
      <span class="material-symbols-outlined">{{ copied ? 'check' : 'content_copy' }}</span>
      {{ copied ? 'Copied!' : 'Copy' }}
    </button>
    <button
      class="output-actions__btn output-actions__btn--download"
      @click="handleDownload"
      :disabled="!content"
    >
      <span class="material-symbols-outlined">download</span>
      Download {{ fileExtension }}
    </button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { saveAs } from 'file-saver'
import { useToast } from '@lib/composables/useToast'

const props = defineProps({
  content: { type: String, default: '' },
  filename: { type: String, default: 'output' },
  mimeType: { type: String, default: 'text/html' },
})

const toast = useToast()
const copied = ref(false)

const fileExtension = computed(() => {
  const ext = props.filename.split('.').pop()
  return ext ? `.${ext}` : ''
})

async function handleCopy() {
  if (!props.content) return
  try {
    await navigator.clipboard.writeText(props.content)
    copied.value = true
    toast.success('Copied to clipboard!')
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    toast.error('Failed to copy')
  }
}

function handleDownload() {
  if (!props.content) return
  const blob = new Blob([props.content], { type: props.mimeType })
  saveAs(blob, props.filename)
  toast.success(`Downloaded ${props.filename}`)
}
</script>

<style scoped>
.output-actions {
  display: flex;
  gap: 10px;
  padding-top: 4px;
}

.output-actions__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border: none;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s var(--ease-smooth, cubic-bezier(0.4, 0, 0.2, 1));
  font-family: inherit;
}

.output-actions__btn .material-symbols-outlined {
  font-size: 18px;
}

.output-actions__btn--copy {
  background: rgba(0, 0, 0, 0.04);
  color: #555;
  border: 1.5px solid rgba(0, 0, 0, 0.06);
}

.output-actions__btn--copy:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
  border-color: rgba(0, 0, 0, 0.1);
}

.output-actions__btn--download {
  background: linear-gradient(135deg, var(--cta-primary-bg, #FFBC25), #FF9500);
  color: #fff;
  box-shadow: 0 2px 8px rgba(255, 188, 37, 0.25);
}

.output-actions__btn--download:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(255, 188, 37, 0.35);
}

.output-actions__btn--download:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
}

.output-actions__btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
</style>
