<template>
  <div class="li-select-wrapper" :class="{ 'li-select-error': error, 'li-select-disabled': disabled }">
    <label v-if="label" class="li-select-label">{{ label }}</label>
    
    <div class="li-select-input-group" :class="{ 'is-focused': isFocused }">
      <span v-if="iconLeft || $slots.iconLeft" class="li-select-icon li-select-icon-left">
        <slot name="iconLeft">{{ iconLeft }}</slot>
      </span>
      
      <select 
        class="li-select-input"
        :value="modelValue"
        :disabled="disabled"
        @change="onChange"
        @focus="onFocus"
        @blur="onBlur"
      >
        <option v-if="placeholder" value="" disabled selected hidden>{{ placeholder }}</option>
        <option v-for="option in options" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
      
      <span class="li-select-icon li-select-icon-right">
        <LiIcon name="chevron-down" size="sm" />
      </span>
    </div>

    <div v-if="helperText || error" class="li-select-helper">
      {{ error || helperText }}
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  modelValue: [String, Number],
  options: {
    type: Array,
    default: () => [],
    // Each option: { label: String, value: Any }
  },
  label: String,
  placeholder: String,
  iconLeft: String,
  error: String,
  helperText: String,
  disabled: Boolean
});

const emit = defineEmits(['update:modelValue', 'focus', 'blur']);

const isFocused = ref(false);

const onChange = (e) => {
  emit('update:modelValue', e.target.value);
};

const onFocus = (e) => {
  isFocused.value = true;
  emit('focus', e);
};

const onBlur = (e) => {
  isFocused.value = false;
  emit('blur', e);
};
</script>

<style scoped>
/* Allo input skin applied to select (app.css .input). Compact 32px, radius 8. */
.li-select-wrapper {
  display: grid;
  gap: 6px;
  width: 100%;
}

.li-select-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text);
}

.li-select-input-group {
  position: relative;
  display: flex;
  align-items: center;
  height: 32px;
  background: var(--color-bg);
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-sm);
  transition: border-color var(--dur-quick), box-shadow var(--dur-short) var(--ease-out);
}

.li-select-input-group.is-focused {
  border-color: var(--color-focus);
  box-shadow: 0 0 0 4px var(--glow-focus);
}

.li-select-error .li-select-input-group {
  border-color: var(--color-danger);
}

.li-select-error .li-select-input-group.is-focused {
  box-shadow: 0 0 0 4px var(--glow-danger);
}

.li-select-disabled .li-select-input-group {
  background: var(--color-surface-2);
  border-color: var(--color-border);
}

.li-select-input {
  flex: 1;
  border: none;
  background: transparent;
  padding: 0 32px 0 12px;
  font: inherit;
  font-size: var(--text-sm);
  color: var(--color-text-strong);
  outline: none;
  width: 100%;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  cursor: pointer;
}

.li-select-icon-left + .li-select-input {
  padding-left: 0;
}

.li-select-disabled .li-select-input {
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.li-select-icon {
  padding: 0 8px;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none; /* Let clicks pass through to select */
}

.li-select-icon-right {
  position: absolute;
  right: 0;
}

.li-select-helper {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  min-height: 16px;
}

.li-select-error .li-select-helper {
  color: var(--color-danger);
}
</style>
