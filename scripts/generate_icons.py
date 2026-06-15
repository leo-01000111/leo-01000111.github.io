#!/usr/bin/env python3
"""Generate favicon.ico and apple-touch-icon.png for leongorecki.eu."""
import os
from PIL import Image, ImageDraw

REPO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))


def lerp(a, b, t):
    return a + (b - a) * t


def make_icon_image(size, solid_bg=False):
    blue   = (56, 189, 248)
    violet = (167, 139, 250)

    # Diagonal (top-left → bottom-right) gradient as raw RGBA bytes
    s1 = max(1, size - 1)
    raw = bytearray(size * size * 4)
    idx = 0
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * s1)
            raw[idx]     = round(lerp(blue[0], violet[0], t))
            raw[idx + 1] = round(lerp(blue[1], violet[1], t))
            raw[idx + 2] = round(lerp(blue[2], violet[2], t))
            raw[idx + 3] = 255
            idx += 4
    gradient = Image.frombuffer("RGBA", (size, size), bytes(raw), "raw", "RGBA", 0, 1)

    # Rounded-rect mask (scaled from 64 px original: pad=6, rx=16)
    pad = max(1, round(6 * size / 64))
    rx  = max(2, round(16 * size / 64))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [pad, pad, size - pad - 1, size - pad - 1], radius=rx, fill=255
    )

    # Base canvas
    bg_color = (7, 10, 14, 255) if solid_bg else (0, 0, 0, 0)
    img = Image.new("RGBA", (size, size), bg_color)

    # Paste gradient through mask
    grad_masked = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    grad_masked.paste(gradient)
    grad_masked.putalpha(mask)
    img.alpha_composite(grad_masked)

    # White semi-transparent circle (cx=26, cy=24, r=6 in 64 px space)
    cx = round(26 * size / 64)
    cy = round(24 * size / 64)
    r  = max(1, round(6 * size / 64))
    circle = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(circle).ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255, 140))
    img.alpha_composite(circle)

    return img


def main():
    # apple-touch-icon.png — 180×180, solid dark background (iOS best practice)
    atl = make_icon_image(180, solid_bg=True).convert("RGB")
    atl_path = os.path.join(REPO, "apple-touch-icon.png")
    atl.save(atl_path, "PNG")
    print(f"Wrote {atl_path}")

    # favicon.ico — 16, 32, 48 px with transparency
    img16 = make_icon_image(16)
    img32 = make_icon_image(32)
    img48 = make_icon_image(48)
    ico_path = os.path.join(REPO, "favicon.ico")
    img16.save(ico_path, format="ICO", append_images=[img32, img48])
    print(f"Wrote {ico_path}")


if __name__ == "__main__":
    main()
