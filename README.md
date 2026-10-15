# SkillBridge

**Live:** <https://akb867.github.io/skillbridge/>

A frontend-only, peer-to-peer **skill exchange board** for a college campus. Post what you can
teach (**Offering**) or what you want to learn (**Looking For**), then search, filter and open a
listing to contact the poster.

No backend, no build step, no dependencies — plain HTML, CSS and vanilla JavaScript. All listings
persist in the browser's `localStorage`.

Six pages share one stylesheet and one core script: the **board**, **My listings**, **Insights**,
**About**, a **permalink** page per listing, and a self-contained **404**.

## Run it

Serve the folder — the pages link to each other with relative URLs, so this works from any host
or straight off the file system:

```bash
python3 -m http.server 3000
# → http://localhost:3000
```

Double-clicking `index.html` also works. The scripts are classic (not ES modules), which is
deliberate: modules are blocked on `file://`.

## Files

| File | Purpose |
|---|---|
| `index.html` | **The board.** Hero with live stats, how-it-works, post form, search toolbar, chips, card grid, details modal |
| `me.html` | **My listings.** Saved profile card, everything this browser posted, export-mine |
| `insights.html` | **Insights.** Supply-vs-demand table per category, biggest gaps, suggested request↔offer pairings |
| `listing.html` | **Permalink.** One listing at `?id=…`, full description, gated contact, delete-if-mine |
| `about.html` | **About.** What the app is, how it was built, what it deliberately does not do |
| `404.html` | Not-found page. Self-contained (inline styles, no JS) because Pages serves it at an arbitrary depth |
| `style.css` | One shared theme: CSS custom properties, responsive 1→4 column grid, AA-compliant contrast |
| `core.js` | Shared layer → `window.SkillBridge`. Storage, profile, seeding, escaping, dates, analytics, and the UI factories every page reuses (banner, contact gate, cards, delete confirm, nav) |
| `app.js` | Board logic only: hero stats, validation, live search + filters, chips, sorting, modal, export/import |
| `me.js` `insights.js` `listing.js` `page.js` | One small script per page; `page.js` just boots the shared core for content-only pages |

Pages share state through `localStorage`, which is origin-scoped — so the board, the profile and the
counts stay in sync across pages with no messaging between them.

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
- **A board that explains itself** — the landing page opens on live counts (skills offered, skills
  wanted, people posting, categories in use) rather than straight into a form, and names the biggest
  unmet demand with a one-click button that prefills the form to offer it.
- **Insights** — supply vs demand per category with a balance bar, the categories people are asking
  for that nobody offers, and request↔offer pairings scored on keyword overlap and shared category.
  It is honest about its own limits: simple token matching, computed from this browser's data only.
- **Permalinks** — every listing has its own URL (`listing.html?id=…`) that renders the full
  description and its own gated contact block, so the browser's back button works and a listing can
  be linked from elsewhere in the site. See the caveat under **Notes**.
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
only the root-level `.html`, `.css` and `.js` files into `_site/`, so `tests/` and `node_modules/` are
never published (confirmed: `/tests/…`, `/package.json` and `/node_modules/` all return 404 on the live
site). The staging step then asserts every one of the thirteen site files is present and fails the
build rather than silently shipping a page that would 404.

The app is 100% static, so any free static host works. Config for four of them is already in the repo.

### Netlify Drop — fastest, no account setup first
Build the bundle, then drag it onto <https://app.netlify.com/drop>. Live in about ten seconds on a
`*.netlify.app` URL.

```bash
zip -r skillbridge-deploy.zip ./*.html ./*.css ./*.js README.md
```

The zip is gitignored, so a fresh clone builds its own rather than shipping a stale one.

### GitHub Pages — best if you want the repo public anyway
1. Push this folder to a GitHub repository (branch `main`).
2. **Settings → Pages → Source: GitHub Actions**.
3. The workflow at `.github/workflows/pages.yml` deploys on every push. It stages every root-level
   `.html`, `.css` and `.js` file plus `README.md` into `_site/`, checks the expected file list is
   complete, and publishes that — so `tests/` and `node_modules/` never reach Pages.

### Vercel
`vercel.json` is included. Either import the repo at <https://vercel.com/new>, or from this folder:

```bash
npx vercel --prod
```

### Cloudflare Pages
Create a project pointing at the repo with **build command left empty** and **output directory `.`**.
For a direct upload instead, build the zip as shown under Netlify Drop and upload it at
*Workers & Pages → Create → Upload assets*.

`_headers` is picked up automatically by Netlify and Cloudflare Pages; `netlify.toml` and `vercel.json`
cover the other two. There is no SPA fallback because these are real pages, not client-side routes;
`404.html` handles bad addresses instead.

## Development

`tests/acceptance.test.js` is a jsdom harness that checks the build against the specification —
254 assertions covering seeding, validation, search, type and category filtering, sorting,
deletion, the modal, contact masking, export/import, the saved profile, the Mine filter, storage edge
cases, every page booting cleanly, the shared nav, the hero stats, My listings, Insights, permalinks,
the 404 page and 31 contrast ratios.

The harness boots a page by reading its `<script src>` tags and evaluating them in order, exactly as a
browser would — so a page that references a missing script fails the suite rather than passing
silently:

```bash
npm install jsdom
node tests/acceptance.test.js
```

It is dev-only and not needed to run or host the app.

## Notes

- Listings live in each visitor's own browser. There is no shared database, so two people on two
  machines see two separate boards — that is the intended, explicitly frontend-only design.
- **Permalinks are browser-local for the same reason.** `listing.html?id=…` resolves against
  `localStorage`, so a link you copy works in your browser and shows an explanatory not-found page in
  anyone else's. They exist for the back button and for linking around the site, not for sharing
  across devices — the not-found page says exactly this rather than pretending otherwise.
- `AUDIT.md` records a line-by-line compliance check against the original build prompt, including the
  four violations it caught and the six intentional deviations.
- `skillbridge-prompt.md` is the prompt that generated this app.
