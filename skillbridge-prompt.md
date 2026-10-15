# SkillBridge — Implementation Prompt

Build **SkillBridge**, a frontend-only, peer-to-peer skill exchange bulletin board for a college campus.
Users post skills they can **teach** ("Offering") or skills they want to **learn** ("Looking For"), and
others can search, filter, and open a listing to connect with the poster.

Deliver complete, production-ready code. No scaffolding, no pseudocode, no TODOs.

---

## 1. Hard Constraints

- **Stack:** Plain HTML5, CSS3, and vanilla JavaScript (ES6+). No frameworks, no build tools, no bundlers, no transpilers.
- **Zero dependencies:** No external CSS frameworks, icon fonts, CDNs, or npm packages. The app must work fully offline when `index.html` is opened directly in a browser.
- **No backend, no server, no API calls, no database.** All data lives in `localStorage`.
- **Files:** Exactly three, at the project root:
  - `index.html`
  - `style.css`
  - `script.js`
- **Do not add** authentication, accounts, ratings/reviews, chat/messaging, payments, categories beyond the list in §4, dark mode, PWA/service worker, animations beyond simple transitions, or any other feature not specified below.

---

## 2. Data Model

Each listing is one object stored in an array under the `localStorage` key `skillbridge_listings`.

```js
{
  id: "string",        // crypto.randomUUID(), fallback to Date.now() + random
  name: "string",      // poster's name
  type: "offering" | "lookingfor",
  skill: "string",     // the skill title, e.g. "Python"
  category: "string",  // one of the fixed values in §4
  description: "string", // brief details
  contact: "string",   // email or phone, used by the Connect action
  createdAt: "number"  // Date.now()
}
```

**Seed data:** on first load only (when the key is absent — not when it is an empty array), populate
8–10 realistic demo listings spread across both types and several categories, e.g. "Offering — C
Programming", "Looking For — Statistics", "Offering — Public Speaking", "Looking For — Operating
Systems scheduling". Seeds must be deletable like any other listing.

**Storage rules:** wrap every `localStorage` read in `try/catch`; on parse failure, reset to an empty
array rather than crashing. Write to storage on every add and every delete.

---

## 3. Page Layout

A single page, top to bottom:

1. **Header** — app name "SkillBridge", one-line tagline ("Find a peer. Share a skill."), and a live
   count showing `X listings`.
2. **Post a Skill form** (a `<form>` in a card, see §4).
3. **Toolbar** — search input on the left; three filter buttons on the right (see §5).
4. **Results meta line** — "Showing N of M listings".
5. **Listings grid** — responsive card grid (see §6).
6. **Footer** — one short line only.

Semantic markup throughout: `<header>`, `<main>`, `<section>`, `<article>`, `<footer>`, proper `<label for>`,
and `<button>` (not clickable `<div>`) for all actions.

---

## 4. Post a Skill Form

A single HTML form that collects both listing types. Fields:

| Field | Control | Rules |
|---|---|---|
| Full name | `<input type="text">` | Required, max 60 chars |
| Listing type | Two radio buttons: **Offering** / **Looking For** | Required, "Offering" preselected |
| Skill | `<input type="text">` | Required, max 60 chars, placeholder "e.g. Python, Calculus, Graphic Design" |
| Category | `<select>` | Required. Options: Programming, Web Development, Data & AI, Mathematics, Science, Design & Media, Music & Arts, Languages, Academics & Exams, Soft Skills, Other |
| Description | `<textarea rows="3">` | Required, max 240 chars, with a live character counter |
| Contact | `<input type="email">` **and** `<input type="tel">` side by side | Exactly one required — the user fills email *or* phone, not both, not neither |

Behaviour:

- On submit, `preventDefault()`, validate, then append the new listing, save to `localStorage`, re-render,
  and reset the form.
- Validation errors must appear as inline messages under the offending field (plus `aria-invalid` and a red
  border) — never `alert()`. Clear a field's error as soon as the user corrects it.
