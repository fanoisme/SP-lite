<template>
  <div class="style-editor" :style="{ '--select-arrow': `url(${expandMoreIcon})` }">
    <!-- Font Family -->
    <div class="style-editor__field">
      <label class="style-editor__label">
        <LiIcon name="type" />
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
        <LiIcon name="a-large-small" />
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
        <LiIcon name="palette" />
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
        <LiIcon name="bold" />
        Style
      </label>
      <div class="style-editor__toggle-group">
        <button
          class="style-editor__toggle"
          :class="{ 'style-editor__toggle--active': localStyles.fontWeight === 'bold' }"
          :aria-pressed="localStyles.fontWeight === 'bold'"
          aria-label="Bold"
          @click="localStyles.fontWeight = localStyles.fontWeight === 'bold' ? 'normal' : 'bold'"
        >
          <LiIcon name="bold" />
        </button>
        <button
          class="style-editor__toggle"
          :class="{ 'style-editor__toggle--active': localStyles.fontStyle === 'italic' }"
          :aria-pressed="localStyles.fontStyle === 'italic'"
          aria-label="Italic"
          @click="localStyles.fontStyle = localStyles.fontStyle === 'italic' ? 'normal' : 'italic'"
        >
          <LiIcon name="italic" />
        </button>
      </div>
    </div>

    <!-- Text Align -->
    <div class="style-editor__field">
      <label class="style-editor__label">
        <LiIcon name="align-left" />
        Alignment
      </label>
      <div class="style-editor__toggle-group">
        <button
          v-for="align in alignments"
          :key="align.value"
          class="style-editor__toggle"
          :class="{ 'style-editor__toggle--active': localStyles.textAlign === align.value }"
          :aria-label="`Align ${align.label.toLowerCase()}`"
          :aria-pressed="localStyles.textAlign === align.value"
          @click="localStyles.textAlign = align.value"
        >
          <LiIcon :name="align.icon" />
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
import { iconUrl } from '@/lib/icons.js'

const expandMoreIcon = iconUrl('expand_more')

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
  { label: 'Left', value: 'left', icon: 'align-left' },
  { label: 'Center', value: 'center', icon: 'align-center' },
  { label: 'Right', value: 'right', icon: 'align-right' },
  { label: 'Justify', value: 'justify', icon: 'align-justify' },
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
  color: var(--color-text);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.style-editor__label .li-icon {
  font-size: 16px;
  color: var(--color-accent);
}

.style-editor__select {
  width: 100%;
  padding: 10px 12px;
  border: 1.5px solid var(--color-border-strong);
  border-radius: 10px;
  font-size: 13px;
  font-family: inherit;
  color: var(--color-text);
  background: white;
  cursor: pointer;
  transition: border-color 0.2s ease;
  appearance: none;
  background-image: var(--select-arrow);
  background-repeat: no-repeat;
  background-position: right 12px center;
}

.style-editor__select:focus {
  outline: none;
  border-color: var(--color-accent);
}

.style-editor__input {
  width: 100%;
  padding: 10px 12px;
  border: 1.5px solid var(--color-border-strong);
  border-radius: 10px;
  font-size: 13px;
  font-family: inherit;
  color: var(--color-text);
  transition: border-color 0.2s ease;
}

.style-editor__input:focus {
  outline: none;
  border-color: var(--color-accent);
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
  color: var(--color-text-muted);
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
  border: 2px solid var(--color-border-strong);
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
  background: var(--color-border);
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
  color: var(--color-text-muted);
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s ease;
}

.style-editor__toggle .li-icon {
  font-size: 18px;
}

.style-editor__toggle:hover {
  color: var(--color-text);
}

.style-editor__toggle--active {
  background: white;
  color: var(--color-text);
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
  color: var(--color-text-muted);
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
