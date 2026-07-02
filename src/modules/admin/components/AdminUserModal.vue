<template>
  <LiModal :modelValue="true" title="Add User" size="sm" @update:modelValue="$emit('close')">
    <div class="adm-umodal__form">
      <LiTextField
        v-model="form.email"
        label="Email"
        type="email"
        placeholder="nama@perusahaan.com"
        iconLeft="mail"
      />
      <LiTextField
        v-model="form.username"
        label="Username (opsional)"
        placeholder="username"
        iconLeft="badge"
      />
      <LiTextField
        v-model="form.fullName"
        label="Full Name (opsional)"
        placeholder="Nama Lengkap"
        iconLeft="person"
      />

      <div class="adm-umodal__field">
        <label class="adm-umodal__label">Role</label>
        <LiSelect v-model="form.role" :options="roleOptions" class="adm-umodal__select" />
      </div>

      <LiTextField
        v-model="form.password"
        label="Password"
        type="password"
        placeholder="••••••••"
        iconLeft="lock"
      />

      <div v-if="error" class="adm-umodal__error">
        <span class="material-symbols-outlined">error</span>
        {{ error }}
      </div>
      <p class="adm-umodal__note">
        <span class="material-symbols-outlined">info</span>
        Admin-created accounts are active immediately.
      </p>
    </div>

    <template #footer>
      <div class="adm-umodal__actions">
        <LiButton variant="ghost" @click="$emit('close')">Cancel</LiButton>
        <LiButton variant="primary" :loading="saving" :disabled="!form.email || !form.password" @click="onSubmit">
          Create
        </LiButton>
      </div>
    </template>
  </LiModal>
</template>

<script setup>
import { ref } from 'vue'
import LiModal from '@lib/components/LiModal.vue'
import LiTextField from '@lib/components/LiTextField.vue'
import LiSelect from '@lib/components/LiSelect.vue'
import LiButton from '@lib/components/LiButton.vue'

const props = defineProps({
  roleOptions: { type: Array, default: () => [] },
})

const emit = defineEmits(['save', 'close'])

const form = ref({
  email: '',
  username: '',
  fullName: '',
  role: 'QA',
  password: '',
})
const saving = ref(false)
const error = ref(null)

async function onSubmit() {
  if (!form.value.email || !form.value.password) return
  saving.value = true
  error.value = null
  emit('save', {
    email: form.value.email.trim(),
    password: form.value.password,
    username: form.value.username.trim() || undefined,
    fullName: form.value.fullName.trim() || undefined,
    role: form.value.role,
  }, (err) => {
    saving.value = false
    if (err) error.value = err
  })
}
</script>

<style scoped>
.adm-umodal__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-l, 16px);
}

.adm-umodal__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.adm-umodal__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-gray-700, #666);
}

.adm-umodal__select {
  min-width: 100%;
}

.adm-umodal__error {
  display: flex;
  align-items: center;
  gap: var(--space-xs, 4px);
  font-size: 13px;
  color: var(--color-error, #C83E3B);
  padding: var(--space-s, 8px);
  background: var(--color-error-container, #FDECEE);
  border-radius: var(--radius-sm, 12px);
}

.adm-umodal__error .material-symbols-outlined {
  font-size: 16px;
}

.adm-umodal__note {
  display: flex;
  align-items: center;
  gap: var(--space-xs, 6px);
  margin: 0;
  font-size: 12px;
  color: var(--color-on-surface-muted, #999);
}

.adm-umodal__note .material-symbols-outlined {
  font-size: 16px;
}

.adm-umodal__actions {
  display: flex;
  gap: var(--space-s, 8px);
  justify-content: flex-end;
}
</style>
