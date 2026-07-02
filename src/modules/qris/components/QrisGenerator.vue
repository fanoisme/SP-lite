<template>
  <div class="gen">
    <!-- QR Type Toggle -->
    <div class="gen__type-toggle">
      <button
        class="gen__type-btn"
        :class="{ 'gen__type-btn--active': qrType === 'emvco' }"
        @click="qrType = 'emvco'"
      >
        <span class="material-symbols-outlined">qr_code_2</span>
        EMVCo QRIS
      </button>
      <button
        class="gen__type-btn"
        :class="{ 'gen__type-btn--active': qrType === 'proprietary' }"
        @click="qrType = 'proprietary'"
      >
        <span class="material-symbols-outlined">barcode</span>
        Proprietary
      </button>
    </div>

    <!-- Input Mode Toggle -->
    <div class="gen__mode-toggle">
      <button
        class="gen__mode-btn"
        :class="{ 'gen__mode-btn--active': mode === 'form' }"
        @click="mode = 'form'"
      >
        <span class="material-symbols-outlined">edit_note</span>
        Form Input
      </button>
      <button
        class="gen__mode-btn"
        :class="{ 'gen__mode-btn--active': mode === 'paste' }"
        @click="mode = 'paste'"
      >
        <span class="material-symbols-outlined">content_paste</span>
        Paste Value
      </button>
    </div>

    <!-- Form Mode -->
    <div v-if="mode === 'form'" class="gen__form">
      <!-- EMVCo Form -->
      <template v-if="qrType === 'emvco'">
        <!-- Required Fields -->
        <div class="gen__section">
          <h3 class="gen__section-title">Required Fields</h3>
          <div class="gen__fields">
          <div class="gen__field">
            <label class="gen__label">Merchant Name <span class="gen__req">*</span></label>
            <input v-model="form.merchantName" type="text" class="gen__input" placeholder="e.g. TOKO MAJU MUNDUR" maxlength="25" />
          </div>
          <div class="gen__field">
            <label class="gen__label">Merchant City <span class="gen__req">*</span></label>
            <select v-model="form.merchantCity" class="gen__input">
              <option value="" disabled>Select city...</option>
              <option v-for="city in cities" :key="city" :value="city">{{ city }}</option>
            </select>
          </div>
          <div class="gen__field">
            <label class="gen__label">Amount (IDR) <span class="gen__opt">optional — leave empty for dynamic QR</span></label>
            <input v-model="form.amount" type="number" class="gen__input" placeholder="e.g. 50000" min="0" />
          </div>
        </div>
      </div>

      <!-- Advanced Fields -->
      <details class="gen__advanced">
        <summary class="gen__advanced-toggle">
          <span class="material-symbols-outlined">tune</span>
          Advanced Options
          <span class="gen__advanced-hint">optional — defaults will be used if not edited</span>
        </summary>
        <div class="gen__fields">
          <div class="gen__field">
            <label class="gen__label">Global Unique Identifier (Tag 26/00)</label>
            <input v-model="form.guid" type="text" class="gen__input gen__input--mono" placeholder="ID.CO.PRIMAQR.WWW" />
          </div>
          <div class="gen__field">
            <label class="gen__label">Merchant PAN / NII (Tag 26/01)</label>
            <input v-model="form.mpan" type="text" class="gen__input gen__input--mono" placeholder="936009982977100100" />
          </div>
          <div class="gen__field">
            <label class="gen__label">Merchant ID / NPM (Tag 26/02)</label>
            <input v-model="form.merchantId" type="text" class="gen__input gen__input--mono" placeholder="auto-generated" />
          </div>
          <div class="gen__field">
            <label class="gen__label">Merchant Criteria (Tag 26/03)</label>
            <input v-model="form.criteria" type="text" class="gen__input gen__input--mono" placeholder="UME" maxlength="3" />
          </div>
          <div class="gen__field">
            <label class="gen__label">MCC (Tag 52)</label>
            <input v-model="form.mcc" type="text" class="gen__input gen__input--mono" placeholder="5812" maxlength="4" />
          </div>
          <div class="gen__field">
            <label class="gen__label">Acquirer (Tag 62/05)</label>
            <input v-model="form.acquirer" type="text" class="gen__input gen__input--mono" placeholder="optional" />
          </div>
          <div class="gen__field">
            <label class="gen__label">Postal Code (Tag 61)</label>
            <input v-model="form.postalCode" type="text" class="gen__input gen__input--mono" placeholder="auto from city" maxlength="10" />
          </div>
          <div class="gen__field">
            <label class="gen__label">Reference Number (Tag 62/01)</label>
            <input v-model="form.referenceNo" type="text" class="gen__input gen__input--mono" placeholder="auto-generated" maxlength="23" />
          </div>
        </div>
      </details>

      <button class="gen__submit" @click="handleGenerate" :disabled="generating || !form.merchantName || !form.merchantCity">
        <span v-if="generating" class="gen__submit-spinner"></span>
        <span v-else>
          <span class="material-symbols-outlined">qr_code_2</span>
          Generate EMVCo QRIS
        </span>
      </button>
      </template>

      <!-- Proprietary Form -->
      <template v-if="qrType === 'proprietary'">
        <div class="gen__section">
          <h3 class="gen__section-title">Proprietary QR Fields</h3>
          <div class="gen__fields">
            <div class="gen__field">
              <label class="gen__label">Provider <span class="gen__req">*</span></label>
              <select v-model="proprietaryForm.provider" class="gen__input">
                <option value="" disabled>Select provider...</option>
                <option value="GOPAY">GoPay</option>
                <option value="OVO">OVO</option>
                <option value="DANA">DANA</option>
                <option value="SHOPEEPAY">ShopeePay</option>
                <option value="LINKAJA">LinkAja</option>
                <option value="GENERIC">Generic</option>
              </select>
            </div>
            <div class="gen__field">
              <label class="gen__label">Merchant Name <span class="gen__req">*</span></label>
              <input v-model="proprietaryForm.merchantName" type="text" class="gen__input" placeholder="e.g. TOKO MAJU MUNDUR" maxlength="25" />
            </div>
            <div class="gen__field">
              <label class="gen__label">Merchant ID <span class="gen__req">*</span></label>
              <input v-model="proprietaryForm.merchantId" type="text" class="gen__input gen__input--mono" placeholder="e.g. 1234567890" />
            </div>
            <div class="gen__field">
              <label class="gen__label">Amount (IDR)</label>
              <input v-model="proprietaryForm.amount" type="number" class="gen__input" placeholder="e.g. 50000" min="0" />
            </div>
            <div class="gen__field">
              <label class="gen__label">Reference Number <span class="gen__opt">optional</span></label>
              <input v-model="proprietaryForm.referenceNo" type="text" class="gen__input gen__input--mono" placeholder="auto-generated" />
            </div>
            <div class="gen__field">
              <label class="gen__label">Additional Data <span class="gen__opt">optional</span></label>
              <input v-model="proprietaryForm.additionalData" type="text" class="gen__input" placeholder="any extra info" />
            </div>
          </div>
        </div>

        <button class="gen__submit" @click="handleGenerateProprietary" :disabled="generating || !proprietaryForm.merchantName || !proprietaryForm.merchantId || !proprietaryForm.provider">
          <span v-if="generating" class="gen__submit-spinner"></span>
          <span v-else>
            <span class="material-symbols-outlined">barcode</span>
            Generate Proprietary QR
          </span>
        </button>
      </template>
    </div>

    <!-- Paste Mode -->
    <div v-if="mode === 'paste'" class="gen__paste">
      <div class="gen__paste-header">
        <label class="gen__label">Paste QR Code Value</label>
        <button class="gen__clipboard-btn" @click="pasteFromClipboard" title="Paste from clipboard">
          <span class="material-symbols-outlined">content_paste</span>
          Clipboard
        </button>
      </div>
      <div class="gen__textarea-wrap">
        <textarea
          v-model="pasteValue"
          class="gen__textarea"
          placeholder="Paste EMVCo or Proprietary QRIS string here..."
          rows="6"
        ></textarea>
        <span v-if="pasteValue" class="gen__char-count">{{ pasteValue.length }} chars</span>
      </div>
      <button class="gen__submit" @click="handleParse" :disabled="parsing || !pasteValue.trim()">
        <span v-if="parsing" class="gen__submit-spinner"></span>
        <span v-else>
          <span class="material-symbols-outlined">search</span>
          Parse QRIS
        </span>
      </button>
    </div>

    <!-- Error -->
    <div v-if="error" class="gen__error">
      <span class="material-symbols-outlined">error</span>
      {{ error }}
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useQris } from '../composables/useQris.js'

