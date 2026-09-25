# Migration brief — leongorecki.eu → Holding Point

You are restyling Leon Górecki's personal site (this repo, served by GitHub Pages at leongorecki.eu) to the **Holding Point** design system in `design/holding-point/`. Read this brief first, then `design/holding-point/BRAND.md` (the rules), then `components.md` (the markup). Look at the screenshots in `reference/` before building anything: they are the target.

## Source of truth, in order

1. `BRAND.md`: every rule about colour, type, spacing, motion and voice.
2. `tokens.css` + `components.css`: exact values and component styles. Don't retype values; reference the CSS variables.
3. `components.md`: exact markup for each component.
4. `reference/*.png`: the visual target in Day (`-light`) and Night (`-dark`). `HomePage-*.png` is the home hero rebuilt with the site's real content.

If something isn't covered, extend the system in its own spirit (a variable from `tokens.css`, a jump from the 8:5 spacing scale) and list it in your final summary. Never introduce new colours, blurred shadows, gradients, rounded cards or other fonts.

## Constraints: keep these working

- **Static HTML, no build step, no framework.** No React, no bundler, no npm in production. The design system's React components are reference only; everything here is hand-written HTML + CSS.
- **Self-hosted fonts** only (no Google Fonts `<link>`).
- Cross-document **View Transitions** (keep them; use `--ease-step` / `--t-step` for their timing).
- **GoatCounter** script on every page, canonical + `hreflang` links, JSON-LD `Person` block, skip link, `sitemap.xml`, `robots.txt`, `CNAME`.
- The GitHub Actions that update `assets/contributions.json` and `projects/kaggle-scores.json`, and the JS that renders those two widgets, keep working. Restyle the contributions heat map with `ink` → `signal` steps.
- `scripts/build_fr.py` regenerates `fr/projects/*.html` from the English project pages: finish the English pages first, then re-run it, then check the French output. `fr/index.html` is hand-maintained; update it by hand to match `index.html`.
- Pages must work with JavaScript disabled, except the two live widgets.

## Phases

Work phase by phase. After each phase, take screenshots at 1280px and 375px wide in both themes and compare them with `reference/`.

**1. Foundation**
- Copy `design/holding-point/fonts/*.woff2` → `assets/fonts/`. Add `tokens.css` and `components.css` to `assets/`.
- Rewrite `assets/style.css` to hold only page layout (header, sections, grids, footer) built on the tokens.
- Link, in order: `tokens.css`, `components.css`, `style.css`.
- Replace the IBM Plex preloads with a single preload of `archivo-latin-wdth-normal.woff2`. Delete the IBM Plex files once nothing references them.
- Theme: Day by default, Night follows the OS (`tokens.css` handles it). An optional toggle only needs to set `data-theme` on `<html>`.
- Set `<meta name="theme-color">` twice, with `media="(prefers-color-scheme: light)"` → `#e7e8e3` and dark → `#0e0f11`.

**2. Header and footer on every page**
- Header: SignArray (sm), then LangSwitch on the right.
  - First panel = location sign "Leon Górecki" on the home page, or the current section's name elsewhere.
  - Direction panels point truthfully: `left` for Home when you are deeper in the site, `right` for siblings, `down` for anchors lower on the same page.
  - LangSwitch shows EN / FR only. The tutoring page is Polish-only and keeps its own Polish/English link.
- Delete the hamburger (`.nav-toggle` and its JS). The sign array wraps instead.
- Footer: a centreline marking, then small mono text.

**3. Home, `index.html`**
Follow "Page anatomy (home)" in BRAND.md. Map the current content:

