<template>
  <label class="li-checkbox-wrapper" :class="{ 'li-checkbox-disabled': disabled }">
    <div class="li-checkbox-input-container">
      <input
        type="checkbox"
        class="sr-only"
        :checked="modelValue"
        :disabled="disabled"
        :indeterminate="indeterminate"
        @change="handleChange"
        @focus="isFocused = true"
        @blur="isFocused = false"
        ref="inputRef"
      />
      <div
        class="li-checkbox-box"
        :class="{
          'is-checked': modelValue || indeterminate,
          'is-focused': isFocused,
          'is-round': round
        }"
      >
        <LiIcon v-if="indeterminate" name="minus" size="xxs" />
        <LiIcon v-else-if="modelValue" name="check" size="xxs" />
      </div>
    </div>

    <div v-if="label || description || $slots.default" class="li-checkbox-content">
      <div class="li-checkbox-label">
        <slot>{{ label }}</slot>
      </div>
      <div v-if="description" class="li-checkbox-description">
        {{ description }}
      </div>
    </div>
  </label>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';

const props = defineProps({
  modelValue: Boolean,
  label: String,
  description: String,
  disabled: Boolean,
  indeterminate: Boolean,
  round: Boolean
});

const emit = defineEmits(['update:modelValue']);
const isFocused = ref(false);
const inputRef = ref(null);

watch(() => props.indeterminate, (newVal) => {
  if (inputRef.value) {
    inputRef.value.indeterminate = newVal;
  }
});

onMounted(() => {
  if (inputRef.value && props.indeterminate) {
    inputRef.value.indeterminate = true;
  }
});

const handleChange = (e) => {
  emit('update:modelValue', e.target.checked);
};
</script>

<style scoped>
/* Allo checkbox (app.css .check): 16px box fills text-strong, tick inherits bg colour. */
.li-checkbox-wrapper {
  display: inline-flex;
  align-items: flex-start;
  gap: var(--space-2);
  cursor: pointer;
  user-select: none;
}

.li-checkbox-disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.li-checkbox-input-container {
  position: relative;
  padding-top: 2px;
  display: inline-flex;
}

.li-checkbox-box {
  width: 16px;
  height: 16px;
  border: 1.5px solid var(--color-border-input);
  border-radius: var(--radius-xs);
  background: var(--color-bg);
  display: grid;
  place-items: center;
  color: var(--color-bg);
  transition: background var(--dur-quick), border-color var(--dur-quick), transform var(--dur-instant);
}

.li-checkbox-box.is-round {
  border-radius: var(--radius-pill);
}

.li-checkbox-wrapper:active .li-checkbox-box {
  transform: scale(0.88);
}

.li-checkbox-box.is-checked {
  background: var(--color-text-strong);
  border-color: var(--color-text-strong);
}

.li-checkbox-box.is-focused {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.li-checkbox-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.li-checkbox-label {
  font-size: var(--text-sm);
  color: var(--color-text);
  line-height: var(--leading-sm);
}

.li-checkbox-description {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
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

@media (prefers-reduced-motion: reduce) {
  .li-checkbox-wrapper:active .li-checkbox-box { transform: none; }
}
</style>
