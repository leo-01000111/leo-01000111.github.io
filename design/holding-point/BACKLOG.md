# Holding Point backlog

Ideas and follow-ups agreed with Leon but not built yet.

## Split-flap "Currently improving" display (home page)

Fills the empty space under Skills and Contributions, left of Background.

- A split-flap board (airport departures style): every character is its own flap tile.
- It animates when it scrolls into view. Line 1 flips to "Currently improving:", a brief pause, then line 2 flips to a project name.
- The project comes from a list Leon maintains in a JSON file under the key `flip-through-projects`, rotating daily between the listed projects (pick by day number modulo list length, so every visitor sees the same one on a given day).
- On hover (and keyboard focus) the board glows and the whole board links to that project's page.
- Holding Point fit: tiles are `plate` with `on-plate` legends (the mark and location signs already use this pairing), square corners, condensed Archivo like sign legends. The flip is the one motion on the page; use `--ease-step`. The glow must be a hard offset or a `signal` outline, not a blur.
- `prefers-reduced-motion`: show the final text immediately, no flipping.
- Without JS: render the final text statically so the link still works.
- EN and FR (and PL if that version happens): "Currently improving:" / "En cours d'amélioration :".

## Other open items

- Polish version of the site (EN / FR / PL switch). Later.
- `assets/thumbs/miltombot-day.svg` / `-night.svg` exist but no page uses them yet (the MILTOM-Bot page draws its own diagram). Kept for possible later use.