| Now | Becomes |
|---|---|
| `.brand` / `.mark` "LG" | location sign in the SignArray; `lg-mark.svg` becomes the favicon |
| `.pill` nav links | SignArray direction panels |
| `.lang` | LangSwitch |
| `.kicker` + `h1` + `.subtitle` | `label` kicker, `display` headline (≤ 5 words, e.g. "From aircraft to robots."), `lede` |
| `.btn.primary` "Email me" | primary Button; CV = secondary; GitHub / LinkedIn = ghost, arrow `up-right` |
| `aside.spec` "Quick specs" | DataPlate; "Currently" row gets a `go` Lamp |
| `.tutoring-cta` | tutoring section: info sign "Korepetycje", PL line over EN line, secondary Button |
| `.card#skills` + `.tag`s | Skills section: TagList with keys (`CAD:`, `Code:`, …) |
| contributions grid | same data, restyled |
| contact | holding marking labelled "Hold short · Contact", then the contact block with the one primary Button |

Update `hero` copy only where BRAND.md's voice rules require it. The display headline is new copy, so flag it in your summary so Leon can approve or rewrite it.

**4. Projects, `projects/index.html`, `projects/*.html`, `_template.html`**
- The project list is currently rendered by `assets/main.js` from `projects/projects.json`, so it doesn't exist without JS (flagged by an earlier audit).
  - Make it static: add `scripts/build_projects.py`, which reads `projects.json` and writes ProjectCard markup between `<!-- projects:start -->` / `<!-- projects:end -->` markers in `projects/index.html` (and in `index.html` for the top 3).
  - Remove the JSON-fetching render paths from `main.js`. Keep the live widgets.
- Assign each project a three-letter code in the card's top-left:
  - GNC: guidance, navigation, control
  - CAD
  - ML
  - OPS: tools and automation
  - EDU: teaching
- Tones: default yellow. Alternate `hp-card--plain` in long lists. Give `hp-card--hold` (red) to one flagship project only; ask Leon which one if it isn't obvious.
- Project detail pages: `h1` expanded title, a DataPlate for facts, and figures captioned in `label` style ("FIG. 01 — …").

**5. Tutoring, `korepetycje/`**
- It has its own `style.css`. Rebuild it on the same tokens and components.
- Polish-first copy.
- Keep all its content and any contact or booking details exactly as they are.

**6. 404**
- A mandatory sign "404 · Hold short".
- One sentence.
- A direction sign `left` "Home".

**7. Meta and cleanup**
- Regenerate icons from `lg-mark.svg` with `scripts/generate_icons.py`.
- `og:image` points to `assets/og-card.png`, but the repo only has `og-card.svg`. Create a 1200×630 PNG in the new style (plate/signal blocks, name in `display`) and check that the file exists.
- An earlier audit flagged large orphaned GIF files. List any unreferenced media and ask Leon before deleting.
- Update `sitemap.xml` `lastmod` for the pages you changed.

## Rules that are easy to break

- **Yellow (`--signal`) is never text on the Day ground.** It is a fill. In Night it may be text.
- **One primary Button per view**, one holding marking per page, at most one mandatory (red) sign per page.
- **Arrows point where the link goes**: `up-right` means it leaves the site.
- **Yellow budget:** ≤ 10% of any screen. If a page looks yellow, remove direction signs or index blocks.
- **Shapes:** everything rectangular, except lamps (round). Plates/buttons get `--radius-plate` (2px).
- **Legends** (signs, buttons, labels, tags) are uppercased by CSS. Write the source in sentence case.
- **Focus ring:** never remove it.
- **Reduced motion:** `prefers-reduced-motion` must kill all transforms (already in `components.css`).
- **Headlines:** the `display` headline must fit on ≤ 3 lines at 1280px and ≤ 4 lines at 375px.

## Done means

- Every page matches `reference/` in spirit, in both themes, at 375px and 1280px, with no horizontal scroll.
- No console errors. Lighthouse Accessibility ≥ 95 and no CLS from font loading.
- Nav, projects and all content readable with JS disabled.
- FR pages at parity with EN.
- Final summary lists:
  - every file changed;
  - every new copy line for Leon to approve;
  - every place you extended the system;
  - anything you deliberately left alone.

Commit in phases with clear messages. Don't push. Leon reviews and pushes.
