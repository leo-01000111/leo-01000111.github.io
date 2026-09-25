# Holding Point — brand book

**Holding Point** is the visual language of leongorecki.eu. It borrows from three places Leon actually comes from, and gives each one a single job:

- **Airfield ground signage** decides *colour and components*. It is the one sign system engineered to be read at speed, in any weather, by someone busy flying — so every element has a fixed meaning: black plate with yellow legend = *you are here*; yellow with an arrow = *go that way*; red = *stop*. Nothing is decorative without also meaning something.
- **Polish constructivism** (Strzemiński, Kobro, the *a.r.* group) decides *proportion and layout*: asymmetric 8:5 splits, a Fibonacci spacing scale, planes that run off the edge of the frame. It is Bauhaus's neighbour, not its copy — rhythm from a calculated ratio rather than from primary shapes.
- **Control theory** decides *motion*: every transition is a step response — it rises fast, overshoots once, and settles.

The result should feel like a well-signed airfield at dawn: flat, bright, unmistakable, and quietly exact.

## Content fundamentals

- **Voice:** an engineer explaining his work to a smart peer. Plain, specific, first person singular ("I built…", never "we"). Lead with what it does, then how. No hype words ("passionate", "cutting-edge", "innovative").
- **Numbers carry the claim:** "fuses IMU and GNSS at 200 Hz", "cut drawing time from 2 h to 15 min". SI units with a space: `200 Hz`, `12 m³`. Year ranges with a spaced en dash: `2026 — 2028` (as the current site does).
- **Casing:** sentence case for all headings and prose. UPPERCASE only where the CSS applies it — sign legends, buttons, `label` keys, tags. Write source text in sentence case either way.
- **Titles:** project name, em dash, what it is: "NavFusion — learned sensor fusion for UAV navigation".
- **Languages:** EN is the default, FR and PL are full translations, not summaries. The tutoring page (`/korepetycje/`) is Polish-first and speaks directly to students and parents. Never mix two languages in one sentence; a bilingual CTA stacks them on two lines.
- **No emoji, no exclamation marks.**

## Visual foundations

### Colour

Six hues, each with one meaning. Neutrals are cool concrete, not beige.

| Token | Role |
|---|---|
| `ground` / `surface` | Pavement and panels. Day theme is dry concrete; Night theme is asphalt. |
| `ink`, `ink-muted` | All text. `ink-muted` also draws control borders. |
| `signal` + `on-signal` | Sign yellow: direction signs, secondary buttons, markings, project index blocks. **Never text on the light ground** (1.3:1). |
| `plate` + `on-plate` | Location plate: primary buttons, the current nav panel, the mark. |
| `hold` + `on-hold` | Mandatory red: one "stop here" per page, destructive actions. As text use `hold-ink`. |
| `edge` | Taxiway-edge blue: links and the focus ring. Nothing else is blue. |
| `lamp-go`, `lamp-caution` | Status lamps; always beside a word. |

Budget per screen: roughly 70% `ground`/`surface`, 20% `ink`/`plate`, ≤10% `signal`, and a red that you could cover with a thumb. If a page looks yellow, it has too many direction signs.

### Typography

Two families, both variable, both self-hosted from `fonts/` (Polish diacritics included).

- **Archivo** does everything with words. Its width axis is the system's voice: `display` and `h1` are **expanded** (`font-stretch: 118%`) — wide, calm, poster-like; sign legends (`sign`, `sign-sm`, buttons) are **condensed** (`82%`) and uppercase — tall and dense like real sign faces; `h2`, `h3` and text styles stay at normal width.
- **Martian Mono** is for data only: `label` (uppercase keys, kickers, tags), `data` (values, dates, metrics, tabular figures) and `code`.

Scale: `display` 112 → `h1` 68 → `h2` 42 → `h3` 26 → `lede` 20 → `body` 16 → `small` 14, mono `data` 13 / `label` 11. On phones `display` is replaced by `h1`, and `h1` drops to 42px. Body text measure: 68ch max, `lede` 60ch.

### Space and layout

