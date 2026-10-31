import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { test } from 'node:test'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

test('sp-lite-mark.svg parses as XML with the seven mascot groups', async () => {
  const svg = await readFile(`${ROOT}/src/assets/brand/sp-lite-mark.svg`, 'utf8')
  assert.match(svg, /<svg\b[^>]*viewBox="0 0 96 96"/)
  for (const id of ['m-head', 'm-ear-l', 'm-ear-r', 'm-eye-l', 'm-eye-r', 'm-snout', 'm-chest']) {
    assert.ok(svg.includes(`id="${id}"`), `group ${id} missing`)
  }
  assert.ok(!svg.includes('var(--'), 'mark is fixed-palette art, no css vars')
  assert.ok(!/<animate|animation/.test(svg), 'static mark carries no animation')
})

test('LiMascot animates gently: reduced-motion respect, no strobing', async () => {
  const vue = await readFile(`${ROOT}/src/lib/components/LiMascot.vue`, 'utf8')
  assert.ok(vue.includes('prefers-reduced-motion'), 'reduced motion handling')
  for (const kf of ['mascot-breath', 'mascot-blink', 'mascot-ear', 'mascot-tilt']) {
    assert.ok(vue.includes(kf), `keyframes ${kf}`)
  }
  // every declared animation duration must be >= 600ms (no strobing)
  for (const m of vue.matchAll(/animation:\s*[^;]+;/g)) {
    const durs = [...m[0].matchAll(/(\d+(?:\.\d+)?)ms/g)].map(x => parseFloat(x[1]))
    for (const d of durs) {
      assert.ok(d >= 600 || m[0].includes('var('), `animation too fast (${d}ms): ${m[0]}`)
    }
  }
  // blink cadence randomized between 4 and 6 s
  assert.match(vue, /[456000, 6000]|\b4000\b.*\b6000\b|4000\s*\+\s*Math\.random\(\)\s*\*\s*2000/)
  assert.match(vue, /:aria-hidden="label \? undefined : 'true'"/, 'decorative default')
  assert.match(vue, /:aria-label="label"/, 'label prop becomes accessible name')
})

test('the broken GIF pipeline is fully gone', async () => {
  const brand = await readdir(`${ROOT}/src/assets/brand`)
  assert.ok(!brand.includes('sp-lite-golden.gif'), 'gif deleted')
  assert.ok(!brand.includes('sp-lite-golden.png'), 'png superseded by svg')
  const pkg = await readFile(`${ROOT}/package.json`, 'utf8')
  assert.ok(!pkg.includes('test:logo'), 'logo gif test script dropped')
})
