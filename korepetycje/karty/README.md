# Karty pracy: sheet format

One sheet = one file `korepetycje/karty/sheets/<id>.json`. Nothing else is
edited by hand. After adding or changing a sheet run

    python scripts/build_karty.py

It validates the file, writes `korepetycje/karty/<id>/index.html`, updates the
menu on `/korepetycje/` and then runs `node scripts/check_karty.js`, which tests
every answer key against the real checker. Both must pass.

Public link of a sheet: `https://www.leongorecki.eu/korepetycje/karty/<id>/`
(task N: add `#zN`).

## Sheet

```json
{
  "id": "e8-uklady-rownan",              // = file name, lowercase-with-dashes
  "track": "e8",                         // e8 | matura | fizyka
  "levels": ["PP"],                      // matura only: PP and/or PR
  "order": 1,                            // optional, position in the menu
  "kicker": "Matematyka · Klasa 8",      // small line above the title
  "title": "Układy równań",
  "subtitle": "Metoda podstawiania · zadania trudniejsze",
  "description": "One sentence for the menu and link previews.",
  "date": "2026-11-18",
  "intro": "General instruction shown above task 1.",
  "tasks": [ ... ]
}
```

## Task and part

```json
{
  "label": "Na rozgrzewkę",               // small caps line; optional
  "prompt": "Rozwiąż układ równań.",      // bold instruction; optional
  "star": false,                          // true = "zadanie z gwiazdką"
  "cols": 2,                              // parts per row on desktop (1-3)
  "parts": [
    {
      "q": "$\\begin{cases} x+3y=11 \\\\ 4x-5y=-7 \\end{cases}$",
      "answers": [ {"type": "num", "label": "$x =$", "key": "2"},
                   {"type": "num", "label": "$y =$", "key": "3"} ],
      "solution": "Optional worked solution (HTML + LaTeX). Shown on request."
    }
  ]
}
```

Parts are lettered a), b), c) automatically. A task with one part has no letter.
A part counts as correct when all its answers are correct. The score is in parts.

Text fields (`q`, `prompt`, `label`, `options`, `items`, `solution`, `display`)
are HTML with KaTeX math: `$...$` inline, `$$...$$` display. In JSON every
backslash is doubled: `\\frac{1}{2}`, `\\cdot`, `\\begin{cases} ... \\\\ ... \\end{cases}`.
Use `{,}` for a decimal comma inside math: `$0{,}5x$`.

## Answer types

| type | student types | key | checks |
|---|---|---|---|
| `num` | `3`, `-1/2`, `1,75`, `1 1/2` | `"1.75"` or `"7/4"`; a list `["4","-4"]` = any of them | value. A unit after the number is ignored. Same value in another notation (e.g. `(2/3)^-3`) gives "form" (yellow). |
| `expr` | `x^7/y^9`, `a^5/(2b^5)` | `"x^7/y^9"` | equivalence at random points, then final form: no negative exponents (`"noNeg": false` to allow) and each variable once (`"simple": false` to allow). The key itself must be in final form. |
| `pow` | `2^7` | `"2^7"` | exact base and exponent. Same value otherwise = "form". |
| `sci` | `4,7*10^-4` | `"4,7*10^-4"` | value, then form `a·10^k` with 1 ≤ a < 10. |
| `choice` | clicks an option | option index (0-based) | `"options": ["$<$", "$>$", "$=$"]` |
| `order` | clicks items in order | item indices, first to last | `"items": ["$2^{10}$", "$4^4$", ...]`; the UI says "od najmniejszej do największej" |
| `self` | nothing; reads the solution and marks himself | none | needs `solution` on the part. Use for proofs ("Wykaż") and anything a browser cannot check. |

Optional on any answer:

- `label`: text before the field, e.g. `"$x =$"`, `"ojciec:"`
- `unit`: shown after the field, e.g. `"zł"`, `"km/h"`
- `display`: how the key is shown in the reveal and printed key (default: built from `key`)
- `placeholder`: hint inside an empty field
- `tol`: absolute tolerance for `num` (default: exact)
- `tests`: `[{"in": "0,00047", "expect": "form"}]`, extra inputs tested by `check_karty.js`

## Rules for authors

- Every key must be verified by hand, not copied blindly. `check_karty.js`
  only proves the checker accepts the key, not that the maths is right.
- Prefer checkable types. Use `self` only when no other type fits.
- Systems with no solution / infinitely many: a `choice` with options
  `["jedno rozwiązanie", "brak rozwiązań (sprzeczny)", "nieskończenie wiele rozwiązań (nieoznaczony)"]`,
  plus `num` fields for x, y when there is exactly one solution.
- Word problems: one `num` per unknown with a clear `label` and `unit`.
- Keep the sheet content in Polish. Short, plain wording.
