// SP-lite — EMVCo QRIS parser and builder.
// Client-side port of SO-Platform's server/lib/qris.js — identical logic,
// Buffer.from() swapped for TextEncoder so it runs in the browser.

// ── CRC-16/CCITT-FALSE ──

export function crc16ccittFalse(s) {
  let crc = 0xFFFF
  const bytes = new TextEncoder().encode(s)
  for (const b of bytes) {
    crc ^= b << 8
    for (let i = 0; i < 8; i += 1) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

// ── Tag Registry ──

const TAG_NAMES = {
  '00': 'Payload Format Indicator',
  '01': 'Point of Initiation Method',
  '02': 'Visa Merchant ID',
  '03': 'Mastercard Merchant ID',
  '04': 'AMEX Merchant ID',
  '05': 'JCB Merchant ID',
  '26': 'Merchant Account Information (Prima)',
  '27': 'Merchant Account Information (2)',
  '28': 'Merchant Account Information (3)',
  '29': 'Merchant Account Information (4)',
  '30': 'Domestic Merchant Account Info',
  '51': 'Merchant Information',
  '52': 'Merchant Category Code (MCC)',
  '53': 'Transaction Currency',
  '54': 'Transaction Amount',
  '55': 'Tip or Convenience Indicator',
  '56': 'Convenience Fee Fixed',
  '57': 'Convenience Fee Percentage',
  '58': 'Country Code',
  '59': 'Merchant Name',
  '60': 'Merchant City',
  '61': 'Postal Code',
  '62': 'Additional Data Field',
  '63': 'CRC',
  '64': 'Merchant Information (template)',
  '65': 'RFU for EMVCo',
}

const SUBTAG_NAMES = {
  '26': {
    '00': 'Global Unique Identifier',
    '01': 'Merchant PAN (NII)',
    '02': 'Merchant ID (NPM)',
    '03': 'Merchant Criteria',
    '04': 'Merchant Channel',
    '05': 'Acquirer',
  },
  '51': {
    '00': 'Global Unique Identifier',
    '01': 'Merchant PAN',
    '02': 'Merchant ID',
    '03': 'Merchant Criteria',
  },
  '62': {
    '01': 'Reference Number / Invoice',
    '02': 'Terminal Label',
    '03': 'Purpose of Transaction',
    '04': 'Additional Consumer Data Request',
    '05': 'Payment System Specific (Acquirer)',
    '06': 'Payment System Specific (2)',
    '07': 'Reference Label',
    '08': 'Mobile Number',
    '09': 'Store Label',
    '10': 'Loyalty Number',
  },
}

// ── City → Postal Code Mapping ──

const CITY_POSTAL = {
  'JAKARTA': '10110',
  'SURABAYA': '60111',
  'BANDUNG': '40111',
  'BEKASI': '17112',
  'SEMARANG': '50111',
  'TANGERANG': '15111',
  'DEPOK': '16411',
  'MEDAN': '20111',
  'PALEMBANG': '30111',
  'MAKASSAR': '90111',
  'YOGYAKARTA': '55111',
  'SOLO': '57111',
  'MALANG': '65111',
  'DENPASAR': '80111',
  'BALIKPAPAN': '76111',
  'MANADO': '95111',
  'PADANG': '25111',
  'PEKANBARU': '28111',
  'BOGOR': '16111',
  'BATAM': '29411',
}

// ── TLV Parser ──

function parseTlv(str, offset = 0, end = null) {
  const tags = []
  const limit = end ?? str.length
  let i = offset

  while (i < limit) {
    if (i + 4 > limit) break

    const id = str.slice(i, i + 2)
    const len = parseInt(str.slice(i + 2, i + 4), 10)
    if (isNaN(len) || i + 4 + len > limit) break

    const value = str.slice(i + 4, i + 4 + len)
    const tag = { id, len, value, offset: i }

    // Recursive parse for container tags
    if (['26', '27', '28', '29', '30', '51', '62', '64'].includes(id)) {
      tag.children = parseTlv(value, 0, value.length)
    }

    tags.push(tag)
    i += 4 + len
  }

  return tags
}

// ── Parse QRIS String ──

export function parseQris(str) {
  if (!str || typeof str !== 'string') {
    return { valid: false, error: 'Empty or invalid input' }
  }

  // Validate CRC
  const crcIdx = str.lastIndexOf('6304')
  if (crcIdx === -1) {
    return { valid: false, error: 'CRC tag (63) not found' }
  }

  const payloadWithoutCrc = str.slice(0, crcIdx + 4)
  const providedCrc = str.slice(crcIdx + 4, crcIdx + 8).toUpperCase()
  const computedCrc = crc16ccittFalse(payloadWithoutCrc).toUpperCase()

  const tags = parseTlv(str, 0, str.length)

  // Extract highlights
  const highlights = extractHighlights(tags)

  return {
    valid: providedCrc === computedCrc,
    crcValid: providedCrc === computedCrc,
    crcProvided: providedCrc,
    crcComputed: computedCrc,
    tags,
    highlights,
    raw: str,
  }
}

// ── Extract Highlights ──

function extractHighlights(tags) {
  const h = {}

  // Merchant Name (tag 59)
  const nameTag = tags.find(t => t.id === '59')
  if (nameTag) h.merchantName = nameTag.value

  // Merchant City (tag 60)
  const cityTag = tags.find(t => t.id === '60')
  if (cityTag) h.merchantCity = cityTag.value

  // Amount (tag 54)
  const amountTag = tags.find(t => t.id === '54')
  if (amountTag) h.amount = amountTag.value

  // Tag 26 (Merchant Account Info)
  const tag26 = tags.find(t => t.id === '26')
  if (tag26?.children) {
    const guid = tag26.children.find(t => t.id === '00')
    if (guid) h.globalUniqueId = guid.value

    const mpan = tag26.children.find(t => t.id === '01')
    if (mpan) {
      h.mpan = mpan.value
      h.mpanForMpc = mpan.value.slice(0, 8)
    }

    const merchantId = tag26.children.find(t => t.id === '02')
    if (merchantId) h.merchantId = merchantId.value

    const criteria = tag26.children.find(t => t.id === '03')
    if (criteria) h.merchantCriteria = criteria.value
  }

  // Tag 62 (Additional Data)
  const tag62 = tags.find(t => t.id === '62')
  if (tag62?.children) {
    const ref = tag62.children.find(t => t.id === '01')
    if (ref) h.referenceNo = ref.value

    const acquirer = tag62.children.find(t => t.id === '05')
    if (acquirer) h.acquirer = acquirer.value
  }

  return h
}

// ── Build QRIS from Fields ──

export function buildQris(fields) {
  const {
    merchantName,
    merchantCity,
    amount,
    merchantId,
    mpan,
    guid,
    acquirer,
    mcc,
    criteria,
    pointOfInitiation,
    postalCode,
    referenceNo,
  } = fields

  // Validate required
  if (!merchantName) throw new Error('Merchant Name is required')
  if (!merchantCity) throw new Error('Merchant City is required')

  // Defaults
  const _guid = guid || 'ID.CO.PRIMAQR.WWW'
  const _mpan = mpan || '936009982977100100'
  const _merchantId = merchantId || generateMerchantId()
  const _criteria = criteria || 'UME'
  const _mcc = mcc || '5812'
  const _poi = pointOfInitiation || (amount ? '11' : '12') // 11=static, 12=dynamic
  const _currency = '360'
  const _country = 'ID'
  const _city = merchantCity.toUpperCase()
  const _postal = postalCode || CITY_POSTAL[_city] || '00000'
  const _refNo = referenceNo || generateRefNo()

  // Build tag 26 (Merchant Account Info)
  const tag26_00 = buildTlv('00', _guid)
  const tag26_01 = buildTlv('01', _mpan)
  const tag26_02 = buildTlv('02', _merchantId)
  const tag26_03 = buildTlv('03', _criteria)
  const tag26value = tag26_00 + tag26_01 + tag26_02 + tag26_03

  // Build tag 62 (Additional Data)
  let tag62value = ''
  tag62value += buildTlv('01', _refNo)
  if (acquirer) {
    tag62value += buildTlv('05', acquirer)
  }

  // Build main string
  let qr = ''
  qr += buildTlv('00', '01')
  qr += buildTlv('01', _poi)
  qr += buildTlv('26', tag26value)
  qr += buildTlv('52', _mcc)
  qr += buildTlv('53', _currency)
  if (amount) {
    qr += buildTlv('54', String(amount))
  }
  qr += buildTlv('58', _country)
  qr += buildTlv('59', merchantName.slice(0, 25))
  qr += buildTlv('60', _city.slice(0, 15))
  qr += buildTlv('61', _postal.slice(0, 10))
  if (tag62value) {
    qr += buildTlv('62', tag62value)
  }

  // Add CRC placeholder and compute
  const forCrc = qr + '6304'
  const crc = crc16ccittFalse(forCrc)
  qr += buildTlv('63', crc)

  const result = parseQris(qr)
  return {
    qrValue: qr,
    ...result,
  }
}

// ── Build Proprietary QRIS ──

export function buildProprietaryQris(fields) {
  const {
    merchantName,
    merchantId,
    amount,
    referenceNo,
    provider,
    additionalData,
  } = fields

  // Validate required
  if (!merchantName) throw new Error('Merchant Name is required')
  if (!merchantId) throw new Error('Merchant ID is required')

  // Build proprietary string — simple key-value format
  // Format: PROVIDER|MERCHANT_ID|MERCHANT_NAME|AMOUNT|REF_NO|EXTRA
  const _refNo = referenceNo || generateRefNo()
  const _provider = provider || 'GENERIC'
  const _amount = amount || '0'

  const parts = [
    _provider,
    merchantId,
    merchantName.slice(0, 25),
    String(_amount),
    _refNo,
    additionalData || '',
  ]

  const qrValue = parts.join('|')

  // Parse what we can
  const highlights = {
    merchantName,
    merchantId,
    amount: String(_amount),
    referenceNo: _refNo,
    provider: _provider,
  }

  // Build a simple tag list for display
  const tags = [
    { id: 'P01', name: 'Provider', value: _provider, length: _provider.length },
    { id: 'P02', name: 'Merchant ID', value: merchantId, length: merchantId.length },
    { id: 'P03', name: 'Merchant Name', value: merchantName.slice(0, 25), length: Math.min(merchantName.length, 25) },
    { id: 'P04', name: 'Amount', value: String(_amount), length: String(_amount).length },
    { id: 'P05', name: 'Reference No', value: _refNo, length: _refNo.length },
  ]

  if (additionalData) {
    tags.push({ id: 'P06', name: 'Additional Data', value: additionalData, length: additionalData.length })
  }

  return {
    qrValue,
    valid: true,
    highlights,
    tags,
  }
}

// ── Helper: Build single TLV ──

function buildTlv(id, value) {
  const len = String(value.length).padStart(2, '0')
  return `${id}${len}${value}`
}

// ── Helper: Generate Merchant ID ──

function generateMerchantId() {
  const chars = '0123456789'
  let result = ''
  for (let i = 0; i < 15; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

// ── Helper: Generate Reference Number ──

function generateRefNo() {
  const now = new Date()
  const ts = now.toISOString().replace(/[-:T]/g, '').slice(0, 14)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let rand = ''
  for (let i = 0; i < 6; i++) {
    rand += chars[Math.floor(Math.random() * chars.length)]
  }
  return 'MID' + ts + rand
}

// ── Get all tags as flat list ──

export function flattenTags(tags, prefix = '') {
  const result = []
  for (const tag of tags) {
    const tagId = prefix ? `${prefix}/${tag.id}` : tag.id
    const name = prefix
      ? (SUBTAG_NAMES[prefix]?.[tag.id] || `Sub-tag ${tag.id}`)
      : (TAG_NAMES[tag.id] || `Tag ${tag.id}`)

    result.push({
      id: tagId,
      name,
      value: tag.value,
      length: tag.len,
    })

    if (tag.children) {
      result.push(...flattenTags(tag.children, tagId.split('/')[0]))
    }
  }
  return result
}
