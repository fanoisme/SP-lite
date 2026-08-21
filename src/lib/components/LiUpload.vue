<template>
  <div class="li-upload" :class="{ 'is-dragging': isDragging, 'is-disabled': disabled }">
    <label v-if="label" class="li-upload-label">{{ label }}</label>
    
    <div 
      class="li-upload-dropzone"
      @dragover.prevent="onDragOver"
      @dragleave.prevent="onDragLeave"
      @drop.prevent="onDrop"
      @click="triggerFileInput"
    >
      <input 
        type="file" 
        ref="fileInput" 
        class="sr-only" 
        :multiple="multiple" 
        :accept="accept"
        :disabled="disabled"
        @change="onFileChange" 
      />
      
      <div class="li-upload-icon">
        <LiIcon name="cloud_upload" size="lg" />
      </div>
      <div class="li-upload-text">
        <span class="li-upload-highlight">Click to upload</span> or drag and drop
      </div>
      <div v-if="hint" class="li-upload-hint">{{ hint }}</div>
    </div>
    
    <div v-if="files.length > 0" class="li-upload-file-list">
      <div v-for="(file, index) in files" :key="index" class="li-upload-file-item">
        <LiIcon name="description" size="md" class="li-file-icon" />
        <span class="li-file-name">{{ file.name }}</span>
        <button class="li-file-remove" :aria-label="`Remove ${file.name}`" @click.stop="removeFile(index)">
          <LiIcon name="close" size="sm" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  },
  label: String,
  hint: String,
  accept: String,
  multiple: Boolean,
  disabled: Boolean
});

const emit = defineEmits(['update:modelValue', 'change']);

const fileInput = ref(null);
const isDragging = ref(false);
const files = ref([...props.modelValue]);

const triggerFileInput = () => {
  if (!props.disabled) {
    fileInput.value.click();
  }
};

const handleFiles = (newFiles) => {
  const fileArray = Array.from(newFiles);
  if (props.multiple) {
    files.value = [...files.value, ...fileArray];
  } else {
    files.value = fileArray.slice(0, 1);
  }
  emit('update:modelValue', files.value);
  emit('change', files.value);
};

const onFileChange = (e) => {
  if (e.target.files.length > 0) {
    handleFiles(e.target.files);
  }
};

const onDragOver = () => {
  if (!props.disabled) isDragging.value = true;
};

const onDragLeave = () => {
  isDragging.value = false;
};

const onDrop = (e) => {
  isDragging.value = false;
  if (!props.disabled && e.dataTransfer.files.length > 0) {
    handleFiles(e.dataTransfer.files);
  }
};

const removeFile = (index) => {
  files.value.splice(index, 1);
  emit('update:modelValue', files.value);
  emit('change', files.value);
};
</script>

<style scoped>
.li-upload {
  display: flex;
  flex-direction: column;
  gap: var(--space-s, 8px);
  width: 100%;
  font-family: var(--font-family, 'Inter', sans-serif);
}

.li-upload-label {
  font-size: var(--text-xs, 14px);
  font-weight: 500;
  color: var(--color-gray-800, #4D4D4D);
}

.li-upload-dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-2xl, 32px);
  border: 1.5px dashed var(--color-gray-300, #CCCCCC);
  border-radius: var(--radius-md, 8px);
  background-color: var(--color-gray-0, #FFFFFF);
  cursor: pointer;
  transition: all var(--dur-short, 200ms) var(--ease-out);
  gap: var(--space-s, 8px);
}

.li-upload-dropzone:hover:not(.is-disabled) {
  border-color: var(--color-orange-400, #FF6B00);
  background-color: var(--color-yellow-100, #FFF3D6); /* Using lightest yellow/orange for hover bg */
}

.li-upload.is-dragging .li-upload-dropzone {
  border-color: var(--color-orange-400, #FF6B00);
  background-color: var(--color-yellow-100, #FFF3D6);
}

.li-upload.is-disabled .li-upload-dropzone {
  background-color: var(--color-gray-100, #F2F2F2);
  cursor: not-allowed;
  opacity: 0.7;
}

.li-upload-icon {
  color: var(--color-gray-500, #999999);
}

.li-upload.is-dragging .li-upload-icon,
.li-upload-dropzone:hover:not(.is-disabled) .li-upload-icon {
  color: var(--color-orange-400, #FF6B00);
}

.li-upload-text {
  font-size: var(--text-sm, 16px);
  color: var(--color-gray-700, #666666);
  text-align: center;
}

.li-upload-highlight {
  font-weight: 600;
  color: var(--color-orange-400, #FF6B00);
}

.li-upload-hint {
  font-size: var(--text-xs, 14px);
  color: var(--color-gray-500, #999999);
  text-align: center;
}

.li-upload-file-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs, 4px);
  margin-top: var(--space-s, 8px);
}

.li-upload-file-item {
  display: flex;
  align-items: center;
  padding: var(--space-s, 8px) var(--space-m, 12px);
  background-color: var(--color-gray-100, #F2F2F2);
  border-radius: var(--radius-sm, 4px);
  gap: var(--space-s, 8px);
}

.li-file-icon {
  color: var(--color-gray-500, #999999);
}

.li-file-name {
  flex: 1;
  font-size: var(--text-sm, 16px);
  color: var(--color-gray-900, #333333);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.li-file-remove {
  background: transparent;
  border: none;
  color: var(--color-gray-500, #999999);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-sm, 4px);
  display: flex;
  transition: all var(--dur-short, 200ms);
}

.li-file-remove:hover {
  background-color: var(--color-gray-200, #E6E6E6);
  color: var(--color-red-500, #A33129);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>
