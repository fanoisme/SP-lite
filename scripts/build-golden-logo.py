#!/usr/bin/env python3
"""Build SP-lite's transparent golden retriever logo assets."""

import argparse
import colorsys
import math
from pathlib import Path

from PIL import Image, ImageFilter


SIZE = 256
FRAME_DURATION_MS = 80
OUTPUT_DIR = Path("src/assets/brand")
TRANSPARENT_INDEX = 255
PALETTE_COLORS = 64


def remove_blue_chroma(image):
    """Turn the generated blue screen into a softly feathered alpha channel."""
    rgba = image.convert("RGBA")
    pixels = rgba.load()

    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, _ = pixels[x, y]
            hue, saturation, value = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)

            is_blue_hue = 0.52 <= hue <= 0.75
            blue_dominance = b - max(r, g)
            blue_score = max(0, blue_dominance - 18) if is_blue_hue and saturation > 0.28 else 0
            alpha = 0 if blue_score >= 85 else max(0, min(255, round(255 - blue_score * 3)))

            if alpha < 240:
                # Bleed a warm fur-adjacent matte into soft edges instead of
                # preserving cyan chroma that would halo on a light surface.
                r = max(r, min(255, round(g * 1.25)))
                b = min(b, round(g * 0.55))

            pixels[x, y] = (r, g, b, alpha)

    alpha = rgba.getchannel("A").filter(ImageFilter.GaussianBlur(0.55))
    alpha = alpha.point(lambda value: 0 if value < 40 else value)
    rgba.putalpha(alpha)
    return rgba


def fit_frame(image):
    """Crop the puppet and place it consistently inside a 256px transparent box."""
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    cropped = image.crop(bbox) if bbox else image
    cropped.thumbnail((238, 246), Image.Resampling.LANCZOS)

    frame = Image.new("RGBA", (SIZE, SIZE))
    x = (SIZE - cropped.width) // 2
    y = SIZE - cropped.height - 3
    frame.alpha_composite(cropped, (x, y))
    return frame


def transition_frames(current, following):
    """Interpolate between photographed poses without moving the camera."""
    return [
        current,
        Image.blend(current, following, 1 / 3),
        Image.blend(current, following, 2 / 3),
    ]


def common_palette(frames):
    """Build one restrained palette to prevent per-frame color flicker."""
    strip = Image.new("RGB", (SIZE * len(frames), SIZE), (0, 0, 0))
    for index, frame in enumerate(frames):
        rgb = frame.convert("RGB")
        hidden = frame.getchannel("A").point(lambda alpha: 255 if alpha < 96 else 0)
        rgb.paste((0, 0, 0), mask=hidden)
        strip.paste(rgb, (index * SIZE, 0))
    return strip.quantize(colors=PALETTE_COLORS, method=Image.Quantize.MEDIANCUT)


def palette_frame(frame, palette):
    """Quantize with a shared palette and reserve index 255 for transparency."""
    rgb = frame.convert("RGB")
    hidden = frame.getchannel("A").point(lambda alpha: 255 if alpha < 96 else 0)
    rgb.paste((0, 0, 0), mask=hidden)
    quantized = rgb.quantize(palette=palette, dither=Image.Dither.FLOYDSTEINBERG)
    quantized.putpalette(palette.getpalette())

    alpha = frame.getchannel("A")
    color_data = list(quantized.getdata())
    alpha_data = list(alpha.getdata())
    quantized.putdata([
        TRANSPARENT_INDEX if a < 96 else color
        for color, a in zip(color_data, alpha_data)
    ])
    quantized.info["transparency"] = TRANSPARENT_INDEX
    quantized.info["disposal"] = 2
    return quantized


def build(source):
    sheet = Image.open(source).convert("RGB")
    cell_width = sheet.width // 4
    cell_height = sheet.height // 3

    keyframes = []
    for row in range(3):
        for column in range(4):
            left = column * cell_width
            top = row * cell_height
            right = sheet.width if column == 3 else (column + 1) * cell_width
            bottom = sheet.height if row == 2 else (row + 1) * cell_height
            cell = sheet.crop((left, top, right, bottom))
            keyframes.append(fit_frame(remove_blue_chroma(cell)))

    # Guarantee the loop closes on the exact opening pose.
    keyframes[-1] = keyframes[0].copy()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    keyframes[0].save(OUTPUT_DIR / "sp-lite-golden.png", optimize=True)

    frames = []
    for index in range(len(keyframes) - 1):
        frames.extend(transition_frames(keyframes[index], keyframes[index + 1]))
    # The final displayed frame and the wrapped opening frame are byte-identical.
    frames.append(keyframes[0].copy())

    palette = common_palette(frames)
    gif_frames = [palette_frame(frame, palette) for frame in frames]
    gif_frames[0].save(
        OUTPUT_DIR / "sp-lite-golden.gif",
        save_all=True,
        append_images=gif_frames[1:],
        duration=FRAME_DURATION_MS,
        loop=0,
        disposal=2,
        transparency=TRANSPARENT_INDEX,
        optimize=False,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    args = parser.parse_args()
    build(args.source)
