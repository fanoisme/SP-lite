// Video Frames — 100% client-side frame extraction.
// MODULE-LEVEL SINGLETON: processing continues when user navigates away.
// Yields to event loop between iterations so UI stays responsive.

import { ref, computed } from 'vue'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

// ── Module-level state (singleton) ──

const processing = ref(false)
const progress = ref('')
const frames = ref([])     // Array of { blob, width, height, size, time, selected }
const error = ref(null)

let aborted = false  // cancellation flag

// Computed
const selectedFrames = computed(() => frames.value.filter(f => f.selected))
const selectedCount = computed(() => selectedFrames.value.length)
const totalCount = computed(() => frames.value.length)
const totalSize = computed(() => frames.value.reduce((sum, f) => sum + f.size, 0))
const selectedSize = computed(() => selectedFrames.value.reduce((sum, f) => sum + f.size, 0))

// Yield to event loop so UI can update between iterations
function yieldToUI() {
  return new Promise(r => setTimeout(r, 0))
}

function reset() {
  aborted = true
  // Revoke all object URLs before clearing
  frames.value.forEach(f => {
    if (f._url) URL.revokeObjectURL(f._url)
  })
  processing.value = false
  progress.value = ''
  frames.value = []
  error.value = null
}

function selectAll() {
  frames.value.forEach(f => { f.selected = true })
}

function deselectAll() {
  frames.value.forEach(f => { f.selected = false })
}

function toggleSelect(index) {
  frames.value[index].selected = !frames.value[index].selected
}

function toggleAll() {
  const allSelected = frames.value.every(f => f.selected)
  frames.value.forEach(f => { f.selected = !allSelected })
}

/**
 * Compare two ImageData objects — returns ratio of changed pixels (0..1)
 * Uses a coarse grid for speed.
 */
function pixelDiff(a, b) {
  const da = a.data, db = b.data
  const len = da.length
  const step = Math.max(1, Math.floor(len / (64 * 64 * 4))) * 4
  let changed = 0, sampled = 0
  for (let i = 0; i < len; i += step) {
    const diff = Math.abs(da[i] - db[i]) +
                 Math.abs(da[i + 1] - db[i + 1]) +
                 Math.abs(da[i + 2] - db[i + 2])
    if (diff > 76) changed++
    sampled++
  }
  return changed / sampled
}

/**
 * Extract distinct frames from a video file.
 * @param {File} file - Video file from input
 * @param {number} threshold - Pixel diff threshold (0-1), default 0.05
 */
async function extract(file, threshold = 0.05) {
  // Cancel any previous extraction
  aborted = true
  await yieldToUI()

  // Reset for new extraction
  frames.value.forEach(f => {
    if (f._url) URL.revokeObjectURL(f._url)
  })
  frames.value = []
  error.value = null

  aborted = false
  processing.value = true
  progress.value = ''

  try {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'

    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve
      video.onerror = () => reject(new Error('Cannot read video file'))
      video.src = url
    })

    const duration = video.duration
    const width = video.videoWidth
    const height = video.videoHeight
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    // Step 1 — Sample frames at 1fps (yield between each)
    const sampleCount = Math.max(1, Math.floor(duration))
    const samples = []

    for (let i = 0; i < sampleCount; i++) {
      if (aborted) return
      progress.value = `Extracting frame ${i + 1}/${sampleCount}...`
      const blob = await captureFrame(video, canvas, ctx, i)
      if (aborted) return
      samples.push({ blob, time: i })
      // Yield to UI every frame so page stays responsive
      await yieldToUI()
    }

    URL.revokeObjectURL(url)

    // Step 2 — Filter: keep only visually distinct frames (yield between each)
    const COMP_SIZE = 32
    const compCanvas = document.createElement('canvas')
    compCanvas.width = COMP_SIZE
    compCanvas.height = COMP_SIZE
    const compCtx = compCanvas.getContext('2d', { willReadFrequently: true })

    let prevData = null
    let kept = []

    for (let i = 0; i < samples.length; i++) {
      if (aborted) return
      progress.value = `Comparing frame ${i + 1}/${samples.length}...`
      const img = await blobToImage(samples[i].blob)
      compCtx.drawImage(img, 0, 0, COMP_SIZE, COMP_SIZE)
      const imgData = compCtx.getImageData(0, 0, COMP_SIZE, COMP_SIZE)

      if (prevData === null) {
        kept.push(samples[i])
        prevData = imgData
        await yieldToUI()
        continue
      }

      const diff = pixelDiff(prevData, imgData)
      if (diff >= threshold) {
        kept.push(samples[i])
        prevData = imgData
      }
      await yieldToUI()
    }

    // Fallback — lower threshold if too few frames
    if (kept.length < 5 && samples.length >= 5) {
      const lowerThreshold = threshold * 0.3
      kept = []
      prevData = null

      for (let i = 0; i < samples.length; i++) {
        if (aborted) return
        const img = await blobToImage(samples[i].blob)
        compCtx.drawImage(img, 0, 0, COMP_SIZE, COMP_SIZE)
        const imgData = compCtx.getImageData(0, 0, COMP_SIZE, COMP_SIZE)

        if (prevData === null) {
          kept.push(samples[i])
          prevData = imgData
          await yieldToUI()
          continue
        }

        const diff = pixelDiff(prevData, imgData)
        if (diff >= lowerThreshold) {
          kept.push(samples[i])
          prevData = imgData
        }
        await yieldToUI()
      }
    }

    if (aborted) return

    // Build frame objects with metadata
    frames.value = kept.map((item, i) => ({
      blob: item.blob,
      width,
      height,
      size: item.blob.size,
      time: item.time,
      selected: true,
      _url: URL.createObjectURL(item.blob),
      index: i,
    }))

    progress.value = `Done — ${kept.length} distinct frames extracted`
  } catch (err) {
    if (aborted) return
    error.value = err.message
    progress.value = ''
  } finally {
    if (!aborted) processing.value = false
  }
}

function captureFrame(video, canvas, ctx, time) {
  return new Promise((resolve, reject) => {
    video.currentTime = time
    video.onseeked = () => {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)
      canvas.toBlob(blob => {
        if (blob) resolve(blob)
        else reject(new Error('Failed to capture frame'))
      }, 'image/jpeg', 0.9)
    }
    setTimeout(() => reject(new Error('Frame capture timeout')), 10000)
  })
}

function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = URL.createObjectURL(blob)
  })
}

/** Format bytes to human-readable */
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

/** Format seconds to mm:ss */
function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Pack frames into a zip and download */
async function downloadZip(videoFileName, selectedOnly = false) {
  const source = selectedOnly ? selectedFrames.value : frames.value
  if (source.length === 0) return

  progress.value = 'Creating zip...'
  const zip = new JSZip()

  for (let i = 0; i < source.length; i++) {
    const buf = await source[i].blob.arrayBuffer()
    zip.file(`frame-${String(i).padStart(4, '0')}.jpg`, buf)
  }

  const baseName = videoFileName.replace(/\.[^.]+$/, '')
  const suffix = selectedOnly ? '-selected' : ''
  const blob = await zip.generateAsync({ type: 'blob' })
  saveAs(blob, `${baseName}${suffix}.zip`)
  progress.value = `Downloaded ${baseName}${suffix}.zip`
}

// ── Export ──

export function useVideoFrames() {
  return {
    processing, progress, frames, error,
    selectedFrames, selectedCount, totalCount, totalSize, selectedSize,
    extract, downloadZip, reset,
    selectAll, deselectAll, toggleSelect, toggleAll,
    formatSize, formatTime,
  }
}