const emit = defineEmits(['generated'])

const { generating, parsing, result, error, generate, parse } = useQris()

const mode = ref('form')
const qrType = ref('emvco')
const pasteValue = ref('')

const cities = [
  'JAKARTA', 'SURABAYA', 'BANDUNG', 'BEKASI', 'SEMARANG',
  'TANGERANG', 'DEPOK', 'MEDAN', 'PALEMBANG', 'MAKASSAR',
  'YOGYAKARTA', 'SOLO', 'MALANG', 'DENPASAR', 'BALIKPAPAN',
  'MANADO', 'PADANG', 'PEKANBARU', 'BOGOR', 'BATAM',
]

const form = reactive({
  merchantName: '',
  merchantCity: '',
  amount: '',
  guid: '',
  mpan: '',
  merchantId: '',
  criteria: '',
  mcc: '',
  acquirer: '',
  postalCode: '',
  referenceNo: '',
})

const proprietaryForm = reactive({
  provider: '',
  merchantName: '',
  merchantId: '',
  amount: '',
  referenceNo: '',
  additionalData: '',
})

async function handleGenerate() {
  const fields = {
    type: 'emvco',
    merchantName: form.merchantName,
    merchantCity: form.merchantCity,
  }
  if (form.amount) fields.amount = Number(form.amount)
  if (form.guid) fields.guid = form.guid
  if (form.mpan) fields.mpan = form.mpan
  if (form.merchantId) fields.merchantId = form.merchantId
  if (form.criteria) fields.criteria = form.criteria
  if (form.mcc) fields.mcc = form.mcc
  if (form.acquirer) fields.acquirer = form.acquirer
  if (form.postalCode) fields.postalCode = form.postalCode
  if (form.referenceNo) fields.referenceNo = form.referenceNo

  const data = await generate(fields)
  if (data) emit('generated', data)
}

