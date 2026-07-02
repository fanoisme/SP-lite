<template>
  <div class="style-editor">
    <!-- Font Family -->
    <div class="style-editor__field">
      <label class="style-editor__label">
        <span class="material-symbols-outlined">font_download</span>
        Font Family
      </label>
      <select v-model="localStyles.fontFamily" class="style-editor__select">
        <option v-for="font in fontFamilies" :key="font.value" :value="font.value">
          {{ font.label }}
        </option>
      </select>
    </div>

    <!-- Font Size -->
    <div class="style-editor__field">
      <label class="style-editor__label">
        <span class="material-symbols-outlined">format_size</span>
        Font Size
      </label>
      <div class="style-editor__size-row">
        <input
          v-model.number="localStyles.fontSize"
          type="number"
          min="6"
          max="72"
          class="style-editor__input"
        />
        <span class="style-editor__unit">px</span>
      </div>
    </div>

    <!-- Font Color -->
    <div class="style-editor__field">
      <label class="style-editor__label">
        <span class="material-symbols-outlined">palette</span>
        Font Color
      </label>
      <div class="style-editor__color-row">
        <input
          v-model="localStyles.fontColor"
          type="color"
          class="style-editor__color-picker"
        />
        <input
          v-model="localStyles.fontColor"
          type="text"
          class="style-editor__input style-editor__color-text"
          maxlength="7"
        />
      </div>
    </div>

    <!-- Style: Bold & Italic -->
    <div class="style-editor__field">
      <label class="style-editor__label">
        <span class="material-symbols-outlined">format_bold</span>
        Style
      </label>
      <div class="style-editor__toggle-group">
        <button
          class="style-editor__toggle"
          :class="{ 'style-editor__toggle--active': localStyles.fontWeight === 'bold' }"
          @click="localStyles.fontWeight = localStyles.fontWeight === 'bold' ? 'normal' : 'bold'"
        >
          <span class="material-symbols-outlined">format_bold</span>
        </button>
        <button
          class="style-editor__toggle"
          :class="{ 'style-editor__toggle--active': localStyles.fontStyle === 'italic' }"
          @click="localStyles.fontStyle = localStyles.fontStyle === 'italic' ? 'normal' : 'italic'"
        >
          <span class="material-symbols-outlined">format_italic</span>
        </button>
      </div>
    </div>

    <!-- Text Align -->
    <div class="style-editor__field">
      <label class="style-editor__label">
        <span class="material-symbols-outlined">format_align_left</span>
        Alignment
      </label>
      <div class="style-editor__toggle-group">
        <button
          v-for="align in alignments"
          :key="align.value"
          class="style-editor__toggle"
          :class="{ 'style-editor__toggle--active': localStyles.textAlign === align.value }"
          @click="localStyles.textAlign = align.value"
        >
          <span class="material-symbols-outlined">{{ align.icon }}</span>
        </button>
      </div>
    </div>

    <!-- Preview -->
    <div class="style-editor__preview">
      <p class="style-editor__preview-label">Preview</p>
      <div class="style-editor__preview-box" :style="previewStyle">
        The quick brown fox jumps over the lazy dog.
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, computed, watch } from 'vue'

const props = defineProps({
  styles: { type: Object, required: true },
})

const emit = defineEmits(['update:styles'])

const fontFamilies = [
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Times New Roman', value: "'Times New Roman', serif" },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Tahoma', value: 'Tahoma, sans-serif' },
  { label: 'Courier New', value: "'Courier New', monospace" },
  { label: 'Trebuchet MS', value: "'Trebuchet MS', sans-serif" },
]

const alignments = [
  { label: 'Left', value: 'left', icon: 'format_align_left' },
  { label: 'Center', value: 'center', icon: 'format_align_center' },
  { label: 'Right', value: 'right', icon: 'format_align_right' },
  { label: 'Justify', value: 'justify', icon: 'format_align_justify' },
]

const localStyles = reactive({ ...props.styles })

// Sync when parent updates styles (e.g., on modal reopen)
watch(() => props.styles, (val) => {
  Object.assign(localStyles, val)
}, { deep: true })

watch(localStyles, (val) => {
  emit('update:styles', { ...val })
}, { deep: true })

const previewStyle = computed(() => ({
  fontFamily: localStyles.fontFamily,
  fontSize: localStyles.fontSize + 'px',
  color: localStyles.fontColor,
  fontWeight: localStyles.fontWeight,
  fontStyle: localStyles.fontStyle,
  textAlign: localStyles.textAlign,
}))
</script>

<style scoped>
.style-editor {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.style-editor__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.style-editor__label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.style-editor__label .material-symbols-outlined {
  font-size: 16px;
  color: var(--cta-primary-bg, #FFBC25);
}

.style-editor__select {
  width: 100%;
  padding: 10px 12px;
  border: 1.5px solid rgba(0, 0, 0, 0.1);
  border-radius: 10px;
  font-size: 13px;
  font-family: inherit;
  color: var(--color-on-surface, #1a1a2e);
  background: white;
  cursor: pointer;
  transition: border-color 0.2s ease;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
}

.style-editor__select:focus {
  outline: none;
  border-color: var(--cta-primary-bg, #FFBC25);
}

.style-editor__input {
  width: 100%;
  padding: 10px 12px;
  border: 1.5px solid rgba(0, 0, 0, 0.1);
  border-radius: 10px;
  font-size: 13px;
  font-family: inherit;
  color: var(--color-on-surface, #1a1a2e);
  transition: border-color 0.2s ease;
}

.style-editor__input:focus {
  outline: none;
  border-color: var(--cta-primary-bg, #FFBC25);
}

.style-editor__size-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.style-editor__size-row .style-editor__input {
  width: 80px;
}

.style-editor__unit {
  font-size: 13px;
  color: #8e8ea0;
  font-weight: 500;
}

.style-editor__color-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.style-editor__color-picker {
  width: 40px;
  height: 40px;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-radius: 10px;
  cursor: pointer;
  padding: 2px;
  background: white;
}

.style-editor__color-picker::-webkit-color-swatch-wrapper {
  padding: 0;
}

.style-editor__color-picker::-webkit-color-swatch {
  border: none;
  border-radius: 7px;
}

.style-editor__color-text {
  width: 100px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 13px;
}

.style-editor__toggle-group {
  display: flex;
  gap: 4px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 10px;
  padding: 3px;
  width: fit-content;
}

.style-editor__toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 34px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #8e8ea0;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s ease;
}

.style-editor__toggle .material-symbols-outlined {
  font-size: 18px;
}

.style-editor__toggle:hover {
  color: #555;
}

.style-editor__toggle--active {
  background: white;
  color: var(--color-on-surface, #1a1a2e);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}

.style-editor__preview {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.style-editor__preview-label {
  font-size: 11px;
  font-weight: 600;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0;
}

.style-editor__preview-box {
  padding: 16px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 10px;
  background: white;
  line-height: 1.5;
  min-height: 48px;
}
</style>
