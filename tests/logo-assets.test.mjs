import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { test } from 'node:test'

const gifUrl = new URL('../src/assets/brand/sp-lite-golden.gif', import.meta.url)
const pngUrl = new URL('../src/assets/brand/sp-lite-golden.png', import.meta.url)

test('golden mascot GIF satisfies the shipped asset contract', async () => {
  const gif = await readFile(gifUrl)
  const info = await stat(gifUrl)

  assert.equal(gif.subarray(0, 6).toString('ascii'), 'GIF89a')
  assert.equal(gif.readUInt16LE(6), 256)
  assert.equal(gif.readUInt16LE(8), 256)
  assert.ok(gif.includes(Buffer.from('NETSCAPE2.0')), 'GIF must loop')
  assert.ok(info.size < 1_000_000, `GIF is ${info.size} bytes`)

  const graphicControls = []
  for (let i = 0; i < gif.length - 7; i += 1) {
    if (gif[i] === 0x21 && gif[i + 1] === 0xf9 && gif[i + 2] === 0x04) {
      graphicControls.push({
        transparent: Boolean(gif[i + 3] & 0x01),
        delayCs: gif.readUInt16LE(i + 4),
      })
    }
  }

  assert.ok(graphicControls.length >= 34, 'GIF must contain at least 34 frames')
  assert.ok(graphicControls.every(frame => frame.transparent), 'every frame must be transparent')

  const durationMs = graphicControls.reduce((sum, frame) => sum + frame.delayCs * 10, 0)
  assert.ok(durationMs >= 2700 && durationMs <= 2900, `duration is ${durationMs}ms`)
})

test('golden mascot PNG is a transparent 256px fallback', async () => {
  const png = await readFile(pngUrl)
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
  assert.equal(png.readUInt32BE(16), 256)
  assert.equal(png.readUInt32BE(20), 256)
  assert.equal(png[25], 6, 'PNG color type must be RGBA')
})
