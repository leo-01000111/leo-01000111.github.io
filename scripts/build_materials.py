#!/usr/bin/env python3
"""Render the "Materiały" (Lesson Material) panels from korepetycje/materials.json.

Writes static, bilingual HTML between the `<!-- MATERIALS:START -->` /
`<!-- MATERIALS:END -->` markers in korepetycje/index.html. Everything is in the
HTML (no JS needed to read it); the inline script on the page only adds the
tabs, search and level filter on top.

Data file shape (korepetycje/materials.json):

    {"subjects": [{
        "id": "fizyka", "title_pl": "Fizyka", "title_en": "Physics",
        "sections": [{
            "kind": "start" | "topic" | "tools" | "uni",
            "title_pl": "...", "title_en": "...",
            "levels": ["PP", "PR", "Studia"],
            "links": [{"label": "Site →", "url": "https://...",
                       "type": "teoria|zadania|wideo|symulacja|egzaminy|
                                narzedzie|kurs|referencja",
                       "label_en": "optional English label",
                       "partly_paid": true}]
        }]
    }]}

Each section renders as one card. Per subject panel the order is: "Zacznij
tutaj / Start here" strip (kind start), the topic grid (topic), "Narzędzia /
Tools" (tools), "Na studia / University" (uni). Within a card, links are
grouped by type in the fixed order of TYPES below. Section order in the file is
the display order inside each block.

Run with no arguments: `python3 scripts/build_materials.py`. Idempotent.
"""
import json
import re
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "korepetycje" / "materials.json"
PAGE = ROOT / "korepetycje" / "index.html"

START = "<!-- MATERIALS:START -->"
END = "<!-- MATERIALS:END -->"
LF = chr(10)
CRLF = chr(13) + chr(10)

# type -> (PL label, EN label); dict order is the display order inside a card.
TYPES = {
    "teoria": ("Teoria", "Theory"),
    "zadania": ("Zadania", "Tasks"),
    "egzaminy": ("Egzaminy", "Exams"),
    "wideo": ("Wideo", "Video"),
    "kurs": ("Kurs", "Course"),
    "symulacja": ("Symulacja", "Simulation"),
    "narzedzie": ("Narzędzie", "Tool"),
    "referencja": ("Referencja", "Reference"),
}

# kind -> (PL heading, EN heading). "topic" has no visible heading.
BLOCKS = [
    ("start", "Zacznij tutaj", "Start here"),
    ("topic", "Tematy", "Topics"),
    ("tools", "Narzędzia", "Tools"),
    ("uni", "Na studia", "University"),
]
LEVELS = ["PP", "PR", "Studia"]

PAID = (
    '<span class="mat-paid"><span data-pl>częściowo płatne</span>'
    '<span data-en>partly paid</span></span>'
)


def e(s):
    return escape(s, quote=True)


def bi(pl, en, tag="span", cls=""):
    c = f' class="{cls}"' if cls else ""
    if pl == en:
        # still emit both so the lang toggle hides/shows consistently
        pass
    return f"<{tag}{c} data-pl>{e(pl)}</{tag}><{tag}{c} data-en>{e(en)}</{tag}>"


def render_link(link):
    pl = link["label"]
    en = link.get("label_en", pl)
    text = f"<span data-pl>{e(pl)}</span><span data-en>{e(en)}</span>" if pl != en else e(pl)
    paid = PAID if link.get("partly_paid") else ""
    paid = (" " + paid) if paid else ""
    return (
        f'<a class="topic-btn" href="{e(link["url"])}" target="_blank" '
        f'rel="noopener">{text}{paid}</a>'
    )


