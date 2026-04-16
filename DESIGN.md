# DESIGN.md — Leon Górecki Portfolio

A living reference document. Describes the intended visual language, interactions, and decisions behind the design.

---

## Concept

**"Terminal output — but alive."**

The page should feel like a developer's environment: precise, readable, purposeful. Not a toy terminal simulator, not a dark dashboard. Something between GitHub's dark UI and the quiet confidence of a well-configured Neovim theme. The interface is calm at rest and reveals personality through motion — a 3D object that responds to scroll, section labels that read like shell output, a hero that types itself into existence.

The visitor should feel like they are looking *at* a developer's actual work context, not at a personal-branding slide deck.

---

## Color System

Based on GitHub's dark palette — widely legible, immediately legible as "developer", zero visual noise.

| Token       | Value       | Use |
|-------------|-------------|-----|
| `--bg`      | `#0d1117`   | Page background |
| `--surface` | `#161b22`   | Cards, panels |
| `--raised`  | `#21262d`   | Elevated elements, inputs |
| `--ink`     | `#e6edf3`   | Primary text |
| `--muted`   | `rgba(230,237,243,0.60)` | Secondary text |
| `--faint`   | `rgba(230,237,243,0.35)` | Labels, timestamps |
| `--line`    | `rgba(240,246,252,0.10)` | Borders, dividers |
| `--accent`  | `#58a6ff`   | Links, active states, primary button |
| `--green`   | `#3fb950`   | Status dot, contribution graph, "running" states |

---

## Typography

Two fonts, strict roles:

- **Inter** (current) — all body copy, UI labels, navigation
- **JetBrains Mono** — terminal elements only: hero typing sequence, section prompt labels, kicker/overline text, code-style chips

Body `line-height: 1.5`. Monospace elements `line-height: 1.4`.

Section labels (`card h2`) become terminal prompts: `$ skills`, `$ projects`, `$ contact`. Uppercase removed. Monospace font. Accent-coloured `$` prefix.

---

## Hero Section

The hero becomes a split layout:

**Left — Terminal window**
- A `<div>` styled as a macOS/Linux terminal panel (dark bg, traffic lights as coloured dots, top bar, monospace body)
- On page load: a typed boot sequence runs:
  ```
  > whoami
  Leon Górecki
  > cat profile.txt
  Aerospace Engineering · Controls · ML
  Based in Warsaw. Open to EU opportunities.
  > ls projects/
  navfusion/  lgflow/  f1predictor/  kaggle/  thesis/
  ```
- After the sequence completes, the CTA buttons fade in beneath the terminal window
- Blinking block cursor throughout

**Right — 3D wireframe polyhedron**
- A canvas element rendering a rotating wireframe icosahedron via Three.js (CDN, one `<script>` tag, no build step)
- Rotates slowly on its own axis (8s full rotation)
- Scroll position drives additional rotation: the deeper you scroll into the page, the more the object has rotated — implemented via a `scroll` event listener that updates the Three.js mesh rotation
- Colour: edge lines in `#58a6ff` (accent blue), no fill, no lighting — pure wireframe
- On mobile: the 3D canvas is hidden, the terminal expands full-width

References:
- Terminal aesthetic: https://github.com/satnaing/terminal-portfolio
- CSS 3D and scroll-driven rotation: https://scroll-driven-animations.style/
- Three.js wireframe technique: https://threejs.org/examples/#webgl_wireframe

---

## Navigation

Current pill buttons → terminal command style:

```
[  > projects  ]   [  > skills  ]   [  > contact  ]
```

- Monospace font
- `>` prompt character in `--faint` colour before each label
- Border: `1px solid var(--line)`, subtle hover that shifts to `--accent` border

Language toggle stays as-is (clean toggle group, already good).

---

## Scroll Interaction

**Section cards** — reveal on scroll with a translate + fade, but driven by native CSS `@keyframes` + `IntersectionObserver` (already implemented, keep).

**The 3D polyhedron** — rotates an additional ~120° as the user scrolls from top to bottom of the page. Implemented in JS: `window.scroll` → `mesh.rotation.y = scrollFraction * Math.PI * 2 * 0.33`.

**Section headings** — as each section enters the viewport, the prompt label (`$ section-name`) "types in" character by character. Cheap typewriter on the label only, not on body text.

---

## Section Visual Language

Every `card h2` becomes a terminal prompt:

```html
<h2><span class="prompt">$</span> skills</h2>
```

```css
.prompt { color: var(--green); font-family: 'JetBrains Mono', monospace; margin-right: 8px; }
card h2 { font-family: 'JetBrains Mono', monospace; text-transform: none; letter-spacing: 0; }
```

---

## What is NOT in scope

- No ASCII art (gimmick, hard to maintain)
- No sound effects
- No full terminal simulator (visitor should not need to type commands)
- No Three.js scenes beyond the one rotating wireframe
- No scroll-jacking or custom scroll behaviour
- No parallax on text (illegible at speed)

---

## References

| Inspiration | What to borrow | URL |
|---|---|---|
| Satnaing terminal portfolio | Terminal window styling, boot sequence typing pattern | https://github.com/satnaing/terminal-portfolio |
| Brittany Chiang v4 | Dark portfolio done tastefully — layout restraint, colour use | https://v4.brittanychiang.com/ |
| Scroll-driven animations | Native scroll-driven CSS techniques | https://scroll-driven-animations.style/ |
| Three.js wireframe example | Wireframe icosahedron rendering | https://threejs.org/examples/#webgl_wireframe |
| Bruno Simon | 3D + portfolio interaction concept proof (for ambition reference only) | https://bruno-simon.com/ |
| GitHub dark palette | Colour system baseline | https://primer.style/foundations/color |
