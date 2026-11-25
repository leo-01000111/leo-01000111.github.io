#!/usr/bin/env python3
"""Build the "Karty pracy" (worksheets) pages from korepetycje/karty/sheets/*.json.

For every sheet <id>.json this writes korepetycje/karty/<id>/index.html: a small
static page with the title/description baked in (so a link sent to a student
has a proper preview) and the sheet data inlined as JSON. The shared engine
korepetycje/karty/karty.js renders it and checks the answers.

It also renders the sheet menu between `<!-- KARTY:START -->` /
`<!-- KARTY:END -->` in korepetycje/index.html, and writes
korepetycje/karty/index.html (redirect to that menu).

Sheet format: see korepetycje/karty/README.md.

Run with no arguments: `python3 scripts/build_karty.py`. Idempotent. If Node is
installed it then runs scripts/check_karty.js, which tests every answer key
against the real checker.
"""
import json
import re
import shutil
import subprocess
import sys
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KDIR = ROOT / "korepetycje" / "karty"
SHEETS = KDIR / "sheets"
PAGE = ROOT / "korepetycje" / "index.html"
SITE = "https://www.leongorecki.eu"

START = "<!-- KARTY:START -->"
END = "<!-- KARTY:END -->"
LF = chr(10)
CRLF = chr(13) + chr(10)

# track id -> (PL tab label, EN tab label, PL short label for the sheet header)
TRACKS = {
    "e8": ("Matematyka · Egzamin ósmoklasisty", "Maths · Grade 8 exam", "Matematyka · Klasa 8"),
    "matura": ("Matematyka · Matura", "Maths · Matura", "Matematyka · Matura"),
    "fizyka": ("Fizyka", "Physics", "Fizyka"),
}
LEVELS = {"PP", "PR"}
TYPES = {"num", "expr", "pow", "sci", "choice", "order", "self"}

KATEX = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist"

BEACON = (
    '<script>\n'
    '(function(){var l=location;if(l.hostname==="localhost"||l.hostname==="127.0.0.1")return;\n'
    'var u="https://stats.leongorecki.eu/e",o={p:l.pathname,r:document.referrer,h:l.hostname};'
    'if(/(?:^|; )lg_me=1/.test(document.cookie))o.m=1;var b=JSON.stringify(o);\n'
    'try{if(navigator.sendBeacon&&navigator.sendBeacon(u,new Blob([b],{type:"text/plain"})))return}catch(e){}\n'
    'try{fetch(u,{method:"POST",body:b,keepalive:true,mode:"cors",headers:{"content-type":"text/plain"}})}catch(e){}})();\n'
    '</script>'
)


def e(s):
    return escape(str(s), quote=True)


def fail(msg):
    raise SystemExit(f"build_karty: {msg}")


def validate(sheet, path):
    w = path.name
    for k in ("id", "track", "title", "description", "tasks"):
        if k not in sheet:
            fail(f"{w}: missing {k!r}")
    if sheet["id"] != path.stem:
        fail(f"{w}: id {sheet['id']!r} must match the file name")
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", sheet["id"]):
        fail(f"{w}: id must be lowercase-with-dashes")
    if sheet["track"] not in TRACKS:
        fail(f"{w}: track must be one of {sorted(TRACKS)}")
    for lv in sheet.get("levels", []):
        if lv not in LEVELS:
            fail(f"{w}: bad level {lv!r}")
    if not sheet["tasks"]:
        fail(f"{w}: no tasks")
    for ti, t in enumerate(sheet["tasks"], 1):
        if not t.get("parts"):
            fail(f"{w}: task {ti} has no parts")
        for pi, p in enumerate(t["parts"]):
            where = f"{w}: task {ti}{'abcdefghijklmnopqrstuvwxyz'[pi]})"
            ans = p.get("answers")
            if not ans:
                fail(f"{where}: no answers (use type 'self' for show-the-solution parts)")
            for a in ans:
                ty = a.get("type")
                if ty not in TYPES:
                    fail(f"{where}: bad answer type {ty!r}")
                if ty != "self" and "key" not in a:
                    fail(f"{where}: {ty} answer without key")
                if ty == "choice":
                    if not isinstance(a.get("options"), list) or not isinstance(a["key"], int) \
                            or not 0 <= a["key"] < len(a["options"]):
                        fail(f"{where}: choice needs options and an index key")
                if ty == "order":
                    items = a.get("items")
                    if not isinstance(items, list) or sorted(a["key"]) != list(range(len(items))):
                        fail(f"{where}: order key must be a permutation of item indices")
                if ty == "self" and not p.get("solution"):
                    fail(f"{where}: self answer needs a solution")


def load():
    sheets = []
    for path in sorted(SHEETS.glob("*.json")):
        s = json.loads(path.read_text(encoding="utf-8"))
        validate(s, path)
        sheets.append(s)
    return sheets


def plural(n, one, few, many):
    t, h = n % 10, n % 100
    return f"{n} " + (one if n == 1 else few if 2 <= t <= 4 and not 12 <= h <= 14 else many)


def counts(s):
    return len(s["tasks"]), sum(len(t["parts"]) for t in s["tasks"])


def sheet_url(s):
    return f"{SITE}/korepetycje/karty/{s['id']}/"


