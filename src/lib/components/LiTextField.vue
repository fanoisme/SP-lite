<template>
  <div class="li-textfield-wrapper" :class="{ 'li-textfield-error': error, 'li-textfield-disabled': disabled }">
    <label v-if="label" class="li-textfield-label">{{ label }}</label>

    <div class="li-textfield-input-group" :class="{ 'is-focused': isFocused }">
      <span v-if="prefix || $slots.prefix" class="li-textfield-prefix">
        <slot name="prefix">{{ prefix }}</slot>
      </span>

      <textarea
        v-if="type === 'area'"
        ref="inputRef"
        class="li-textfield-input li-textfield-textarea"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :rows="rows"
        :aria-invalid="error ? 'true' : undefined"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
      ></textarea>
      <input
        v-else
        ref="inputRef"
        class="li-textfield-input"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :aria-invalid="error ? 'true' : undefined"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
      />

      <span v-if="suffix || $slots.suffix" class="li-textfield-suffix">
        <slot name="suffix">{{ suffix }}</slot>
      </span>
    </div>

    <div v-if="error || helperText" class="li-textfield-helper" :class="{ 'li-textfield-helper--error': error }">
      {{ error || helperText }}
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  modelValue: [String, Number],
  label: String,
  placeholder: String,
  type: {
    type: String,
    default: 'text'
  },
  prefix: String,
  suffix: String,
  error: String,
  helperText: String,
  disabled: Boolean,
  rows: {
    type: Number,
    default: 3
  }
});

const emit = defineEmits(['update:modelValue', 'focus', 'blur']);

const isFocused = ref(false);
const inputRef = ref(null);

const onInput = (e) => {
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
/* Allo field + input (app.css .field / .input). Compact: 32px, radius 8. */
.li-textfield-wrapper {
  display: grid;
  gap: 6px;
  width: 100%;
}

.li-textfield-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text);
}

.li-textfield-input-group {
  display: flex;
  align-items: center;
  height: 32px;
  background: var(--color-bg);
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-sm);
  transition: border-color var(--dur-quick), box-shadow var(--dur-short) var(--ease-out);
}

.li-textfield-input-group.is-focused {
  border-color: var(--color-focus);
  box-shadow: 0 0 0 4px var(--glow-focus);
}

.li-textfield-error .li-textfield-input-group {
  border-color: var(--color-danger);
}

.li-textfield-error .li-textfield-input-group.is-focused {
  box-shadow: 0 0 0 4px var(--glow-danger);
}

.li-textfield-disabled .li-textfield-input-group {
  background: var(--color-surface-2);
  border-color: var(--color-border);
}

.li-textfield-input {
  flex: 1;
  border: none;
  background: transparent;
  padding: 0 12px;
  font: inherit;
  font-size: var(--text-sm);
  color: var(--color-text-strong);
  outline: none;
  width: 100%;
  min-width: 0;
}

.li-textfield-textarea {
  height: auto;
  min-height: 88px;
  padding: 8px 12px;
  resize: vertical;
}

.li-textfield-input::placeholder {
  color: var(--color-text-placeholder);
}

.li-textfield-disabled .li-textfield-input {
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.li-textfield-prefix,
.li-textfield-suffix {
  padding: 0 12px;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-sm);
}

.li-textfield-prefix { padding-right: 0; }
.li-textfield-suffix { padding-left: 0; }

.li-textfield-helper {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  min-height: 16px;
}

.li-textfield-helper--error {
  color: var(--color-danger);
}
</style>