- After a successful post, show a dismissible inline success banner ("Listing posted ✓") and scroll the new
  card into view.
- Duplicate guard: if an identical `name` + `type` + `skill` (case-insensitive) already exists, reject with
  the message "You've already posted this skill."

---

## 5. Search and Filtering

- **Live search:** one `<input type="search">` that filters on every `input` event — no submit, no page
  reload, no Enter needed. Debounce ~150 ms.
- **Match scope:** case-insensitive substring match across `skill`, `description`, `category`, and `name`.
  Support multiple space-separated keywords (all must match, AND logic).
- **Filter buttons:** three mutually exclusive toggles — `All` (default), `Offering`, `Looking For`.
  Style the active one distinctly and set `aria-pressed`.
- Search term and active filter combine (AND). Changing either re-renders the grid instantly.
- **Empty state:** when nothing matches, hide the grid and show a centred message with the current query
  ("No listings match 'python' in Offering") plus a **Clear filters** button that resets both search and
  filter.

---

## 6. Listing Cards

CSS Grid: 1 column on mobile, 2 on tablet (≥640px), 3–4 on desktop (≥1024px). Equal-height cards.

Each card shows:

- A **type badge** — "Offering" in green, "Looking For" in amber/blue — plus a left border or accent in the
  same colour so the two buckets are scannable at a glance.
- **Skill** as the card title (prominent).
- **Category** as a small muted chip.
- **Description**, clamped to 3 lines with an ellipsis (`-webkit-line-clamp`).
- **Poster**: "by {name}" and a relative timestamp ("just now", "5 min ago", "2 days ago").
- Two buttons in the card footer:
  - **View Details** → opens the modal (§7).
  - **Connect** → opens the same modal with the contact block already revealed.
- A small **delete** (×) icon button, top-right of the card, with a confirmation step.

---

## 7. Details / Connect Modal

One reusable modal dialog (`<dialog>` or an accessible custom overlay) triggered from a card.

Contains: full skill name, type badge, category, complete untruncated description, poster name, posted date,
and a **contact block** showing the poster's email and/or phone:

- Email renders as a `mailto:` link; phone renders as a `tel:` link.
- A **Copy contact** button that copies the value to the clipboard and shows "Copied ✓" inline for 2 seconds
  (include a fallback for browsers without `navigator.clipboard`).

Close via the × button, the `Esc` key, or clicking the backdrop. Trap focus inside while open, restore focus
to the triggering button on close, and set `role="dialog"` + `aria-modal="true"`.

---

## 8. Design Requirements

- Clean, modern, academic-but-friendly look: system font stack, generous whitespace, rounded cards (12–16px),
  soft shadows, subtle hover lift.
- A restrained palette: neutral light background, one primary accent colour, plus the two type colours
  (green = offering, amber/blue = looking for). Keep contrast WCAG AA compliant.
- Fully responsive down to 320px; touch targets ≥44px.
- CSS custom properties for all colours and spacing so the theme is easy to change.
- Only one `<style>` block location: `style.css`. No inline styles except those JS must set dynamically.

---

## 9. Acceptance Checklist

The build is done when all of the following are true:

1. Opening `index.html` directly in a browser works with no console errors and no server.
2. Submitting the form with valid data adds a card instantly and resets the form.
3. Every invalid submission shows precise inline errors and adds nothing.
4. Refreshing or closing and reopening the browser preserves all listings.
5. Typing "py" narrows the grid live; clearing the input restores it.
6. The Offering / Looking For / All toggles filter correctly, alone and combined with a search term.
7. Deleting a card removes it from both the DOM and `localStorage`.
8. View Details and Connect both open the modal with the correct listing's data and working contact links.
9. The empty state appears when filters match nothing, and "Clear filters" recovers from it.
10. Layout is intact at 320px, 768px, and 1440px widths.
11. Keyboard-only navigation reaches every control, and the modal focus trap works.

Output the three files in full, each in its own code block, with brief section comments in the code.
