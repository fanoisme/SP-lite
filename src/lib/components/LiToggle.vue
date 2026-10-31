<template>
  <label class="li-toggle-wrapper" :class="{ 'li-toggle-disabled': disabled }">
    <div class="li-toggle">
      <input 
        type="checkbox" 
        class="sr-only" 
        :checked="modelValue" 
        :disabled="disabled"
        @change="$emit('update:modelValue', $event.target.checked)"
        @focus="isFocused = true"
        @blur="isFocused = false"
      />
      <div 
        class="li-toggle-track" 
        :class="{ 'is-checked': modelValue, 'is-focused': isFocused }"
      >
        <div class="li-toggle-thumb" :class="{ 'is-checked': modelValue }"></div>
      </div>
    </div>
    <span v-if="label || $slots.default" class="li-toggle-label">
      <slot>{{ label }}</slot>
    </span>
  </label>
</template>

<script setup>
import { ref } from 'vue';

defineProps({
  modelValue: Boolean,
  label: String,
  disabled: Boolean
});

defineEmits(['update:modelValue']);

const isFocused = ref(false);
</script>

<style scoped>
/* Allo switch (app.css .switch): 36×20 track, success fill, spring thumb. */
.li-toggle-wrapper {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  user-select: none;
}

.li-toggle-disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.li-toggle {
  position: relative;
  width: 36px;
  height: 20px;
}

.li-toggle-track {
  position: absolute;
  inset: 0;
  background: var(--color-border-input);
  border-radius: var(--radius-pill);
  transition: background var(--dur-short);
}

.li-toggle-track.is-checked {
  background: var(--color-success);
}

.li-toggle-track.is-focused {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.li-toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: var(--color-bg);
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  transition: transform var(--dur-medium) var(--ease-spring), width var(--dur-short) var(--ease-out);
}

.li-toggle-thumb.is-checked {
  transform: translateX(16px);
}

.li-toggle-wrapper:active .li-toggle-thumb {
  width: 20px;
}

.li-toggle-wrapper:active .li-toggle-thumb.is-checked {
  transform: translateX(12px);
}

.li-toggle-label {
  font-size: var(--text-sm);
  color: var(--color-text);
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
