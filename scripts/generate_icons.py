#!/usr/bin/env python3
"""Generate favicon.ico and apple-touch-icon.png from assets/favicon.svg
(a copy of design/holding-point/lg-mark.svg: a Holding Point location plate
carrying a constructed "LG" — plate #121314 ground, signal #f5c518 inset
border and letters).

Renders the SVG at each needed pixel size with a headless Chromium (via
Playwright's bundled browser) for correct anti-aliasing, then assembles the
multi-resolution favicon.ico with Pillow. No network access and no
`playwright install` are required: this repo's dev environment already has
a Chromium binary at CHROMIUM_PATH below; adjust it if run elsewhere.

Usage: python3 scripts/generate_icons.py
"""
import base64
import os
import subprocess
import sys
import tempfile

REPO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
SVG_PATH = os.path.join(REPO, "assets", "favicon.svg")
CHROMIUM_PATH = os.environ.get(
    "CHROMIUM_PATH", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
)


# This sandbox's headless Chromium reserves a fixed ~88px of window height
# that never paints page content (a phantom title bar even in
# `--headless=new`), confirmed empirically: a `--window-size W,H` request
# only paints the top `H - 88` rows. Request `size + CHROME_Y_OFFSET` and
# crop the top `size` rows back out so the rendered PNG is pixel-exact.
CHROME_Y_OFFSET = 88


def render_png(svg_path, size, out_path):
    """Rasterize an SVG to a square PNG of `size` px using headless Chromium."""
    from PIL import Image

    svg_data = open(svg_path, "rb").read()
    b64 = base64.b64encode(svg_data).decode("ascii")
    html = f"""<!doctype html><html><head><meta charset="utf-8">
<style>html,body{{margin:0;padding:0;background:transparent;}}
img{{display:block;width:{size}px;height:{size}px;}}</style></head>
<body><img src="data:image/svg+xml;base64,{b64}"></body></html>"""
    with tempfile.TemporaryDirectory() as tmp:
        html_path = os.path.join(tmp, "icon.html")
        raw_path = os.path.join(tmp, "raw.png")
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html)
        subprocess.run(
            [
                CHROMIUM_PATH,
                "--headless=new",
                "--disable-gpu",
                "--no-sandbox",
                "--hide-scrollbars",
                "--force-color-profile=srgb",
                "--default-background-color=00000000",
                f"--window-size={size},{size + CHROME_Y_OFFSET}",
                f"--screenshot={raw_path}",
                html_path,
            ],
            check=True,
            capture_output=True,
        )
        Image.open(raw_path).crop((0, 0, size, size)).save(out_path)


def main():
    from PIL import Image

    if not os.path.exists(SVG_PATH):
        sys.exit(f"missing {SVG_PATH}")

    with tempfile.TemporaryDirectory() as tmp:
        sizes = [16, 32, 48, 180]
        pngs = {}
        for size in sizes:
            out = os.path.join(tmp, f"icon-{size}.png")
            render_png(SVG_PATH, size, out)
            pngs[size] = Image.open(out).convert("RGBA")

        # apple-touch-icon.png — 180x180, solid plate background (iOS best
        # practice: no transparency), cropped square to the rendered size.
        atl = pngs[180].crop((0, 0, 180, 180)).convert("RGB")
        atl_path = os.path.join(REPO, "apple-touch-icon.png")
        atl.save(atl_path, "PNG")
        print(f"Wrote {atl_path}")

        # favicon.ico — Pillow's ICO writer takes one base image and a list
        # of sizes, resizing internally for each; feed it the largest render
        # (48px, cropped square) so 32/16 are downscaled from a crisp source.
        base = pngs[48].crop((0, 0, 48, 48))
        ico_path = os.path.join(REPO, "favicon.ico")
        base.save(ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
        print(f"Wrote {ico_path}")


if __name__ == "__main__":
    main()