def render_sheet(s):
    short = TRACKS[s["track"]][2]
    data = json.dumps(s, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    url = sheet_url(s)
    title = f"{s['title']} · Karta pracy · Leon Górecki"
    return f"""<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>{e(title)}</title>
<meta name="description" content="{e(s['description'])}"/>
<meta name="theme-color" content="#faf7f4"/>
<link rel="icon" href="/favicon.ico" sizes="any"/>
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"/>
<link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
<link rel="canonical" href="{url}"/>
<meta property="og:type" content="website"/>
<meta property="og:title" content="{e(s['title'])} · Karta pracy"/>
<meta property="og:description" content="{e(s['description'])}"/>
<meta property="og:url" content="{url}"/>
<link rel="preload" href="/assets/fonts/ibm-plex-sans-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin/>
<link rel="preload" href="/assets/fonts/ibm-plex-mono-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin/>
<link rel="stylesheet" href="/korepetycje/style.css"/>
<link rel="stylesheet" href="{KATEX}/katex.min.css" crossorigin="anonymous"/>
<link rel="stylesheet" href="/korepetycje/karty/karty.css"/>
<script defer src="{KATEX}/katex.min.js" crossorigin="anonymous"></script>
<script defer src="{KATEX}/contrib/auto-render.min.js" crossorigin="anonymous"></script>
<script defer src="/korepetycje/karty/karty.js"></script>
</head>
<body>

<header class="k-header">
  <a href="/korepetycje/#karty-pracy" class="k-back">← Korepetycje</a>
  <div class="k-wordmark">Karta pracy <span class="k-sep">|</span> {e(short)}</div>
</header>

<main class="ks-main" id="sheet">
  <noscript><p>Ta karta działa w przeglądarce z włączonym JavaScriptem.</p></noscript>
</main>

<footer class="ks-foot">
  <span>Leon Górecki · <a href="/korepetycje/">Korepetycje z fizyki, matematyki i informatyki</a></span>
  <span>Twoje odpowiedzi zapisują się tylko w tej przeglądarce.</span>
</footer>

<script type="application/json" id="sheet-data">{data}</script>
{BEACON}
</body>
</html>
"""


def render_menu(sheets):
    tabs, panels = [], []
    first = True
    for tid, (pl, en, _) in TRACKS.items():
        mine = [s for s in sheets if s["track"] == tid]
        mine.sort(key=lambda s: (s.get("order", 999), s.get("date", "")), reverse=False)
        sel = "true" if first else "false"
        tabs.append(
            f'  <button class="karty-tab" role="tab" id="ktab-{tid}" aria-controls="kpanel-{tid}" '
            f'aria-selected="{sel}"><span data-pl>{e(pl)}</span><span data-en>{e(en)}</span></button>'
        )
        if mine:
            items = []
            for s in mine:
                nt, np_ = counts(s)
                lv = "".join(f'<span class="karta-lv">{e(x)}</span>' for x in s.get("levels", []))
                items.append(
                    f'    <li><a class="karta" href="/korepetycje/karty/{e(s["id"])}/" data-url="{e(sheet_url(s))}">\n'
                    f'      <span class="karta-title">{e(s["title"])}</span>\n'
                    f'      <span class="karta-desc">{e(s["description"])}</span>\n'
                    f'      <span class="karta-meta">{lv}{plural(nt, "zadanie", "zadania", "zadań")} · '
                    f'{plural(np_, "podpunkt", "podpunkty", "podpunktów")}</span>\n'
                    f'    </a></li>'
                )
            body = '  <ul class="karty-list">\n' + "\n".join(items) + "\n  </ul>"
        else:
            body = ('  <p class="karty-empty"><span data-pl>Wkrótce.</span>'
                    '<span data-en>Coming soon.</span></p>')
        hidden = "" if first else " hidden"
        panels.append(
            f'<div class="karty-panel" id="kpanel-{tid}" role="tabpanel" aria-labelledby="ktab-{tid}"{hidden}>\n'
            f"{body}\n</div>"
        )
        first = False
    return ('<div class="karty-tabs" role="tablist">\n' + "\n".join(tabs) + "\n</div>\n"
            + "\n".join(panels))


REDIRECT = """<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8"/>
<title>Karty pracy · Leon Górecki</title>
<meta http-equiv="refresh" content="0; url=/korepetycje/#karty-pracy"/>
<link rel="canonical" href="https://www.leongorecki.eu/korepetycje/"/>
<meta name="robots" content="noindex"/>
</head>
<body>
<p><a href="/korepetycje/#karty-pracy">Karty pracy →</a></p>
</body>
</html>
"""


def main():
    sheets = load()
    ids = {s["id"] for s in sheets}

    for s in sheets:
        out = KDIR / s["id"] / "index.html"
        out.parent.mkdir(exist_ok=True)
        out.write_text(render_sheet(s), encoding="utf-8", newline=LF)
    # drop pages of sheets that no longer exist
    for d in KDIR.iterdir():
        if d.is_dir() and d.name != "sheets" and (d / "index.html").exists() and d.name not in ids:
            shutil.rmtree(d)
    (KDIR / "index.html").write_text(REDIRECT, encoding="utf-8", newline=LF)

    with open(PAGE, encoding="utf-8", newline="") as f:
        raw = f.read()
    crlf = CRLF in raw
    text = raw.replace(CRLF, LF)
    if START not in text or END not in text:
        fail(f"{PAGE}: missing {START}/{END} markers")
    pattern = re.compile(re.escape(START) + r".*?" + re.escape(END), re.DOTALL)
    new_text = pattern.sub(lambda _: f"{START}\n{render_menu(sheets)}\n{END}", text, count=1)
    if new_text != text:
        if crlf:
            new_text = new_text.replace(LF, CRLF)
        with open(PAGE, "w", encoding="utf-8", newline="") as f:
            f.write(new_text)
    print(f"build_karty: {len(sheets)} sheet(s) -> korepetycje/karty/")

    node = shutil.which("node")
    if node:
        r = subprocess.run([node, str(ROOT / "scripts" / "check_karty.js")])
        if r.returncode:
            sys.exit(r.returncode)
    else:
        print("build_karty: node not found, answer keys not tested")


if __name__ == "__main__":
    main()
