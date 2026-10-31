<template>
  <div class="li-slider-wrapper" :class="{ 'li-slider-disabled': disabled }">
    <div v-if="label || valueLabel" class="li-slider-header">
      <span v-if="label" class="li-slider-label">{{ label }}</span>
      <span v-if="valueLabel" class="li-slider-value">{{ valueLabel }}</span>
    </div>
    
    <div class="li-slider-container">
      <input 
        type="range" 
        class="li-slider-input" 
        :min="min" 
        :max="max" 
        :step="step"
        :value="modelValue"
        :disabled="disabled"
        @input="onInput"
        @focus="isFocused = true"
        @blur="isFocused = false"
      />
      
      <div class="li-slider-track">
        <div class="li-slider-fill" :style="{ width: fillPercentage + '%' }"></div>
      </div>
      
      <div class="li-slider-thumb" :style="{ left: fillPercentage + '%' }" :class="{ 'is-focused': isFocused }"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  modelValue: {
    type: Number,
    default: 0
  },
  min: {
    type: Number,
    default: 0
  },
  max: {
    type: Number,
    default: 100
  },
  step: {
    type: Number,
    default: 1
  },
  label: String,
  valueLabel: String,
  disabled: Boolean
});

const emit = defineEmits(['update:modelValue']);
const isFocused = ref(false);

const fillPercentage = computed(() => {
  return ((props.modelValue - props.min) / (props.max - props.min)) * 100;
});

const onInput = (e) => {
  emit('update:modelValue', Number(e.target.value));
};
</script>

<style scoped>
/* Allo slider (app.css .rng): text-strong thumb, focus ring, spring press. */
.li-slider-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
}

.li-slider-disabled {
  opacity: 0.6;
}

.li-slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.li-slider-label {
  color: var(--color-text);
  font-weight: 600;
}

.li-slider-value {
  color: var(--color-text);
  font-weight: 600;
}

.li-slider-container {
  position: relative;
  height: 28px;
  display: flex;
  align-items: center;
}

.li-slider-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: grab;
  z-index: 3;
  margin: 0;
}

.li-slider-input:active {
  cursor: grabbing;
}

.li-slider-disabled .li-slider-input {
  cursor: not-allowed;
}

.li-slider-track {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 100%;
  height: 4px;
  background: var(--color-surface-2);
  border-radius: var(--radius-pill);
  overflow: hidden;
  z-index: 1;
}

.li-slider-fill {
  height: 100%;
  background: var(--color-text-strong);
  transition: width 0.1s linear;
}

.li-slider-thumb {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 20px;
  height: 20px;
  background: var(--color-bg);
  border: 2px solid var(--color-text-strong);
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 5, 58, 0.25);
  z-index: 2;
  transition: left 0.1s linear, transform var(--dur-short) var(--ease-spring), border-color var(--dur-quick);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.li-slider-input:active ~ .li-slider-thumb {
  transform: translate(-50%, -50%) scale(1.18);
}

.li-slider-thumb.is-focused {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}
</style>
