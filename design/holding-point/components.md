# Components — static HTML reference

The site is plain static HTML, so these are **markup patterns, not React components**. Each section gives the rules, then the exact markup to copy (rendered from the design-system source). Styles live in `components.css`; screenshots of every component in both themes are in `reference/`.

## The arrow glyph

Every arrow is the same inline SVG; only the rotation changes. Put it after the label, except for `left`, `up-left` and `down-left`, where it goes before.

| direction | rotate | meaning |
|---|---|---|
| right | 0 | forward / same site |
| down | 90 | further down this page |
| left | 180 | back |
| up-right | 315 | leaves the site (PDF, GitHub, LinkedIn) |

```html
<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g transform="rotate(0 12 12)" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="square" stroke-linejoin="miter"><path d="M3.5 12H18.5"></path><path d="M12 5.2L18.8 12L12 18.8"></path></g></svg>
```

## SignArray

The site navigation, built the way airfield sign arrays are: one `location` panel says where you are, `direction` panels around it point to everywhere else.

Order the panels spatially — destinations "behind" you (home, parent page) sit left of the location panel with `arrow: 'left'`; destinations ahead sit right with `arrow: 'right'`; off-site links (CV PDF, GitHub) use `up-right`. Exactly one item has `current: true`.

Content: `items: [{label, href, arrow, current}]`, an optional `label` for the `<nav>` (default "Site"), and `size="sm"` for the compact header version. On phones the array wraps; keep labels to one word so it wraps into at most two rows.

Don't: add a hamburger — four panels fit on a 360px screen at `sm`. Don't put the language switch inside the array; it sits beside it as a `LangSwitch`.

```html
<nav class="hp-signarray" aria-label="Site"><span class="hp-sign hp-sign--location hp-sign--sm" aria-current="page"><span>Leon Górecki</span></span><a class="hp-sign hp-sign--direction hp-sign--sm" href="/projects/"><span>Projects</span><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g transform="rotate(0 12 12)" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="square" stroke-linejoin="miter"><path d="M3.5 12H18.5"></path><path d="M12 5.2L18.8 12L12 18.8"></path></g></svg></a><a class="hp-sign hp-sign--direction hp-sign--sm" href="/#skills"><span>Skills</span><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g transform="rotate(0 12 12)" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="square" stroke-linejoin="miter"><path d="M3.5 12H18.5"></path><path d="M12 5.2L18.8 12L12 18.8"></path></g></svg></a><a class="hp-sign hp-sign--direction hp-sign--sm" href="/#contact"><span>Contact</span><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g transform="rotate(90 12 12)" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="square" stroke-linejoin="miter"><path d="M3.5 12H18.5"></path><path d="M12 5.2L18.8 12L12 18.8"></path></g></svg></a></nav>
```

## Sign

A single airfield sign panel — the atom of the whole system; use it for wayfinding and section markers, never for body content.

Kinds, with their fixed meanings (the same as on an airfield):

- `location` — *you are here*. Black `plate`, `on-plate` legend and inset border. The current page, the site's name, the mark.
- `direction` — *go that way*. `signal` fill, `on-signal` legend, an `arrow` that points where the link goes. Only on links.
- `mandatory` — *stop*. `hold` fill, `on-hold` legend, ink outline. At most one per page (a notice, an availability change, a deadline).
- `info` — neutral `signal` label with no arrow: a category flag such as "Korepetycje".

Content:: `children` (1–3 words, the component uppercases them), `kind`, optional `arrow` (`right` `left` `up` `down` `up-right` `up-left` `down-right` `down-left`), `href`, `size="sm"`.

Do: point the arrow truthfully — `left` for back, `up-right` for external. Don't: put two `mandatory` signs on one page, use a sign as a paragraph container, or colour a sign outside these four kinds.

```html
<span class="hp-sign hp-sign--location"><span>Projects</span></span>

<a class="hp-sign hp-sign--direction" href="/#contact"><span>Contact</span><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g transform="rotate(0 12 12)" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="square" stroke-linejoin="miter"><path d="M3.5 12H18.5"></path><path d="M12 5.2L18.8 12L12 18.8"></path></g></svg></a>

<a class="hp-sign hp-sign--direction" href="/cv.pdf"><span>CV</span><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g transform="rotate(315 12 12)" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="square" stroke-linejoin="miter"><path d="M3.5 12H18.5"></path><path d="M12 5.2L18.8 12L12 18.8"></path></g></svg></a>

<span class="hp-sign hp-sign--mandatory"><span>Hold short · Nantes</span></span>

<span class="hp-sign hp-sign--info"><span>Korepetycje</span></span>
```

## Button

