# Holding Point — handoff package

The design system for leongorecki.eu, packaged for implementation in the repo.

## Put it in the repo

Unzip at the repository root so this folder lands at `design/holding-point/`. It is a working reference, not served content (GitHub Pages will serve it, which is harmless; add `Disallow: /design/` to `robots.txt` if you like).

## Then, in Claude Code

Open the repo and paste:

> Read `design/holding-point/MIGRATION.md` and follow it. Start with phase 1 and stop after phase 2 so I can review the header and foundation before you do the pages.

Stopping early is deliberate: the header and tokens set the tone for everything else, so it's cheap to correct there.

## What's inside

| File | What it is |
|---|---|
| `MIGRATION.md` | The brief for Claude Code: constraints, phases, content mapping, rules, definition of done |
| `BRAND.md` | The brand book: voice, colour, type, spacing, motion, iconography, page anatomy |
| `directions.md` | The four directions explored and why Holding Point won |
| `tokens.css` | Every token as CSS variables, both themes (Day default, Night follows the OS or `data-theme`), `@font-face`, type-style classes |
| `components.css` | The nine components as plain CSS (`hp-` classes) |
| `components.md` | Static HTML markup and usage rules for each component |
| `tokens.json` | The same tokens as data |
| `fonts/` | Archivo and Martian Mono, variable, latin + latin-ext (Polish characters), OFL-licensed |
| `lg-mark.svg` | The LG mark, for favicon and icons |
| `reference/` | Screenshots of every component, the cover and the rebuilt home hero, Day and Night |
