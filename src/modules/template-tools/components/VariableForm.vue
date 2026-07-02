<template>
  <Transition name="vars-pop">
    <div class="var-form" v-if="variables.length > 0">
      <div class="var-form__header">
        <span class="material-symbols-outlined var-form__icon">data_object</span>
        <span class="var-form__title">Variables Detected</span>
        <span class="var-form__count">{{ variables.length }}</span>
      </div>
      <div class="var-form__grid">
        <div
          v-for="v in variables"
          :key="v.name"
          class="var-form__field"
        >
          <label class="var-form__label" v-text="varLabel(v.name)"></label>
          <input
            class="var-form__input"
            type="text"
            :value="v.value"
            :placeholder="`Enter value for ${v.name}`"
            @input="updateValue(v.name, $event.target.value)"
          />
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
const props = defineProps({
  variables: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['update:variables'])

function varLabel(name) {
  return '${' + name + '}'
}

function updateValue(name, value) {
  const updated = props.variables.map((v) =>
    v.name === name ? { ...v, value } : v
  )
  emit('update:variables', updated)
}
</script>

<style scoped>
.var-form {
  background: linear-gradient(135deg, rgba(255, 188, 37, 0.04), rgba(255, 149, 0, 0.03));
  border: 1px solid rgba(255, 188, 37, 0.12);
  border-radius: 14px;
  padding: 16px;
}

.var-form__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.var-form__icon {
  font-size: 18px;
  color: var(--cta-primary-bg, #FFBC25);
}

.var-form__title {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-on-surface, #1a1a2e);
}

.var-form__count {
  padding: 2px 8px;
  background: var(--cta-primary-bg, #FFBC25);
  color: #fff;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
}

.var-form__grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.var-form__field {
  display: flex;
  align-items: center;
  gap: 12px;
}

.var-form__label {
  min-width: 120px;
  font-size: 12px;
  font-weight: 600;
  color: var(--cta-primary-bg, #FFBC25);
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  background: rgba(255, 188, 37, 0.08);
  padding: 4px 8px;
  border-radius: 6px;
  text-align: center;
}

.var-form__input {
  flex: 1;
  padding: 9px 14px;
  border: 1.5px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  font-size: 13px;
  font-family: inherit;
  color: var(--color-on-surface, #1a1a2e);
  background: rgba(255, 255, 255, 0.8);
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
  outline: none;
}

.var-form__input:focus {
  border-color: var(--cta-primary-bg, #FFBC25);
  box-shadow: 0 0 0 3px rgba(255, 188, 37, 0.1);
}

.var-form__input::placeholder {
  color: #bbb;
}

/* Transition */
.vars-pop-enter-active {
  transition: all 0.4s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
}
.vars-pop-leave-active {
  transition: all 0.2s ease;
}
.vars-pop-enter-from {
  opacity: 0;
  transform: scale(0.95) translateY(-8px);
}
.vars-pop-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>