Actions, styled as sign plates: one `primary` (a location plate) per view, for the single thing the page wants the visitor to do.

- `primary` — `plate` fill, `on-plate` legend and inset border. "Email me", "Book a lesson". One per view.
- `secondary` — `signal` fill. The second most useful action (CV, schedule).
- `ghost` — `ink-muted` 2px border. Everything else: GitHub, LinkedIn, "all projects".
- `hold` — `hold` fill. Destructive or irreversible actions only.

Hover is a step response: the plate lifts 2px up-left with one small overshoot (`--hp-ease-step`), and `shadow-lift` appears. The arrow nudges 3px in its direction. Reduced motion removes both.

Content: `children` (a verb first, 1–3 words), `variant`, optional `arrow` (`true` = right, or a direction), `href` (renders an `<a>`), `size="sm"`, and any native button props. Legends are uppercased by CSS — write them in sentence case in source.

```html
<a class="hp-btn hp-btn--primary" href="mailto:leon.gorecki.fr@proton.me"><span>Email me</span><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g transform="rotate(0 12 12)" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="square" stroke-linejoin="miter"><path d="M3.5 12H18.5"></path><path d="M12 5.2L18.8 12L12 18.8"></path></g></svg></a>

<a class="hp-btn hp-btn--secondary" href="/cv.pdf"><span>CV · PDF</span><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g transform="rotate(315 12 12)" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="square" stroke-linejoin="miter"><path d="M3.5 12H18.5"></path><path d="M12 5.2L18.8 12L12 18.8"></path></g></svg></a>

<a class="hp-btn hp-btn--ghost" href="https://github.com/leo-01000111"><span>GitHub</span><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g transform="rotate(315 12 12)" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="square" stroke-linejoin="miter"><path d="M3.5 12H18.5"></path><path d="M12 5.2L18.8 12L12 18.8"></path></g></svg></a>

<button class="hp-btn hp-btn--hold" type="button"><span>Delete draft</span></button>
```

## Tag

Mono, square, outlined labels for skills, stack and categories — the stencilled part numbers of the system.

Use `TagList` for any set (it renders a `<ul>`). A tag may carry a key (`k: 'CAD'` → "CAD: SIEMENS NX") to group skills without extra headings. `solid` inverts it (ink fill, `ground` text) — use once per list at most, for the one thing to notice.

Content: `items` (strings or `{label, k, solid}`) and an accessible `label` for the list. Keep each tag under ~18 characters; never put sentences in tags.

```html
<ul class="hp-tags" aria-label="Skills"><li><span class="hp-tag">C++</span></li><li><span class="hp-tag">Python</span></li><li><span class="hp-tag"><b>CAD:</b>Siemens NX</span></li><li><span class="hp-tag hp-tag--solid">MSc 2026</span></li></ul>
```

In React-free markup, `k` is the `<b>` prefix and `solid` is the `hp-tag--solid` class.

## Lamp

A status light plus its word — the airfield lights: green centreline = go, yellow = caution, red = stop, unlit = off.

States: `go` (`lamp-go`), `caution` (`lamp-caution`, ink-outlined so it holds on concrete), `hold` (`hold`), `off` (hollow ring). `live` adds a slow pulse to `go` — only for something genuinely live ("Currently: CAD at Miltom", "Available").

Content: `state` and `children` — the word is mandatory; colour never carries the meaning alone. The only round shape in the system is this lamp (`radius-lamp`).

```html
<span class="hp-lamp hp-lamp--go is-live"><i aria-hidden="true"></i><span>Available for tutoring</span></span>

<span class="hp-lamp hp-lamp--caution"><i aria-hidden="true"></i><span>In progress</span></span>

<span class="hp-lamp hp-lamp--hold"><i aria-hidden="true"></i><span>Paused</span></span>

<span class="hp-lamp hp-lamp--off"><i aria-hidden="true"></i><span>Archived</span></span>
```

## DataPlate

The spec placard: a titled key/value plate in the 8:5 split (keys take 38.5%), like the data plate riveted to an airframe.

Use it once per page for hard facts — base, focus, tools, availability, dates. Keys are `label` style (mono, uppercase, `ink-muted`); values are `data` style (mono, tabular figures, `ink`). A value may be a node — a `Lamp` for the "Currently" row.

Content: `title` (2–3 words), optional `refId` (a short part-number, e.g. "LG-01"), and `rows: [[key, value], …]` — 3 to 7 rows. Don't use it for prose, for long lists (use `TagList`), or twice on one page.

