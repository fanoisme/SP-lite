<template>
  <LiModal
    :modelValue="true"
    :title="role ? 'Edit Role' : 'Create Role'"
    size="sm"
    @update:modelValue="$emit('close')"
  >
    <div class="adm-rmodal__form">
      <LiTextField
        v-model="name"
        label="Role Name"
        placeholder="e.g. Tester, Developer, Support"
        iconLeft="shield_person"
      />
      <div v-if="error" class="adm-rmodal__error">
        <span class="material-symbols-outlined">error</span>
        {{ error }}
      </div>
    </div>

    <template #footer>
      <div class="adm-rmodal__actions">
        <LiButton variant="ghost" @click="$emit('close')">Cancel</LiButton>
        <LiButton variant="primary" :loading="saving" :disabled="!name.trim()" @click="onSubmit">
          {{ role ? 'Rename' : 'Create' }}
        </LiButton>
      </div>
    </template>
  </LiModal>
</template>

<script setup>
import { ref } from 'vue'
import LiModal from '@lib/components/LiModal.vue'
import LiTextField from '@lib/components/LiTextField.vue'
import LiButton from '@lib/components/LiButton.vue'

const props = defineProps({
  role: Object,  // null for create, { id, name } for edit
})

const emit = defineEmits(['save', 'close'])

const name = ref(props.role?.name || '')
const saving = ref(false)
const error = ref(null)

async function onSubmit() {
  if (!name.value.trim()) return
  saving.value = true
  error.value = null
  emit('save', name.value.trim(), (err) => {
    saving.value = false
    if (err) error.value = err
  })
}
</script>

<style scoped>
.adm-rmodal__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-l, 16px);
}

.adm-rmodal__error {
  display: flex;
  align-items: center;
  gap: var(--space-xs, 4px);
  font-size: 13px;
  color: var(--color-error, #C83E3B);
  padding: var(--space-s, 8px);
  background: var(--color-error-container, #FDECEE);
  border-radius: var(--radius-sm, 12px);
}

.adm-rmodal__error .material-symbols-outlined {
  font-size: 16px;
}

.adm-rmodal__actions {
  display: flex;
  gap: var(--space-s, 8px);
  justify-content: flex-end;
}
</style>
