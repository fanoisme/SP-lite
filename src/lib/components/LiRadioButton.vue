<template>
  <label class="li-radio-wrapper" :class="{ 'li-radio-disabled': disabled }">
    <div class="li-radio-input-container">
      <input 
        type="radio" 
        class="sr-only" 
        :value="value"
        :checked="isChecked" 
        :disabled="disabled"
        :name="name"
        @change="handleChange"
        @focus="isFocused = true"
        @blur="isFocused = false"
      />
      <div 
        class="li-radio-outer" 
        :class="{ 
          'is-checked': isChecked, 
          'is-focused': isFocused
        }"
      >
        <div class="li-radio-inner" :class="{ 'is-checked': isChecked }"></div>
      </div>
    </div>
    
    <div v-if="label || description || $slots.default" class="li-radio-content">
      <div class="li-radio-label">
        <slot>{{ label }}</slot>
      </div>
      <div v-if="description" class="li-radio-description">
        {{ description }}
      </div>
    </div>
  </label>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  modelValue: [String, Number, Boolean],
  value: [String, Number, Boolean],
  name: String,
  label: String,
  description: String,
  disabled: Boolean
});

const emit = defineEmits(['update:modelValue']);
const isFocused = ref(false);

const isChecked = computed(() => props.modelValue === props.value);

const handleChange = () => {
  emit('update:modelValue', props.value);
};
</script>

<style scoped>
/* Allo radio (components.md → Radio): 16px ring, text-strong fill, 2px focus ring. */
.li-radio-wrapper {
  display: inline-flex;
  align-items: flex-start;
  gap: var(--space-2);
  cursor: pointer;
  user-select: none;
}

.li-radio-disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.li-radio-input-container {
  position: relative;
  padding-top: 2px;
  display: inline-flex;
}

.li-radio-outer {
  width: 16px;
  height: 16px;
  border: 1.5px solid var(--color-border-input);
  border-radius: 50%;
  background: var(--color-bg);
  display: grid;
  place-items: center;
  transition: border-color var(--dur-quick);
}

.li-radio-outer.is-checked {
  border-color: var(--color-text-strong);
}

.li-radio-outer.is-focused {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.li-radio-inner {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-text-strong);
  transform: scale(0);
  transition: transform var(--dur-short) var(--ease-spring);
}

.li-radio-inner.is-checked {
  transform: scale(1);
}

.li-radio-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.li-radio-label {
  font-size: var(--text-sm);
  color: var(--color-text);
  line-height: var(--leading-sm);
}

.li-radio-description {
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
</style>
