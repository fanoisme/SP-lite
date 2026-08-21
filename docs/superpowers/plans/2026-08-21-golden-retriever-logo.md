# Golden Retriever Logo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace SP-lite's letter mark with a physically believable golden retriever mascot and a seamless local animated GIF.

**Architecture:** Generate one fixed-camera stop-motion contact sheet containing the complete mascot loop, then crop and process it with a deterministic Pillow script into transparent 256 px PNG/GIF assets. `LiLogo` selects the GIF only when animation is enabled and motion is allowed, while preserving the current component API and using the PNG on errors or reduced-motion devices.

**Tech Stack:** Vue 3, Vite 6, Python 3 with Pillow 11.3, Node.js 20 built-in tests

## Global Constraints

- The primary mark contains no letter `S`.
- The mascot is a young golden retriever helper with realistic retriever anatomy.
- Visual treatment is handcrafted stop-motion miniature photography, not glossy fantasy 3D.
- Motion follows physical inertia and contains no camera movement, rubber morphing, pulsing glow, or particle effects.
- Final GIF is transparent, 256 × 256, approximately 2.8 seconds, 12 fps, seamless, and below 1 MB.
- Static PNG is transparent and uses the neutral opening pose.
- `LiLogo` keeps the existing `size`, `animate`, `compact`, and `showSubtitle` API.
- Reduced-motion and GIF-load failure use the PNG.
- Assets are local Vite imports with no external runtime request.
- Do not create git commits unless the user explicitly requests them.

---

## File Map

**Create**

- `src/assets/brand/sp-lite-golden.gif` — animated mascot.
- `src/assets/brand/sp-lite-golden.png` — static fallback.
- `scripts/build-golden-logo.py` — deterministic sheet crop, chroma removal, frame interpolation, palette optimization, and GIF assembly.
- `tests/logo-assets.test.mjs` — binary asset contract checks.

**Modify**

- `src/lib/components/LiLogo.vue` — animated/static source selection and simplified physical presentation.
- `package.json` — add `test:logo`.

**Delete**

- `src/assets/brand/sp-lite-mark.svg`

**Temporary input**

- `.superpowers/logo-source/sp-lite-golden-contact-sheet.png` — generated 4 × 3 contact sheet; excluded from product assets.

---

### Task 1: Generate and approve the realistic mascot contact sheet

**Files:**
- Generate: `.superpowers/logo-source/sp-lite-golden-contact-sheet.png`

**Interfaces:**
- Produces: a 4 × 3 fixed-camera grid with 12 square animation keyframes.
- Consumes: the approved mascot and motion specification.

- [ ] **Step 1: Generate the contact sheet**

Generate one 4:3 image with this exact art direction:

```text
Professional stop-motion animation contact sheet, exactly 4 columns by 3 rows,
12 equal square frames with clean edge-to-edge cells and no labels. The same
handcrafted young golden retriever puppet appears in every frame, head and
shoulders, fixed three-quarter camera, fixed crop, fixed lens and fixed soft
studio lighting. Recognizable golden retriever: broad gentle muzzle, dark nose,
warm brown eyes, folded ears, natural golden fur made from finely punched
fibers. Matte amber utility collar with three tiny restrained rectangular
details. Physical miniature photography, subtle handcrafted imperfections,
neutral expression, no cartoon exaggeration, no glossy CGI, no fantasy glow,
no particles, no letter S, no typography.

Use one perfectly uniform saturated blue chroma background (#0057FF), no floor,
no cast shadow, and no blue object details.

Frame sequence:
1 neutral opening pose,
2 subtle inhale,
3 exhale,
4 left ear starts lifting,
5 ear naturally raised,
6 head begins a 4-degree tilt,
7 eyelids half closed,
8 one natural blink closed,
9 eyes reopen while collar catches a soft real highlight,
10 head returning,
11 ear lowering,
12 exact neutral opening pose for seamless looping.
```

- [ ] **Step 2: Review the sheet before processing**

Reject and regenerate if any of these are present:

- dog identity, collar, crop, or camera changes between cells
- extra limbs, teeth, warped eyes, changing fur color, or duplicate facial parts
- letters, words, labels, borders, glow, particles, or non-blue background
- first and twelfth poses that do not match

Expected: one consistent physical puppet with twelve readable loop poses.

---

### Task 2: Build and verify the GIF/PNG assets

**Files:**
- Create: `scripts/build-golden-logo.py`
- Create: `tests/logo-assets.test.mjs`
- Create: `src/assets/brand/sp-lite-golden.gif`
- Create: `src/assets/brand/sp-lite-golden.png`
- Modify: `package.json`

**Interfaces:**
- Consumes: `python scripts/build-golden-logo.py --source <sheet>`
- Produces: 256 × 256 transparent GIF and PNG under `src/assets/brand/`

- [ ] **Step 1: Write the failing binary contract test**

Create `tests/logo-assets.test.mjs` with:

```js
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
```

Add:

```json
{
  "scripts": {
    "test:logo": "node --test tests/logo-assets.test.mjs"
  }
}
```

- [ ] **Step 2: Run the test before assets exist**

Run:

```powershell
npm run test:logo
```

Expected: FAIL with `ENOENT` for `sp-lite-golden.gif`.

- [ ] **Step 3: Implement the Pillow builder**

Create `scripts/build-golden-logo.py` with these responsibilities:

```python
#!/usr/bin/env python3
import argparse
import math
from pathlib import Path
from PIL import Image, ImageChops, ImageEnhance, ImageFilter

SIZE = 256
BG = (0, 87, 255)
FRAME_DURATION_MS = 78
OUTPUT_DIR = Path("src/assets/brand")

def remove_chroma(image):
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, _ = pixels[x, y]
            distance = math.sqrt((r - BG[0]) ** 2 + (g - BG[1]) ** 2 + (b - BG[2]) ** 2)
            alpha = max(0, min(255, round((distance - 35) * 255 / 70)))
            if alpha < 255:
                # Remove blue spill from semitransparent fur edges.
                b = max(0, round(b - (255 - alpha) * 0.75))
            pixels[x, y] = (r, g, b, alpha)
    return rgba

def fit_frame(image):
    bbox = image.getbbox()
    cropped = image.crop(bbox) if bbox else image
    cropped.thumbnail((224, 224), Image.Resampling.LANCZOS)
    frame = Image.new("RGBA", (SIZE, SIZE))
    frame.alpha_composite(cropped, ((SIZE - cropped.width) // 2, (SIZE - cropped.height) // 2))
    return frame

def tween(current, following, step):
    # Stop-motion stays pose-based; only camera-stable subpixel settling is added.
    fraction = step / 3
    dx = round(fraction)
    dy = round(math.sin(fraction * math.pi))
    settled = Image.new("RGBA", current.size)
    settled.alpha_composite(current, (dx, -dy))
    return Image.blend(settled, following, fraction * 0.08)

def build(source):
    sheet = Image.open(source).convert("RGB")
    cell_w, cell_h = sheet.width // 4, sheet.height // 3
    keyframes = []
    for row in range(3):
        for col in range(4):
            cell = sheet.crop((col * cell_w, row * cell_h, (col + 1) * cell_w, (row + 1) * cell_h))
            keyframes.append(fit_frame(remove_chroma(cell)))

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    keyframes[0].save(OUTPUT_DIR / "sp-lite-golden.png", optimize=True)

    frames = []
    for index, current in enumerate(keyframes):
        following = keyframes[(index + 1) % len(keyframes)]
        frames.extend([current, tween(current, following, 1), tween(current, following, 2)])

    frames[0].save(
        OUTPUT_DIR / "sp-lite-golden.gif",
        save_all=True,
        append_images=frames[1:],
        duration=FRAME_DURATION_MS,
        loop=0,
        disposal=2,
        transparency=0,
        optimize=True,
    )

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    args = parser.parse_args()
    build(Path(args.source))
```

- [ ] **Step 4: Generate the final assets**

Run:

```powershell
python scripts/build-golden-logo.py --source ".superpowers/logo-source/sp-lite-golden-contact-sheet.png"
```

Expected: both final assets are written under `src/assets/brand/`.

- [ ] **Step 5: Verify and tune without changing the contract**

Run:

```powershell
npm run test:logo
```

Expected: 2/2 tests pass. If size exceeds 1 MB, reduce the GIF palette in the
builder before changing dimensions, duration, or frame count.

---

### Task 3: Integrate the mascot into `LiLogo`

**Files:**
- Modify: `src/lib/components/LiLogo.vue`
- Delete: `src/assets/brand/sp-lite-mark.svg`

**Interfaces:**
- Consumes: `sp-lite-golden.gif`, `sp-lite-golden.png`
- Preserves: `size`, `animate`, `compact`, `showSubtitle`

- [ ] **Step 1: Replace logo imports and add failure state**

Use:

```js
import { computed, ref } from 'vue'
import logoAnimated from '../../assets/brand/sp-lite-golden.gif'
import logoStatic from '../../assets/brand/sp-lite-golden.png'

const gifFailed = ref(false)
```

Remove `particleStyle()`.

- [ ] **Step 2: Replace the mark template**

Use:

```vue
<div class="li-logo__mark">
  <picture v-if="animate && !gifFailed" class="li-logo__picture">
    <source media="(prefers-reduced-motion: reduce)" :srcset="logoStatic" />
    <img
      class="li-logo__image"
      :src="logoAnimated"
      alt=""
      aria-hidden="true"
      @error="gifFailed = true"
    />
  </picture>
  <img
    v-else
    class="li-logo__image"
    :src="logoStatic"
    alt=""
    aria-hidden="true"
  />
</div>
```

Keep the existing wordmark/subtitle template unchanged.

- [ ] **Step 3: Simplify mark CSS**

Remove aura, glow, orbit, particle, and their keyframes. Keep:

```css
.li-logo__picture { display: contents; }
.li-logo__image {
  position: relative;
  z-index: 2;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 4px 8px rgba(88, 49, 8, 0.18));
}
.li-logo--animate .li-logo__mark {
  animation: logo-mark-enter 500ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
.li-logo:hover .li-logo__mark {
  transform: translateY(-1px);
}
```

Retain fixed mark dimensions, text entrance, and reduced-motion transition
disable. Remove old size-specific SVG border-radius rules.

- [ ] **Step 4: Delete the retired SVG**

Delete:

```text
src/assets/brand/sp-lite-mark.svg
```

- [ ] **Step 5: Run complete verification**

Run:

```powershell
npm run test:logo
npm run test:icons
npm run check:icons
npm run build
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 6: Browser smoke test**

Check landing, login, and authenticated sidebar placements at desktop and
mobile sizes. Repeat with reduced-motion emulation.

Expected:

- mascot remains recognizable at `sm` and `lg`
- GIF moves only when animation is enabled and motion is allowed
- PNG appears in reduced-motion mode
- no layout shift, broken-image indicator, or external image request