- **Spacing** is the 8:5 scale: `space-1` 4 · `space-2` 8 · `space-3` 12 · `space-4` 20 · `space-5` 32 · `space-6` 52 · `space-7` 84 · `space-8` 136. Pick by jump, never by nudging: a gap is either "inside" (`space-2`–`space-3`), "between siblings" (`space-5`), or "between ideas" (`space-7`).
- **Grid:** a page frame of `content-max` 1232px with a `space-6` gutter (`space-4` on phones). Two-column sections split **8:5** — `split-major` 61.5% / `split-minor` 38.5% — and the minor column alternates sides between sections, never centred symmetry.
- **Bleed:** one element per page may run off the frame edge (a yellow `signal` block behind the hero, a project index numeral clipped by its block). That's the constructivist gesture; use it once.

### Shape, lines and depth

- Everything is rectangular: `radius-0` for panels, cards, tags and inputs; `radius-plate` (2px) for sign plates and buttons. The only round thing is a lamp (`radius-lamp`).
- Lines: `stroke-hair` (1px, `rule`) between rows; `stroke-bold` (2px, `ink`) frames cards, the DataPlate and controls; `stroke-sign` (3px) is the inset border of a location plate.
- **No blur and no gradients.** Depth is a hard offset: `shadow-lift` (4px 4px, `ink` by day, `signal` by night) appears only on hover/focus, when a plate lifts 2px up-left.

### Motion

Motion is a **step response** of a lightly damped second-order system (ζ ≈ 0.6): it rises quickly, overshoots once by a few percent, and settles. Use `--hp-ease-step` (`cubic-bezier(.3, 1.35, .55, 1)`) at `--hp-t-step` (320ms) for anything that moves into place — plate lift, arrow nudge, page view transitions. Use `--hp-ease-out` at `--hp-t-fast` (140ms) for colour and shadow. Never loop anything except the `live` lamp. `prefers-reduced-motion` removes all transforms.

### States and focus

- Hover on plates: lift + `shadow-lift`. Hover on links: underline thickens 1 → 2px. Hover on direction signs: the arrow nudges 3px in its own direction.
- **Focus ring:** 2px solid `focus` (= `edge` blue), offset 2px so it lands on the ground around the control — 5.5:1 on Day `ground`, 8.3:1 on Night `ground`. Never remove it; never put it on the control's own fill (on `signal` it would drop below 3:1 in Night).
- Disabled: 45% opacity, no lift.
- Errors: `hold-ink` text plus a word ("Required"), never colour alone.

### Imagery

Project visuals are real: screenshots, plots, CAD renders, photos of hardware. Show them flat, rectangular, full-bleed to their column, with a `label` caption below (`FIG. 03 — EKF innovation, GNSS outage at t = 40 s`). No device mockups, no stock photos, no AI illustrations, no tilted 3D cards. Plots use `ink` for data, `signal` for the highlighted series, `edge` for a reference line.

## Iconography

There is no icon set. The system has exactly two drawn glyphs:

1. **The airfield arrow** (markup in components.md) — heavy shaft, open mitred chevron, eight directions. It appears only inside signs, buttons and the project-card "go" plate, and always points where the link actually goes (`up-right` = leaves the site).
2. **The lamp** (`hp-lamp`) — a filled circle for status.

Brands (GitHub, LinkedIn) are written as words on ghost buttons, not logos. No emoji, no flags on the language switch.

The mark (`assets/Logos/lg-mark.svg`) is a location plate carrying a constructed "LG": `plate` #121314 ground, `signal` #f5c518 inset border and letters. It is a single fixed-colour image (it cannot inherit `color`) and works on both themes because the plate carries its own ground. Use it as the favicon and app icon; in the header, use a location sign with the name instead (the first panel of the SignArray).

## Page anatomy (home)

1. Header: mark · `SignArray` (sm) · `LangSwitch`.
2. Hero, 8:5: `label` kicker ("Engineering portfolio") → `display` statement (≤5 words) → `lede` → one `primary` + one `secondary` + ghost buttons. Minor column: the `DataPlate`. A `signal` block bleeds off the right edge behind it.
3. `Marking centerline`.
4. Selected projects: up to three `ProjectCard`s, then a ghost "All projects" button.
5. Skills: `TagList` with keys, plus the contributions heat-map drawn in `ink` → `signal` steps.
6. Tutoring: an `info` sign "Korepetycje", two stacked lines PL/EN, a `secondary` button.
7. `Marking holding` labelled "HOLD SHORT · CONTACT", then contact: `primary` "Email me".