```html
<section class="hp-plate" aria-label="Quick specs"><div class="hp-plate__head"><span class="hp-plate__title">Quick specs</span><span class="hp-plate__ref">LG-01</span></div><dl><dt>Base</dt><dd>Warsaw · Paris · Nantes</dd><dt>Currently</dt><dd><span class="hp-lamp hp-lamp--go is-live"><i aria-hidden="true"></i><span>MSc, Centrale Nantes</span></span></dd></dl></section>
```

## ProjectCard

One project, as a plate: an oversized index numeral on a coloured block (5 parts) beside the text (8 parts) — the 8:5 split made visible.

Tones set the index block: default `signal` (yellow); `plain` (black plate, yellow numeral) to alternate in long lists; `hold` (red) for one featured or flagship project only. The whole card is the link; on hover it lifts like a primary button.

Content: `index` (number, zero-padded to two digits), optional `code` (3-letter discipline code: GNC, CAD, ML, OPS, EDU), `meta` (year, context — max 3 short items), `title` (the project name, then an em-dash and what it is), `summary` (one sentence, ≤ 25 words), `tags` (≤ 4), and `href`.

Stack cards in one column on the projects page; on the home page show at most three. Below 620px the index block becomes a 96px band on top.

```html
<a class="hp-card" href="/projects/navfusion.html"><div class="hp-card__index" aria-hidden="true"><em>GNC</em><span>01</span></div><div class="hp-card__body"><div class="hp-card__kicker"><span>2025</span><span>Thesis</span></div><h3 class="hp-card__title">NavFusion — learned sensor fusion for UAV navigation</h3><p class="hp-card__summary">An EKF with a learned measurement model that keeps a drone on track when GNSS drops out.</p><div class="hp-card__foot"><ul class="hp-tags" aria-label="Stack"><li><span class="hp-tag">C++</span></li><li><span class="hp-tag">PyTorch</span></li><li><span class="hp-tag">ROS 2</span></li></ul><span class="hp-card__go" aria-hidden="true"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g transform="rotate(0 12 12)" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="square" stroke-linejoin="miter"><path d="M3.5 12H18.5"></path><path d="M12 5.2L18.8 12L12 18.8"></path></g></svg></span></div></div></a>
```

## LangSwitch

The language switch: a segmented control whose current segment is a location plate.

Content: `langs: [{code, href, current}]` — real URLs per language (`/`, `/fr/`, `/pl/` — `hreflang` is set for you), exactly one `current`. Always place it right of the `SignArray`, never inside it. Codes are shown as two-letter uppercase; never flags.

```html
<div class="hp-lang" role="group" aria-label="Language"><span aria-current="page" lang="en">EN</span><a href="/fr/" hreflang="fr" lang="fr">FR</a></div>
```

## Marking

Pavement markings used as section dividers — the only decorative element, and it still means something.

- `centerline` — a dashed `signal` line: "the path continues". Between ordinary sections, at most every other section.
- `holding` — the runway-holding-position pattern (two solid, two dashed lines): "stop before you cross". Once per page, directly above the contact section or the tutoring call to action. Its optional `label` (`label` type style) names what lies beyond: "HOLD SHORT · CONTACT".

In the light theme markings are outlined in `ink`, as real markings are on light concrete; in dark they stand alone on `ground`. Content: `kind` and an optional `label`. Keep markings full-width of their column; never vertical.

```html
<div role="separator"><svg class="hp-marking" width="100%" height="28" aria-hidden="true" focusable="false"><defs><pattern id="hp-mk-1" width="36" height="28" patternUnits="userSpaceOnUse"><rect class="edge" x="0.5" y="11.5" width="20" height="5" fill="currentColor" stroke-width="1"></rect></pattern></defs><rect x="0" y="0" width="100%" height="28" fill="url(#hp-mk-1)"></rect></svg></div>

<div role="separator" aria-label="Hold short · Contact" class="hp-marking-wrap"><svg class="hp-marking" width="100%" height="28" aria-hidden="true" focusable="false"><defs><pattern id="hp-mk-2" width="40" height="28" patternUnits="userSpaceOnUse"><rect class="edge" x="0.5" y="16.5" width="23" height="4" fill="currentColor" stroke-width="1"></rect><rect class="edge" x="0.5" y="22.5" width="23" height="4" fill="currentColor" stroke-width="1"></rect></pattern></defs><rect class="edge" x="0.5" y="2.5" width="100%" height="4" fill="currentColor" stroke-width="1"></rect><rect class="edge" x="0.5" y="8.5" width="100%" height="4" fill="currentColor" stroke-width="1"></rect><rect x="0" y="0" width="100%" height="28" fill="url(#hp-mk-2)"></rect></svg><span class="label">Hold short · Contact</span></div>
```

Each marking's `<pattern id>` must be unique on the page (`hp-mk-1`, `hp-mk-2`, …).
