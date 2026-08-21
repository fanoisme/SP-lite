# Golden Retriever Logo Revamp

**Date:** 2026-08-21
**Status:** Approved for implementation planning

## Goal

Replace SP-lite's current letter mark with an ownable golden retriever mascot
that feels physically crafted and naturally animated rather than like a glossy
AI-generated 3D object.

## Brand idea

The mascot is a young golden retriever helper: warm, fast, dependable, and
approachable. It represents a practical assistant that is ready to handle
small jobs without making the product feel childish.

The dog replaces the `S` as the primary mark. `SP-lite` remains the wordmark
beside it where space allows.

## Visual design

- Head-and-shoulders golden retriever at a three-quarter angle.
- Recognizable retriever proportions: broad soft muzzle, dark nose, warm eyes,
  and naturally folded ears.
- Realistic golden fur with controlled detail and a clean silhouette that
  remains readable between 28 px and 96 px.
- Handcrafted stop-motion miniature appearance, as if a carefully made puppet
  were photographed under soft studio lighting.
- Matte amber utility collar with three restrained details representing QR,
  documents, and video without literal feature icons.
- Neutral lighting, natural shadows, and no fantasy glow, neon particles,
  plastic skin, impossible materials, or exaggerated cartoon anatomy.
- Transparent background so the mark works on the existing light surfaces.

## Animation

Create a seamless 2.8-second idle loop:

1. Subtle breathing and fur settling.
2. One ear lifts naturally.
3. The head tilts a few degrees and the dog blinks once.
4. A soft real-world highlight travels briefly across the matte collar.
5. The head and ear return exactly to the opening pose.

Motion must follow physical inertia. Fur, ears, eyelids, and collar move at
different rates; no morphing, rubbery deformation, camera movement, or pulsing
glow is allowed.

## Assets

Store final assets under `src/assets/brand/`:

- `sp-lite-golden.gif` — transparent animated mark, 256 × 256, 12 fps, seamless
  loop, target size below 1 MB.
- `sp-lite-golden.png` — transparent static fallback using the neutral opening
  pose.

The existing `sp-lite-mark.svg` is retired after the new assets are verified.

## Component behavior

`LiLogo.vue` keeps its existing public API:

- `size`
- `animate`
- `compact`
- `showSubtitle`

When `animate` is true and reduced motion is not requested, the component uses
the GIF. Otherwise it uses the PNG. The existing wordmark and subtitle remain.
CSS aura, orbit, glow, and particle effects are removed because the mascot's
physical animation is sufficient.

The mascot must render correctly in:

- App sidebar at `sm`
- Landing header at `sm`
- Login card at `lg` with `compact`

## Accessibility and performance

- The mascot image is decorative inside the labelled SP-lite logo component
  and uses empty alt text.
- `prefers-reduced-motion: reduce` always selects the static PNG.
- Width and height stay fixed during loading to avoid layout shift.
- Both assets are local Vite imports with no external runtime request.
- If the GIF cannot load, the PNG remains visible.

## Verification

- Production build succeeds.
- GIF dimensions, frame count, duration, loop metadata, transparency, and file
  size meet the asset requirements.
- First and final frames are visually continuous.
- Desktop and mobile smoke tests cover landing, login, and sidebar placements.
- Reduced-motion mode displays only the PNG.
- No missing-image icon, text fallback, or external image request appears.

## Acceptance criteria

- The primary mark contains no letter `S`.
- The mascot is recognizably a golden retriever at all shipped sizes.
- The animation looks physically natural and avoids common AI-render artifacts.
- The GIF loops seamlessly and remains below 1 MB.
- Static and reduced-motion fallbacks work.
- Existing `LiLogo` consumers require no API changes.
