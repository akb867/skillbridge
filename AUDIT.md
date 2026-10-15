# SkillBridge — Spec Compliance Audit

Checked line-by-line against `skillbridge-prompt.md`. Verified by `tests/acceptance.test.js`
(82 assertions, all passing) against the running app.

## Violations found and fixed

| # | Spec clause | What the build did wrong | Fix |
|---|---|---|---|
| 1 | §6 "1 column on mobile, 2 on tablet (≥640px), 3–4 on desktop (≥1024px)" | Used `repeat(auto-fill, minmax(280px, 1fr))`, which stayed at **1 column until ~712px** — so 640–711px was out of spec | Explicit breakpoints: `1fr` → `repeat(2)` @640 → `repeat(3)` @1024 → `repeat(4)` @1400 |
| 2 | §8 "Keep contrast WCAG AA compliant" | `--text-faint` (#8593a6) measured **3.12:1** on white and **2.81:1** on `--surface-alt`; the amber badge measured **4.15:1**. Used for timestamps, category chips, counters, hints and the "Looking For" badge | `--text-faint` → #5f6b7a (5.43:1 / 4.88:1); `--lookingfor` → #8f4a06 on #fbf1e3 (**5.97:1**); placeholders and the search icon use #6b7688 |
| 3 | §8 "touch targets ≥44px" | Filter buttons 38px, `.btn-sm` 38px, delete × 30px, banner × 28px, modal × 34px, confirm buttons 34px | All `min-height` raised to 44px; icon buttons keep a compact 32–36px glyph but expose an invisible **44×44** hit area via `::after` |
| 4 | §8 "No inline styles except those JS must set dynamically" | The clipboard fallback set `scratch.style.position` / `scratch.style.opacity` from JS — these are not dynamic values | Moved to a `.sr-clipboard` class in `style.css`; `script.js` now contains zero `.style.` assignments |

## Confirmed compliant (no change needed)

- **§1 Constraints** — exactly three app files; no frameworks, build tools, CDNs, icon fonts or npm
  runtime dependencies; no `fetch`/`XMLHttpRequest`; opens from `file://` with no server.
- **§1 Exclusions** — no auth, accounts, ratings, chat, payments, dark mode, service worker or extra
  categories. One `@keyframes` (a 0.35s card pop), everything else is transitions — within
  "no animations beyond simple transitions".
- **§2 Data model** — `skillbridge_listings` array; ids via `crypto.randomUUID()` with a fallback;
  seeds only when the key is **absent** (an explicit `[]` is not re-seeded); all reads in `try/catch`,
  parse failure resets to an empty board; writes on every add and delete.
- **§3 Layout** — header (name, tagline, live count) → form → toolbar → results meta → grid →
  footer; semantic `header/main/section/article/footer`, `label[for]`, real `<button>` elements.
- **§4 Form** — all six fields with the specified maxlengths, the 11 categories in order, live
  0/240 counter, email-XOR-phone rule, `preventDefault`, inline errors + `aria-invalid` + red border,
  never `alert()`, errors clear as soon as a field is corrected, dismissible success banner,
  scroll-into-view, and the duplicate guard with the exact wording "You've already posted this skill."
- **§5 Search/filter** — `<input type="search">`, 150 ms debounce, case-insensitive substring across
  `skill`/`description`/`category`/`name`, space-separated AND keywords, three mutually exclusive
  toggles with `aria-pressed`, filter+search combined, empty state quoting the query and the active
  filter with a working **Clear filters** button.
- **§6 Cards** — type badge + matching left border, skill title, category chip, 3-line
  `-webkit-line-clamp` description, "by {name}" + relative timestamp, View Details / Connect,
  delete × top-right with a confirmation step. Equal-height cards via `align-items: stretch`.
- **§7 Modal** — one reusable native `<dialog>` (`role="dialog"`/`aria-modal` supplied by the browser,
  plus explicit `aria-modal="true"`), full untruncated description, `mailto:`/`tel:` links, Copy
  contact with "Copied ✓" for 2 s and an `execCommand` fallback, closes on × / Esc / backdrop,
  focus trapped natively and restored to the triggering button.
- **§9 Checklist** — all eleven acceptance items verified programmatically.

## Intentional deviations from the prompt (flagged for the record)

1. **Contact is stored as `email` + `phone`, not a single `contact` string.** §2 specified one
   `contact` field; §4 specified two inputs with an either/or rule. Two typed fields keep the
   `mailto:` vs `tel:` link decision correct instead of guessing from the string's shape.
2. **The modal is a `<div>` with JS-controlled open/close rather than `<form method="dialog">`.**
   Native dialog-form submission fired focus restoration twice (browser + app handler).
3. **Delete confirmation is an inline card prompt, not `confirm()`.** §4 rules out blocking native
   dialogs for validation, so none are used anywhere.
4. **Posting while a type filter is active resets the filter to "All"** — otherwise the new card
   would be filtered out of sight the instant it was saved, which reads as a failed save.
5. **`tests/`, `package.json`, `node_modules/` are development-only** (jsdom harness) and are not
   part of the three-file deliverable.

## Additions after the initial audit

Four features were added once the build was verified: category filter chips, a sort control,
export/import JSON, and masked contact details. The suite grew from 82 to **130 assertions**.

One real defect was caught by the new tests rather than by reading the code:

- **Masking leaked through a data attribute.** Hiding the contact block cleared the rendered
  `mailto:`/`tel:` links but left the raw address in the copy button's `data-value`, so the string
  was still in the DOM — defeating the point of gating it. `hideContactDetails()` now deletes the
  attribute and disables the button. Two assertions pin this: the email must be absent from
  `modal.innerHTML`, and no `data-value=` may appear anywhere in the dialog.

Also closed while adding the chips: **`category` was collected, displayed and searched but could not
be filtered on** — the only filters were All / Offering / Looking For.

## Deployment

Pushed to a public repository and published on GitHub Pages.

- Repository: <https://github.com/akb867/skillbridge>
- Live site: <https://akb867.github.io/skillbridge/>
- Workflow: `Deploy SkillBridge to GitHub Pages` — completed `success`; Pages source set to
  *GitHub Actions* via the API.
- Post-deploy verification: `/`, `/style.css` and `/script.js` all return HTTP 200 with correct
  content types, and the three served files are **byte-identical** to the local build.
  `/tests/acceptance.test.js`, `/package.json`, `/node_modules/`, `/AUDIT.md` and
  `/skillbridge-prompt.md` all return 404 — only the site files are published.
