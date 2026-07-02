<template>
  <div class="code-editor" :class="{ 'code-editor--readonly': readonly }">
    <div class="code-editor__header" v-if="label || showLineNumbers">
      <span v-if="label" class="code-editor__label">{{ label }}</span>
      <span class="code-editor__line-count">{{ lineCount }} lines</span>
    </div>
    <div class="code-editor__wrapper">
      <div class="code-editor__gutter" v-if="showLineNumbers" ref="gutterRef">
        <div
          v-for="n in lineCount"
          :key="n"
          class="code-editor__line-num"
        >{{ n }}</div>
      </div>
      <textarea
        ref="textareaRef"
        class="code-editor__textarea"
        :value="modelValue"
        :placeholder="placeholder"
        :readonly="readonly"
        :rows="rows"
        spellcheck="false"
        @input="onInput"
        @scroll="syncScroll"
        @keydown="handleTab"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, default: '' },
  placeholder: { type: String, default: 'Paste or type code here...' },
  readonly: { type: Boolean, default: false },
  rows: { type: Number, default: 16 },
  showLineNumbers: { type: Boolean, default: true },
})

const emit = defineEmits(['update:modelValue'])

const textareaRef = ref(null)
const gutterRef = ref(null)

const lineCount = computed(() => {
  if (!props.modelValue) return 1
  return props.modelValue.split('\n').length
})

function onInput(e) {
  emit('update:modelValue', e.target.value)
}

function syncScroll() {
  if (gutterRef.value && textareaRef.value) {
    gutterRef.value.scrollTop = textareaRef.value.scrollTop
  }
}

function handleTab(e) {
  if (e.key === 'Tab' && !props.readonly) {
    e.preventDefault()
    const textarea = textareaRef.value
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const value = textarea.value
    const newValue = value.substring(0, start) + '  ' + value.substring(end)
    emit('update:modelValue', newValue)
    nextTick(() => {
      textarea.selectionStart = textarea.selectionEnd = start + 2
    })
  }
}
</script>

<style scoped>
.code-editor {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.code-editor__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.code-editor__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-on-surface, #1a1a2e);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.code-editor__line-count {
  font-size: 11px;
  color: #aaa;
  font-weight: 500;
}

.code-editor__wrapper {
  display: flex;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  overflow: hidden;
  background: #1a1b26;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}

.code-editor:not(.code-editor--readonly) .code-editor__wrapper:focus-within {
  border-color: var(--cta-primary-bg, #FFBC25);
  box-shadow: 0 0 0 3px rgba(255, 188, 37, 0.1);
}

.code-editor__gutter {
  display: flex;
  flex-direction: column;
  padding: 14px 0;
  background: rgba(0, 0, 0, 0.15);
  user-select: none;
  overflow: hidden;
  min-width: 48px;
  flex-shrink: 0;
}

.code-editor__line-num {
  padding: 0 12px;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
  font-size: 12px;
  line-height: 21px;
  color: #565f89;
  text-align: right;
}

.code-editor__textarea {
  flex: 1;
  padding: 14px 16px;
  border: none;
  outline: none;
  resize: vertical;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
  font-size: 13px;
  line-height: 21px;
  color: #c0caf5;
  background: transparent;
  tab-size: 2;
  overflow-y: auto;
  overflow-x: hidden;
  white-space: pre-wrap;
  word-wrap: break-word;
  word-break: break-all;
  overflow-wrap: break-word;
}

.code-editor__textarea::placeholder {
  color: #444b6a;
}

.code-editor--readonly .code-editor__textarea {
  cursor: default;
}
</style>
