# SkillBridge

**Live:** <https://akb867.github.io/skillbridge/>

A frontend-only, peer-to-peer **skill exchange board** for a college campus. Post what you can
teach (**Offering**) or what you want to learn (**Looking For**), then search, filter and open a
listing to contact the poster.

No backend, no build step, no dependencies — plain HTML, CSS and vanilla JavaScript. All listings
persist in the browser's `localStorage`.

## Run it

Double-click `index.html`, or serve the folder:

```bash
python3 -m http.server 3000
# → http://localhost:3000
```

## Files

| File | Purpose |
|---|---|
| `index.html` | Markup: header, post form, search toolbar, card grid, details modal |
| `style.css` | Theme (CSS custom properties), responsive 1→4 column grid, AA-compliant contrast |
| `script.js` | `localStorage` layer, seed data, validation, live search + filters, rendering, modal |

Everything else in this repo is hosting configuration (see below) plus documentation.

## Features

- **Dual-role listings** — one form posts either an *Offering* or a *Looking For*, colour-coded green
  and amber throughout so the two buckets are scannable at a glance.
- **Live search** — filters as you type (150 ms debounce), case-insensitive, matches skill,
  description, category and name; space-separated keywords combine with AND logic.
- **Three combinable filters** — type toggles (All / Offering / Looking For) *and* category chips
  *and* the search term, all ANDed together. Chips are generated from the categories actually present
  and carry live counts, so they never offer a dead end.
- **Sorting** — newest, oldest, skill A–Z or category A–Z, preserved across searches.
- **Interactive cards** — View Details opens a modal with the full description; Connect opens the
  same modal focused on the poster's `mailto:` / `tel:` link, with a copy-to-clipboard button.
- **Persistence** — every add and delete writes to `localStorage`, so listings survive refreshes and
  browser restarts. Corrupt or blocked storage degrades to an empty board instead of crashing.
- **Validation** — inline field errors (never `alert()`), a live character counter, and an
  email-*or*-phone rule so every listing is contactable.
- **Masked contact details** — a poster's email and phone are *not* in the page source. The modal
  renders a "Reveal contact" button and builds the `mailto:`/`tel:` links only on click, so the
  details are not sitting in the HTML for scrapers. "Connect" counts as explicit intent and unmasks
  immediately. Closing the modal scrubs the DOM again, including the copy button's data attribute.
- **Data portability** — Export downloads the whole board as a dated, self-describing JSON file;
  Import merges one back in, skipping duplicates and invalid entries and normalising unknown
  categories to "Other". This is also the workaround for `localStorage` being per-browser: export on
  one machine, import on another.

## Reset the demo data

The board seeds itself with sample listings on first visit only. To start clean, run this in the
browser console:

```js
localStorage.removeItem('skillbridge_listings'); location.reload();
```

## Hosting

**Currently deployed on GitHub Pages** at the URL above, from `.github/workflows/pages.yml` — every push
to `main` redeploys in about a minute. Pages is set to *Source: GitHub Actions*, and the workflow stages
only the four site files into `_site/`, so `tests/` and `node_modules/` are never published (confirmed:
`/tests/…`, `/package.json` and `/node_modules/` all return 404 on the live site).

The app is 100% static, so any free static host works. Config for four of them is already in the repo.

### Netlify Drop — fastest, no account setup first
Drag **`skillbridge-deploy.zip`** onto <https://app.netlify.com/drop>. Live in about ten seconds on a
`*.netlify.app` URL.

### GitHub Pages — best if you want the repo public anyway
1. Push this folder to a GitHub repository (branch `main`).
2. **Settings → Pages → Source: GitHub Actions**.
3. The workflow at `.github/workflows/pages.yml` deploys on every push. It stages `index.html`,
   `style.css`, `script.js` and `README.md` into `_site/` and publishes that — so `tests/` and
   `node_modules/` never reach Pages.

### Vercel
`vercel.json` is included. Either import the repo at <https://vercel.com/new>, or from this folder:

```bash
npx vercel --prod
```

### Cloudflare Pages
Create a project pointing at the repo with **build command left empty** and **output directory `.`**.
For a direct upload instead, drag `skillbridge-deploy.zip` into *Workers & Pages → Create → Upload assets*.

`_headers` is picked up automatically by Netlify and Cloudflare Pages; `netlify.toml` and `vercel.json`
cover the other two. There is no SPA fallback file because the app has no client-side routes.

## Development

`tests/acceptance.test.js` is a jsdom harness that checks the build against the specification —
130 assertions covering seeding, validation, search, type and category filtering, sorting, deletion,
the modal, contact masking, export/import, storage edge cases and contrast ratios:

```bash
npm install jsdom
node tests/acceptance.test.js
```

It is dev-only and not needed to run or host the app.

## Notes

- Listings live in each visitor's own browser. There is no shared database, so two people on two
  machines see two separate boards — that is the intended, explicitly frontend-only design.
- `AUDIT.md` records a line-by-line compliance check against the original build prompt, including the
  four violations it caught and the five intentional deviations.
- `skillbridge-prompt.md` is the prompt that generated this app.
