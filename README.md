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
- **Saved profile** — enter your name and contact once, on your first post, and the form collapses
  from six fields to four (type, skill, category, description). A bar shows `Posting as …` with an
  **Edit** button and a **Not you?** button for shared machines.
- **My listings** — a `Mine` toggle appears once your details are saved, filtering the board to what
  this browser posted. It matches on a stored profile id rather than the display name, so renaming
  yourself does not orphan your older listings.
- **Persistence** — every add and delete writes to `localStorage`, so listings survive refreshes and
  browser restarts. Corrupt or blocked storage degrades to an empty board instead of crashing. The
  saved profile is stored under a separate key and is ignored, not fatal, if it is corrupt.
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

## This is not authentication

The saved profile is a **convenience, not a login**. It is stored in plain `localStorage` under
`skillbridge_profile`, is scoped to one browser, and can be edited or removed from devtools in
seconds. It answers "stop making me retype my details" — it does not answer "who are you".

Real authentication needs a server to verify credentials against, and this app deliberately has none.
Adding a login form on top of `localStorage` would only simulate a login, so the project does not
pretend to have one. If identity ever needs to be real, the path is a backend such as Supabase, which
would also replace `localStorage` with a shared database so different people actually see the same
board.

## Reset the demo data

The board seeds itself with sample listings on first visit only. To start clean, run this in the
browser console:

```js
localStorage.removeItem('skillbridge_listings');
localStorage.removeItem('skillbridge_profile');
location.reload();
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
172 assertions covering seeding, validation, search, type and category filtering, sorting, deletion,
the modal, contact masking, export/import, the saved profile, the Mine filter, storage edge cases and
contrast ratios:

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