def render_card(subject, sec, cls=""):
    levels = sec["levels"]
    groups = []
    for t, (tpl, ten) in TYPES.items():
        links = [l for l in sec["links"] if l["type"] == t]
        if not links:
            continue
        btns = "\n".join("          " + render_link(l) for l in links)
        groups.append(
            '        <div class="mat-group">'
            f'<span class="mat-type"><span data-pl>{tpl}</span><span data-en>{ten}</span></span>\n'
            f'        <div class="topic-btn-row">\n{btns}\n        </div></div>'
        )
    lv = "".join(f"<span>{e(x)}</span>" for x in levels)
    classes = ("topic-chip " + cls).strip()
    return (
        f'      <div class="{classes}" data-levels="{e(" ".join(levels))}">\n'
        f'        <div class="mat-subj">{bi(subject["title_pl"], subject["title_en"])}</div>\n'
        f'        {bi(sec["title_pl"], sec["title_en"], cls="tn")}\n'
        f'        <div class="mat-lv" aria-label="Poziom / Level">{lv}</div>\n'
        + "\n".join(groups)
        + "\n      </div>"
    )


def render_panel(subject):
    secs = subject["sections"]
    parts = []
    for kind, hpl, hen in BLOCKS:
        block = [s for s in secs if s["kind"] == kind]
        if not block:
            continue
        cards = []
        for i, s in enumerate(block):
            cls = ""
            if kind == "start":
                cls = "prio-1" if i == 0 else "prio-2"
            cards.append(render_card(subject, s, cls))
        head = ""
        if kind != "topic" or len(block) > 0:
            head = f'    <h3 class="mat-h">{bi(hpl, hen)}</h3>\n'
        grid_cls = "topic-grid mat-start-grid" if kind == "start" else "topic-grid"
        parts.append(
            f'  <div class="mat-block mat-{kind}">\n{head}'
            f'    <div class="{grid_cls}">\n' + "\n".join(cards) + "\n    </div>\n  </div>"
        )
    empty = (
        '  <p class="mat-empty" hidden>'
        '<span data-pl>Brak materiałów dla tego poziomu.</span>'
        '<span data-en>No material for this level.</span></p>'
    )
    return (
        f'<div class="subject-panel" id="panel-{subject["id"]}" role="tabpanel" '
        f'data-subject="{subject["id"]}">\n' + "\n".join(parts) + "\n" + empty + "\n</div>"
    )


def validate(data):
    ids = set()
    for s in data["subjects"]:
        if s["id"] in ids:
            raise SystemExit(f"duplicate subject id {s['id']}")
        ids.add(s["id"])
        for sec in s["sections"]:
            where = f'{s["id"]} / {sec.get("title_pl")}'
            if sec["kind"] not in {k for k, _, _ in BLOCKS}:
                raise SystemExit(f"{where}: bad kind {sec['kind']!r}")
            if not sec["levels"] or any(x not in LEVELS for x in sec["levels"]):
                raise SystemExit(f"{where}: bad levels {sec['levels']!r}")
            if not sec["links"]:
                raise SystemExit(f"{where}: no links")
            for l in sec["links"]:
                if l["type"] not in TYPES:
                    raise SystemExit(f"{where}: bad type {l['type']!r} on {l['label']}")
                if not l["url"].startswith(("http://", "https://")):
                    raise SystemExit(f"{where}: bad url {l['url']!r}")


def main():
    data = json.loads(DATA.read_text(encoding="utf-8"))
    validate(data)
    html = "\n\n".join(render_panel(s) for s in data["subjects"])

    # Keep the page's own line endings (korepetycje/index.html is CRLF).
    with open(PAGE, encoding="utf-8", newline="") as f:
        raw = f.read()
    crlf = CRLF in raw
    text = raw.replace(CRLF, LF)
    if START not in text or END not in text:
        raise SystemExit(f"{PAGE}: missing {START}/{END} markers")
    pattern = re.compile(re.escape(START) + r".*?" + re.escape(END), re.DOTALL)
    replacement = f"{START}\n{html}\n{END}"
    new_text = pattern.sub(lambda _: replacement, text, count=1)
    if new_text != text:
        if crlf:
            new_text = new_text.replace(LF, CRLF)
        with open(PAGE, "w", encoding="utf-8", newline="") as f:
            f.write(new_text)
    n = sum(len(sec["links"]) for s in data["subjects"] for sec in s["sections"])
    print(f"wrote {PAGE.relative_to(ROOT)} ({n} links)")


if __name__ == "__main__":
    main()