async function handleGenerateProprietary() {
  const fields = {
    type: 'proprietary',
    provider: proprietaryForm.provider,
    merchantName: proprietaryForm.merchantName,
    merchantId: proprietaryForm.merchantId,
  }
  if (proprietaryForm.amount) fields.amount = Number(proprietaryForm.amount)
  if (proprietaryForm.referenceNo) fields.referenceNo = proprietaryForm.referenceNo
  if (proprietaryForm.additionalData) fields.additionalData = proprietaryForm.additionalData

  const data = await generate(fields)
  if (data) emit('generated', data)
}

async function handleParse() {
  const data = await parse(pasteValue.value.trim())
  if (data) emit('generated', data)
}

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText()
    if (text) pasteValue.value = text
  } catch {
    // Clipboard access denied — fallback: user can Ctrl+V
  }
}
</script>

<style scoped>
.gen {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── QR Type Toggle ── */
.gen__type-toggle {
  display: flex;
  gap: 4px;
  background: rgba(0, 0, 0, 0.03);
  border-radius: var(--radius-sm, 12px);
  padding: 3px;
  margin-bottom: 12px;
}

.gen__type-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 14px;
  background: none;
  border: none;
  border-radius: var(--radius-xs, 8px);
  font-size: 13px;
  font-weight: 600;
  color: var(--color-gray-500, #999);
  cursor: pointer;
  transition: all 200ms var(--ease-out);
  font-family: var(--font-body, 'Inter', sans-serif);
}

.gen__type-btn:hover {
  color: var(--color-gray-700, #666);
}

.gen__type-btn--active {
  background: var(--color-gray-0, #fff);
  color: var(--color-gray-900, #333);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.gen__type-btn .material-symbols-outlined {
  font-size: 18px;
}

/* ── Mode Toggle ── */
.gen__mode-toggle {
  display: flex;
  gap: 4px;
  background: rgba(0, 0, 0, 0.03);
  border-radius: var(--radius-sm, 12px);
  padding: 3px;
}

.gen__mode-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  background: none;
  border: none;
  border-radius: var(--radius-xs, 8px);
  font-size: 12px;
  font-weight: 600;
  color: var(--color-gray-500, #999);
  cursor: pointer;
  transition: all 200ms var(--ease-out);
  font-family: var(--font-body, 'Inter', sans-serif);
}

.gen__mode-btn:hover {
  color: var(--color-gray-700, #666);
}

.gen__mode-btn--active {
  background: var(--color-gray-0, #fff);
  color: var(--color-gray-900, #333);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.gen__mode-btn .material-symbols-outlined {
  font-size: 16px;
}

/* ── Form ── */
.gen__form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.gen__section-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-gray-500, #999);
  margin: 0 0 10px;
}

.gen__fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gen__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.gen__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-gray-700, #666);
}

.gen__req {
  color: var(--color-red-400, #C83E3B);
}

.gen__opt {
  font-weight: 400;
  color: var(--color-gray-400, #B3B3B3);
  font-size: 11px;
}

.gen__input {
  padding: 10px 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: var(--radius-xs, 8px);
  font-size: 13px;
  font-family: var(--font-body, 'Inter', sans-serif);
  color: var(--color-gray-900, #333);
  background: rgba(255, 255, 255, 0.6);
  outline: none;
  transition: border-color 200ms;
}

.gen__input:focus {
  border-color: var(--color-yellow-400, #F9C700);
}

.gen__input--mono {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
}

.gen__paste {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gen__paste-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.gen__clipboard-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: var(--radius-xs, 8px);
  font-size: 11px;
  font-weight: 600;
  color: var(--color-gray-600, #888);
  cursor: pointer;
  transition: all 200ms;
  font-family: var(--font-body, 'Inter', sans-serif);
}

.gen__clipboard-btn:hover {
  background: rgba(0, 0, 0, 0.08);
  color: var(--color-gray-800, #444);
}

.gen__clipboard-btn .material-symbols-outlined {
  font-size: 14px;
}

.gen__textarea-wrap {
  position: relative;
}

.gen__textarea {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: var(--radius-xs, 8px);
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-gray-900, #333);
  background: rgba(255, 255, 255, 0.6);
  resize: vertical;
  outline: none;
  transition: border-color 200ms;
  box-sizing: border-box;
}

.gen__textarea:focus {
  border-color: var(--color-yellow-400, #F9C700);
  box-shadow: 0 0 0 3px rgba(249, 199, 0, 0.1);
}

.gen__char-count {
  position: absolute;
  bottom: 8px;
  right: 10px;
  font-size: 10px;
  color: var(--color-gray-400, #B3B3B3);
  pointer-events: none;
}

/* ── Advanced ── */
.gen__advanced {
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: var(--radius-sm, 12px);
  overflow: hidden;
}

.gen__advanced[open] {
  padding-bottom: 16px;
}

.gen__advanced-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-gray-700, #666);
  cursor: pointer;
  list-style: none;
  background: rgba(0, 0, 0, 0.02);
}

.gen__advanced-toggle::-webkit-details-marker {
  display: none;
}

.gen__advanced-toggle .material-symbols-outlined {
  font-size: 18px;
  color: var(--color-gray-400, #B3B3B3);
}

.gen__advanced-hint {
  font-size: 11px;
  font-weight: 400;
  color: var(--color-gray-400, #B3B3B3);
  margin-left: auto;
}

.gen__advanced[open] .gen__fields {
  padding: 12px 16px 0;
}

/* ── Submit ── */
.gen__submit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 24px;
  background: var(--cta-primary-bg, #FFBC25);
  color: var(--cta-primary-text, #1E1E1E);
  border: none;
  border-radius: var(--radius-pill, 999px);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 200ms var(--ease-out);
  font-family: var(--font-body, 'Inter', sans-serif);
}

.gen__submit:hover:not(:disabled) {
  transform: translateY(-1px);
}

.gen__submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.gen__submit .material-symbols-outlined {
  font-size: 18px;
}

.gen__submit-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(0, 0, 0, 0.2);
  border-bottom-color: transparent;
  border-radius: 50%;
  animation: gen-spin 600ms linear infinite;
}

@keyframes gen-spin {
  to { transform: rotate(360deg); }
}

/* ── Error ── */
.gen__error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--color-error-container, #FDECEE);
  color: var(--color-on-error-container, #A33129);
  border-radius: var(--radius-xs, 8px);
  font-size: 13px;
  font-weight: 500;
}

.gen__error .material-symbols-outlined {
  font-size: 18px;
  flex-shrink: 0;
}
</style>
