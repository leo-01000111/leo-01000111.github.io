#!/usr/bin/env python3
"""Render static ProjectCard markup from projects/projects.json.

Writes ProjectCard HTML between the `<!-- projects:start -->` /
`<!-- projects:end -->` markers in:
  - index.html            (top 3 by featuredOrder, EN)
  - fr/index.html         (top 3 by featuredOrder, FR)
  - projects/index.html   (all projects, EN)
  - fr/projects/index.html (all projects, FR)

Card markup follows design/holding-point/components.md ("ProjectCard").
Run with no arguments: `python3 scripts/build_projects.py`.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROJECTS_JSON = ROOT / "projects" / "projects.json"

START = "<!-- projects:start -->"
END = "<!-- projects:end -->"

ARROW = (
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
    '<g transform="rotate({deg} 12 12)" fill="none" stroke="currentColor" '
    'stroke-width="3.4" stroke-linecap="square" stroke-linejoin="miter">'
    '<path d="M3.5 12H18.5"></path><path d="M12 5.2L18.8 12L12 18.8"></path>'
    "</g></svg>"
)
GO_ARROW = ARROW.format(deg=0)

OPEN_LABEL = {"en": "Open", "fr": "Ouvrir"}


def esc(s):
    return (
        (s or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def project_href(p, lang):
    slug = p.get("slug") or f"project{p.get('id', '')}"
    base = "/fr/projects/" if lang == "fr" else "/projects/"
    return f"{base}{slug}.html"


def render_card(p, index, lang, tone=None):
    """tone: None (default signal), 'plain', or 'hold'."""
    title = (p.get("title") or {}).get(lang) or (p.get("title") or {}).get("en") or ""
    desc = (p.get("description") or {}).get(lang) or (p.get("description") or {}).get("en") or ""
    tags = p.get("tags") or []
    code = p.get("code") or ""
    meta = p.get("meta") or []
    href = project_href(p, lang)
    idx_str = f"{index:02d}"

    classes = "hp-card"
    if tone == "hold":
        classes += " hp-card--hold"
    elif tone == "plain":
        classes += " hp-card--plain"

    kicker_html = ""
    if meta:
        spans = "".join(f"<span>{esc(str(m))}</span>" for m in meta)
        kicker_html = f'<div class="hp-card__kicker">{spans}</div>'

    tags_html = "".join(f"<li><span class=\"hp-tag\">{esc(t)}</span></li>" for t in tags[:4])

    return (
        f'<a class="{classes}" href="{href}">'
        f'<div class="hp-card__index" aria-hidden="true">'
        f'<em>{esc(code)}</em><span>{idx_str}</span></div>'
        f'<div class="hp-card__body">{kicker_html}'
        f'<h3 class="hp-card__title">{esc(title)}</h3>'
        f'<p class="hp-card__summary">{esc(desc)}</p>'
        f'<div class="hp-card__foot">'
        f'<ul class="hp-tags" aria-label="Stack">{tags_html}</ul>'
        f'<span class="hp-card__go" aria-hidden="true">{GO_ARROW}</span>'
        f"</div></div></a>"
    )


def order_all(projects):
    """Flagship first, then the rest in projects.json order."""
    flagship = [p for p in projects if p.get("flagship")]
    rest = [p for p in projects if not p.get("flagship")]
    return flagship + rest


def order_featured(projects, limit=3):
    featured = [p for p in projects if p.get("featuredOrder") is not None]
    featured.sort(key=lambda p: p["featuredOrder"])
    ordered = order_all(featured) if any(p.get("flagship") for p in featured) else featured
    # Ensure flagship (if featured) leads, keep remaining featuredOrder order otherwise.
    if not any(p.get("flagship") for p in featured):
        ordered = featured
    else:
        flagship = [p for p in featured if p.get("flagship")]
        rest = sorted(
            [p for p in featured if not p.get("flagship")], key=lambda p: p["featuredOrder"]
        )
        ordered = flagship + rest
    return ordered[:limit]


def render_list(projects, lang, alternate_plain=False):
    out = []
    for i, p in enumerate(projects, start=1):
        tone = None
        if p.get("flagship"):
            tone = "hold"
        elif alternate_plain and (i % 2 == 0):
            tone = "plain"
        out.append(render_card(p, i, lang, tone))
    return "\n".join(out)


def inject(path: Path, html: str):
    text = path.read_text(encoding="utf-8")
    if START not in text or END not in text:
        raise SystemExit(f"{path}: missing {START}/{END} markers")
    pattern = re.compile(re.escape(START) + r".*?" + re.escape(END), re.DOTALL)
    replacement = f"{START}\n{html}\n{END}"
    new_text = pattern.sub(lambda _: replacement, text, count=1)
    path.write_text(new_text, encoding="utf-8")
    print(f"wrote {path.relative_to(ROOT)}")


def main():
    projects = json.loads(PROJECTS_JSON.read_text(encoding="utf-8"))

    featured = order_featured(projects, limit=3)
    all_ordered = order_all(projects)

    inject(ROOT / "index.html", render_list(featured, "en"))
    inject(ROOT / "fr" / "index.html", render_list(featured, "fr"))
    inject(ROOT / "projects" / "index.html", render_list(all_ordered, "en", alternate_plain=True))
    inject(
        ROOT / "fr" / "projects" / "index.html",
        render_list(all_ordered, "fr", alternate_plain=True),
    )


if __name__ == "__main__":
    main()
