/* ═══════════════════════════════════════════════════════════
   SkillBridge — script.js
   Vanilla ES6+. No libraries. All persistence via localStorage.
   Sections:
     1. Constants & state
     2. Storage layer
     3. Seed data
     4. Helpers (escape, relative time)
     5. Rendering
     6. Form validation & submit
     7. Search + filters
     8. Cards (details / connect / delete)
     9. Modal
    10. Init
   ═══════════════════════════════════════════════════════════ */

/* ---------- 1. Constants & state ---------- */
const STORAGE_KEY = 'skillbridge_listings';
const SEARCH_DEBOUNCE_MS = 150;
const CONFIRM_TIMEOUT_MS = 6000;
const COPY_NOTE_MS = 2000;

const state = {
  listings: [],      // all records
  query: '',         // current search text (lower-cased, trimmed)
  filter: 'all',     // 'all' | 'offering' | 'lookingfor'
  category: 'all',   // 'all' | one of the CATEGORY values
  sort: 'newest',    // 'newest' | 'oldest' | 'skill' | 'category'
  pendingDelete: null, // id of the card awaiting delete confirmation
  lastTrigger: null,   // element to restore focus to after modal closes
  modalItem: null,     // listing currently shown in the modal
  contactRevealed: false // whether the modal's contact details are unmasked
};

const TYPE_LABEL = { offering: 'Offering', lookingfor: 'Looking For' };

/* Kept in one place so the <select> in index.html and the import validator agree */
const CATEGORIES = ['Programming', 'Web Development', 'Data & AI', 'Mathematics', 'Science',
  'Design & Media', 'Music & Arts', 'Languages', 'Academics & Exams', 'Soft Skills', 'Other'];

const EXPORT_VERSION = 1;

/* Element references */
const el = {
  liveCount:    document.getElementById('liveCount'),
  form:         document.getElementById('skillForm'),
  banner:       document.getElementById('banner'),
  bannerText:   document.getElementById('bannerText'),
  bannerClose:  document.getElementById('bannerClose'),
  name:         document.getElementById('fName'),
  skill:        document.getElementById('fSkill'),
  category:     document.getElementById('fCategory'),
  email:        document.getElementById('fEmail'),
  phone:        document.getElementById('fPhone'),
  description:  document.getElementById('fDescription'),
  descCounter:  document.getElementById('descCounter'),
  resetForm:    document.getElementById('resetForm'),
  search:       document.getElementById('searchInput'),
  filterBtns:   Array.from(document.querySelectorAll('.filter-btn')),
  resultsMeta:  document.getElementById('resultsMeta'),
  grid:         document.getElementById('grid'),
  empty:        document.getElementById('emptyState'),
  emptyTitle:   document.getElementById('emptyTitle'),
  emptySub:     document.getElementById('emptySub'),
  clearFilters: document.getElementById('clearFilters'),
  modal:        document.getElementById('detailModal'),
  modalClose:   document.getElementById('modalClose'),
  modalBadge:   document.getElementById('modalBadge'),
  modalTitle:   document.getElementById('modalTitle'),
  modalCategory:document.getElementById('modalCategory'),
  modalDesc:    document.getElementById('modalDesc'),
  modalName:    document.getElementById('modalName'),
  modalDate:    document.getElementById('modalDate'),
  modalContact: document.getElementById('modalContact'),
  copyContact:  document.getElementById('copyContact'),
  copyNote:     document.getElementById('copyNote'),
  modalDone:    document.getElementById('modalDone'),
  chipRow:      document.getElementById('chipRow'),
  sortSelect:   document.getElementById('sortSelect'),
  exportBtn:    document.getElementById('exportBtn'),
  importBtn:    document.getElementById('importBtn'),
  importFile:   document.getElementById('importFile'),
  revealContact:document.getElementById('revealContact'),
  hideContact:  document.getElementById('hideContact'),
  contactActions:document.getElementById('contactActions'),
  contactNote:  document.getElementById('contactNote')
};

/* ---------- 2. Storage layer ---------- */
/* Reads are always guarded: corrupt or blocked storage degrades to an empty board. */
function loadListings() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    console.warn('SkillBridge: localStorage unavailable — running in memory only.', err);
    return [];
  }

  if (raw === null) {          // first ever visit → seed the board
    const seeded = seedListings();
    saveListings(seeded);
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Stored data is not an array.');
    return parsed.filter(isValidListing);
  } catch (err) {
    console.warn('SkillBridge: saved data was unreadable, resetting the board.', err);
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* ignore */ }
    return [];
  }
}

function saveListings(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('SkillBridge: could not save to localStorage.', err);
    showBanner('Heads up — this browser is blocking storage, so listings will disappear on refresh.', 'error');
  }
}

function isValidListing(item) {
  return Boolean(item)
    && typeof item === 'object'
    && typeof item.id === 'string'
    && (item.type === 'offering' || item.type === 'lookingfor')
    && typeof item.skill === 'string';
}

function newId() {
  if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

/* ---------- 3. Seed data ---------- */
/* Only created when the storage key does not exist yet, never when it is an empty array. */
function seedListings() {
  const MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;
  const now = Date.now();

  const seeds = [
    ['Ananya Rao', 'offering', 'C Programming', 'Programming',
     'Pointers, arrays and the semester-2 lab programs. I walk through 3 previous-year questions every session.',
     'ananya.rao@college.edu', '', 22 * MIN],
    ['Rohit Menon', 'lookingfor', 'Statistics', 'Mathematics',
     'Need help with probability distributions and hypothesis testing before the mid-sem. Weekday evenings work best.',
     '', '+91 98450 12345', 2 * HOUR],
    ['Fatima Sheikh', 'offering', 'Public Speaking', 'Soft Skills',
     'Debating society secretary. 30-minute mock sessions with feedback on structure, pacing and filler words.',
     'fatima.s@college.edu', '', 5 * HOUR],
    ['Karthik S', 'lookingfor', 'Operating Systems — CPU Scheduling', 'Science',
     'Round-robin and multilevel queue numericals are confusing me. Looking for someone who can solve a few with me.',
     'karthik.s@college.edu', '', 9 * HOUR],
    ['Meera Iyer', 'offering', 'Python for Beginners', 'Data & AI',
     'From loops to pandas. Small group, twice a week in the library reading room. No prior coding needed.',
     '', '+91 99001 45678', 1 * DAY],
    ['Devansh Patel', 'lookingfor', 'Calculus', 'Mathematics',
     'Limits, derivatives and integration for the first-year common exam. Happy to meet on campus any afternoon.',
     'devansh.p@college.edu', '', 2 * DAY],
    ['Sneha Kulkarni', 'offering', 'Graphic Design (Figma + Illustrator)', 'Design & Media',
     'Poster and social-media design for college fests. I will share my workflow and templates.',
     'sneha.k@college.edu', '', 3 * DAY],
    ['Arjun Nair', 'lookingfor', 'Java — Loops and OOP Basics', 'Programming',
     'Stuck on nested loops and inheritance. Looking for a patient peer for two or three sittings.',
     '', '+91 88672 90011', 4 * DAY],
    ['Priya Deshpande', 'offering', 'Spoken English & Group Discussion', 'Languages',
     'Practice rounds for placement GDs, plus pronunciation and fluency drills. Weekend batches open.',
     'priya.d@college.edu', '', 6 * DAY]
  ];

  return seeds.map(([name, type, skill, category, description, email, phone, ago]) => ({
    id: newId(),
    name, type, skill, category, description, email, phone,
    createdAt: now - ago
  }));
}

/* ---------- 4. Helpers ---------- */
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function relativeTime(ts) {
  const diff = Date.now() - Number(ts);
  if (!Number.isFinite(diff) || diff < 0) return 'just now';
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + (m === 1 ? ' min ago' : ' mins ago');
  const h = Math.floor(m / 60);
  if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
  const d = Math.floor(h / 24);
  if (d < 7) return d + (d === 1 ? ' day ago' : ' days ago');
  const w = Math.floor(d / 7);
  if (w < 5) return w + (w === 1 ? ' week ago' : ' weeks ago');
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function fullDate(ts) {
  return new Date(ts).toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit'
  });
}

function debounce(fn, wait) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

function showBanner(message, kind = 'success') {
  el.bannerText.textContent = message;
  el.banner.className = 'banner banner--' + kind;
  el.banner.hidden = false;
  clearTimeout(showBanner._t);
  showBanner._t = setTimeout(hideBanner, 6000);
}

function hideBanner() {
  el.banner.hidden = true;
  clearTimeout(showBanner._t);
}

/* ---------- 5. Rendering ---------- */
function visibleListings() {
  const terms = state.query.split(/\s+/).filter(Boolean); // AND logic across keywords

  const matched = state.listings
    .filter(item => state.filter === 'all' || item.type === state.filter)
    .filter(item => state.category === 'all' || item.category === state.category)
    .filter(item => {
      if (!terms.length) return true;
      const haystack = [item.skill, item.description, item.category, item.name]
        .filter(Boolean).join(' ').toLowerCase();
      return terms.every(term => haystack.includes(term));
    });

  return sortListings(matched, state.sort);
}

function sortListings(list, mode) {
  const byText = (a, b, key) =>
    String(a[key] || '').localeCompare(String(b[key] || ''), undefined, { sensitivity: 'base' });

  switch (mode) {
    case 'oldest':   return list.slice().sort((a, b) => a.createdAt - b.createdAt);
    case 'skill':    return list.slice().sort((a, b) => byText(a, b, 'skill'));
    case 'category': return list.slice().sort((a, b) => byText(a, b, 'category') || byText(a, b, 'skill'));
    case 'newest':
    default:         return list.slice().sort((a, b) => b.createdAt - a.createdAt);
  }
}

function render(newIdToHighlight) {
  const shown = visibleListings();
  const total = state.listings.length;

  /* Header + meta counts */
  el.liveCount.textContent = total + (total === 1 ? ' listing' : ' listings');
  el.resultsMeta.textContent =
    'Showing ' + shown.length + ' of ' + total + (total === 1 ? ' listing' : ' listings');

  /* Category chips reflect the type filter, so counts stay meaningful */
  renderChips();

  /* Grid */
  el.grid.innerHTML = shown.map(cardHTML).join('');
  el.grid.hidden = shown.length === 0;

  /* Empty state */
  const isFiltering = Boolean(state.query) || state.filter !== 'all' || state.category !== 'all';
  el.empty.hidden = shown.length !== 0;

  if (shown.length === 0) {
    if (total === 0) {
      el.emptyTitle.textContent = 'No listings yet';
      el.emptySub.textContent = 'Be the first to post a skill — the board above takes 20 seconds.';
      el.clearFilters.hidden = true;
    } else if (isFiltering) {
      el.emptyTitle.textContent = 'Nothing matches your filters';
      const scope = scopeDescription();
      el.emptySub.innerHTML = state.query
        ? 'No ' + escapeHTML(scope) + ' matched <q>' + escapeHTML(state.query) + '</q>.'
        : 'Nothing has been posted under <q>' + escapeHTML(scope) + '</q> yet.';
      el.clearFilters.hidden = false;
    } else {
      el.emptyTitle.textContent = 'No listings yet';
      el.emptySub.textContent = 'Be the first to post a skill.';
      el.clearFilters.hidden = true;
    }
  }

  /* Highlight + scroll to a freshly added card */
  if (newIdToHighlight) {
    const card = el.grid.querySelector('[data-id="' + cssEscape(newIdToHighlight) + '"]');
    if (card) {
      card.classList.add('is-new');
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => card.classList.remove('is-new'), 500);
    }
  }
}

function cssEscape(value) {
  return window.CSS && CSS.escape ? CSS.escape(value) : String(value).replace(/["\\]/g, '\\$&');
}

/* "Offering listings in Programming" — used by the empty state */
function scopeDescription() {
  const parts = [];
  if (state.filter !== 'all') parts.push(TYPE_LABEL[state.filter]);
  if (state.category !== 'all') parts.push(state.category);
  if (!parts.length) return 'listings';
  if (parts.length === 1) return parts[0] + ' listings';
  return parts[0] + ' listings in ' + parts[1];
}

function renderChips() {
  const pool = state.listings.filter(item => state.filter === 'all' || item.type === state.filter);
  const counts = new Map();
  pool.forEach(item => {
    const cat = item.category || 'Other';
    counts.set(cat, (counts.get(cat) || 0) + 1);
  });

  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  /* Keep the active chip on screen even when the type filter has nothing in it */
  if (state.category !== 'all' && !counts.has(state.category)) ordered.unshift([state.category, 0]);

  const chip = (label, value, count) => {
    const active = state.category === value;
    return '<button type="button" class="chip-btn' + (active ? ' is-active' : '') + '"' +
      ' data-category="' + escapeHTML(value) + '" aria-pressed="' + active + '">' +
      escapeHTML(label) +
      (count === null ? '' : '<span class="chip-count">' + count + '</span>') +
      '</button>';
  };

  el.chipRow.innerHTML = chip('All categories', 'all', null) +
    ordered.map(([cat, n]) => chip(cat, cat, n)).join('');
  el.chipRow.hidden = ordered.length === 0;
}

function cardHTML(item) {
  return (
    '<article class="card card--' + item.type + '" data-id="' + escapeHTML(item.id) + '">' +
      '<div class="card-top">' +
        '<span class="badge badge--' + item.type + '">' + TYPE_LABEL[item.type] + '</span>' +
        '<button type="button" class="card-delete" data-action="delete" ' +
          'aria-label="Delete listing: ' + escapeHTML(item.skill) + '">&times;</button>' +
      '</div>' +

      '<h3 class="card-title">' + escapeHTML(item.skill) + '</h3>' +
      '<span class="chip">' + escapeHTML(item.category || 'Other') + '</span>' +
      '<p class="card-desc">' + escapeHTML(item.description || '') + '</p>' +

      '<p class="card-by">by <strong>' + escapeHTML(item.name) + '</strong>' +
        '<span class="dot" aria-hidden="true"></span>' +
        '<time datetime="' + new Date(item.createdAt).toISOString() + '">' +
          escapeHTML(relativeTime(item.createdAt)) + '</time></p>' +

      '<div class="card-actions">' +
        '<button type="button" class="btn btn-primary btn-sm" data-action="details">View Details</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="connect">Connect</button>' +
      '</div>' +
    '</article>'
  );
}

/* ---------- 6. Form validation & submit ---------- */
function setError(field, errorEl, message) {
  if (message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
    if (field) field.setAttribute('aria-invalid', 'true');
  } else {
    errorEl.textContent = '';
    errorEl.hidden = true;
    if (field) field.removeAttribute('aria-invalid');
  }
}

function errEl(id) { return document.getElementById(id); }

function validateForm() {
  const errors = [];
  const name = el.name.value.trim();
  const skill = el.skill.value.trim();
  const category = el.category.value;
  const description = el.description.value.trim();
  const email = el.email.value.trim();
  const phone = el.phone.value.trim();
  const type = (el.form.querySelector('input[name="type"]:checked') || {}).value;

  setError(el.name, errEl('err-fName'),
    name ? '' : 'Please enter your name.');
  if (!name) errors.push(el.name);

  setError(el.skill, errEl('err-fSkill'),
    skill ? '' : 'Which skill is this about?');
  if (!skill) errors.push(el.skill);

  setError(null, errEl('err-type'), type ? '' : 'Choose Offering or Looking For.');
  if (!type) errors.push(el.form.querySelector('input[name="type"]'));

  setError(el.category, errEl('err-fCategory'),
    category ? '' : 'Pick a category so people can filter for it.');
  if (!category) errors.push(el.category);

  setError(el.description, errEl('err-fDescription'),
    description ? '' : 'Add a short description (what, when, where).');
  if (!description) errors.push(el.description);

  /* Contact: exactly one of email / phone, and it must look valid */
  let contactError = '';
  if (!email && !phone) {
    contactError = 'Add an email or a phone number so people can reach you.';
  } else if (email && phone) {
    contactError = 'Use either email or phone — not both.';
  } else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    contactError = 'That email looks incomplete (e.g. you@college.edu).';
  } else if (phone && (phone.replace(/\D/g, '').length < 7 || phone.replace(/\D/g, '').length > 15)) {
    contactError = 'That phone number looks incomplete (7–15 digits).';
  }
  setError(el.email, errEl('err-contact'), contactError);
  setError(el.phone, errEl('err-contact'), contactError);
  if (contactError) errors.push(email && phone ? el.phone : (el.email || el.phone));

  return errors;
}

function isDuplicate(candidate) {
  const key = item => (item.name + '|' + item.type + '|' + item.skill).trim().toLowerCase();
  const target = key(candidate);
  return state.listings.some(item => key(item) === target);
}

el.form.addEventListener('submit', event => {
  event.preventDefault();
  hideBanner();

  const invalidFields = validateForm();
  if (invalidFields.length) {
    invalidFields[0].focus();
    showBanner('Please fix the highlighted fields.', 'error');
    return;
  }

  const record = {
    id: newId(),
    name: el.name.value.trim(),
    type: el.form.querySelector('input[name="type"]:checked').value,
    skill: el.skill.value.trim(),
    category: el.category.value,
    description: el.description.value.trim(),
    email: el.email.value.trim(),
    phone: el.phone.value.trim(),
    createdAt: Date.now()
  };

  if (isDuplicate(record)) {
    setError(el.skill, errEl('err-fSkill'), "You've already posted this skill.");
    el.skill.focus();
    showBanner("You've already posted this skill.", 'error');
    return;
  }

  state.listings.push(record);
  saveListings(state.listings);

  /* Keep the current view useful: drop a "Looking For" post while filtering "Offering"
     would otherwise vanish silently. */
  if (state.filter !== 'all' && state.filter !== record.type) state.filter = 'all';
  if (state.category !== 'all' && state.category !== record.category) state.category = 'all';
  syncFilterButtons();
  state.query = '';
  el.search.value = '';

  el.form.reset();
  updateCounter();
  clearAllErrors();
  render(record.id);
  showBanner('Listing posted \u2713 — it is saved in this browser.', 'success');
});

el.resetForm.addEventListener('click', () => {
  el.form.reset();
  updateCounter();
  clearAllErrors();
  hideBanner();
  el.name.focus();
});

function clearAllErrors() {
  ['err-fName', 'err-fSkill', 'err-type', 'err-fCategory', 'err-fDescription', 'err-contact']
    .forEach(id => { const node = errEl(id); if (node) { node.textContent = ''; node.hidden = true; } });
  [el.name, el.skill, el.category, el.description, el.email, el.phone]
    .forEach(field => field.removeAttribute('aria-invalid'));
}

/* Clear a field's error the moment it becomes valid again */
[el.name, el.skill, el.category, el.description].forEach(field => {
  field.addEventListener('input', () => {
    if (field.value.trim()) setError(field, errEl('err-' + field.id), '');
  });
});
el.category.addEventListener('change', () => {
  if (el.category.value) setError(el.category, errEl('err-fCategory'), '');
});
[el.email, el.phone].forEach(field => {
  field.addEventListener('input', () => setError(field, errEl('err-contact'), ''));
});

/* Live character counter */
function updateCounter() {
  const len = el.description.value.length;
  el.descCounter.textContent = len + ' / 240';
  el.descCounter.classList.toggle('is-full', len >= 240);
}
el.description.addEventListener('input', updateCounter);

/* ---------- 7. Search + filters ---------- */
const onSearch = debounce(() => {
  state.query = el.search.value.trim().toLowerCase();
  render();
}, SEARCH_DEBOUNCE_MS);
el.search.addEventListener('input', onSearch);

el.filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    state.filter = btn.dataset.filter;
    syncFilterButtons();
    render();
  });
});

function syncFilterButtons() {
  el.filterBtns.forEach(btn => {
    const active = btn.dataset.filter === state.filter;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

/* Category chips (event delegation — the row is re-rendered on every change) */
el.chipRow.addEventListener('click', event => {
  const chip = event.target.closest('.chip-btn');
  if (!chip) return;
  state.category = chip.dataset.category;
  render();
});

el.sortSelect.addEventListener('change', () => {
  state.sort = el.sortSelect.value;
  render();
});

el.clearFilters.addEventListener('click', () => {
  state.query = '';
  state.filter = 'all';
  state.category = 'all';
  el.search.value = '';
  syncFilterButtons();
  render();
  el.search.focus();
});

el.bannerClose.addEventListener('click', hideBanner);

/* ---------- 8. Cards: details / connect / delete ---------- */
el.grid.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const card = button.closest('.card');
  const item = state.listings.find(l => l.id === card.dataset.id);
  if (!item) return;

  switch (button.dataset.action) {
    case 'details':
      openModal(item, button, false);
      break;
    case 'connect':
      openModal(item, button, true);
      break;
    case 'delete':
      askDelete(item, card);
      break;
    case 'confirm-yes':
      deleteListing(item);
      break;
    case 'confirm-no':
      closeConfirm();
      card.querySelector('[data-action="delete"]').focus();
      break;
  }
});

/* Inline two-step delete confirmation (no blocking native dialog) */
function askDelete(item, card) {
  if (state.pendingDelete === item.id) { closeConfirm(); return; }
  closeConfirm();
  state.pendingDelete = item.id;

  const confirm = document.createElement('div');
  confirm.className = 'confirm';
  confirm.setAttribute('role', 'alertdialog');
  confirm.setAttribute('aria-label', 'Confirm delete');
  confirm.innerHTML =
    '<span>Delete this listing?</span>' +
    '<span class="confirm-actions">' +
      '<button type="button" class="confirm-yes" data-action="confirm-yes">Delete</button>' +
      '<button type="button" class="confirm-no" data-action="confirm-no">Cancel</button>' +
    '</span>';
  card.appendChild(confirm);
  confirm.querySelector('.confirm-yes').focus();

  clearTimeout(askDelete._t);
  askDelete._t = setTimeout(closeConfirm, CONFIRM_TIMEOUT_MS);
}

function closeConfirm() {
  clearTimeout(askDelete._t);
  state.pendingDelete = null;
  const open = el.grid.querySelector('.confirm');
  if (open) open.remove();
}

function deleteListing(item) {
  state.listings = state.listings.filter(l => l.id !== item.id);
  saveListings(state.listings);
  closeConfirm();
  render();
  showBanner('Deleted “' + item.skill + '”.', 'success');
}

/* Clicking anywhere outside an open confirm dismisses it */
document.addEventListener('click', event => {
  if (state.pendingDelete && !event.target.closest('.confirm') && !event.target.closest('[data-action="delete"]')) {
    closeConfirm();
  }
});

/* ---------- 8b. Export / import (data portability) ---------- */
function buildExportPayload() {
  return {
    app: 'SkillBridge',
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    count: state.listings.length,
    listings: state.listings
  };
}

function exportJSON() {
  const text = JSON.stringify(buildExportPayload(), null, 2);
  const filename = 'skillbridge-' + new Date().toISOString().slice(0, 10) + '.json';

  /* Prefer a Blob URL; fall back to a data: URL where Blob is unavailable. */
  let href = 'data:application/json;charset=utf-8,' + encodeURIComponent(text);
  let objectUrl = null;
  try {
    if (typeof Blob === 'function' && typeof URL.createObjectURL === 'function') {
      objectUrl = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      href = objectUrl;
    }
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    showBanner('Exported ' + state.listings.length +
      (state.listings.length === 1 ? ' listing' : ' listings') + ' to ' + filename + '.', 'success');
  } catch (err) {
    console.info(text);
    showBanner('This browser blocked the download — the JSON is printed in the console instead.', 'error');
  } finally {
    if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}

/* Accept anything reasonable, reject anything that is not a listing */
function normaliseListing(entry) {
  if (!entry || typeof entry !== 'object') return null;

  const type = entry.type === 'offering' || entry.type === 'lookingfor' ? entry.type : null;
  const skill = typeof entry.skill === 'string' ? entry.skill.trim().slice(0, 60) : '';
  const name = typeof entry.name === 'string' ? entry.name.trim().slice(0, 60) : '';
  if (!type || !skill || !name) return null;

  return {
    id: typeof entry.id === 'string' && entry.id ? entry.id : newId(),
    name,
    type,
    skill,
    category: CATEGORIES.includes(entry.category) ? entry.category : 'Other',
    description: typeof entry.description === 'string' ? entry.description.slice(0, 240) : '',
    email: typeof entry.email === 'string' ? entry.email.trim() : '',
    phone: typeof entry.phone === 'string' ? entry.phone.trim() : '',
    createdAt: Number.isFinite(Number(entry.createdAt)) ? Number(entry.createdAt) : Date.now()
  };
}

/* Merge-import: existing listings win, duplicates are skipped, never overwrites */
function handleImportText(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: 'That file is not valid JSON.' };
  }

  const raw = Array.isArray(data)
    ? data
    : (data && Array.isArray(data.listings) ? data.listings : null);

  if (!raw) return { ok: false, error: 'No listings array found in that file.' };
  if (!raw.length) return { ok: false, error: 'That file contains no listings.' };

  const identity = item => (item.name + '|' + item.type + '|' + item.skill).trim().toLowerCase();
  const seen = new Set(state.listings.map(identity));
  const knownIds = new Set(state.listings.map(item => item.id));

  let added = 0, skipped = 0;
  raw.forEach(entry => {
    const item = normaliseListing(entry);
    if (!item || knownIds.has(item.id) || seen.has(identity(item))) { skipped++; return; }
    knownIds.add(item.id);
    seen.add(identity(item));
    state.listings.push(item);
    added++;
  });

  if (added) saveListings(state.listings);
  return { ok: true, added, skipped };
}

el.exportBtn.addEventListener('click', exportJSON);
el.importBtn.addEventListener('click', () => el.importFile.click());

el.importFile.addEventListener('change', () => {
  const file = el.importFile.files && el.importFile.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const result = handleImportText(String(reader.result));
    if (!result.ok) {
      showBanner(result.error, 'error');
    } else {
      /* A fresh board may not match the current filters — show what was imported */
      if (!addedIsVisible(result)) { state.query = ''; state.filter = 'all'; state.category = 'all'; el.search.value = ''; syncFilterButtons(); }
      render();
      showBanner('Imported ' + result.added +
        (result.added === 1 ? ' listing' : ' listings') +
        (result.skipped ? ' — skipped ' + result.skipped + ' duplicate or invalid.' : '.'), 'success');
    }
    el.importFile.value = '';   // so re-picking the same file still fires change
  };
  reader.onerror = () => showBanner('Could not read that file.', 'error');
  reader.readAsText(file);
});

function addedIsVisible(result) {
  return result.added > 0 && visibleListings().length > 0;
}

/* ---------- 9. Modal ---------- */
function openModal(item, trigger, revealContact) {
  state.lastTrigger = trigger || null;

  el.modalBadge.className = 'badge badge--' + item.type;
  el.modalBadge.textContent = TYPE_LABEL[item.type];
  el.modalTitle.textContent = item.skill;
  el.modalCategory.textContent = item.category || 'Other';
  el.modalDesc.textContent = item.description || '—';
  el.modalName.textContent = item.name;
  el.modalDate.textContent = fullDate(item.createdAt) + ' · ' + relativeTime(item.createdAt);

  /* Contact starts masked on every open — see revealContactDetails() */
  state.modalItem = item;
  hideContactDetails();

  /* <dialog> where supported; manual overlay elsewhere. Either way focus the
     contact block when opened via "Connect". */
  let opened = false;
  try {
    if (typeof el.modal.showModal === 'function') { el.modal.showModal(); opened = true; }
  } catch (err) { opened = false; }

  if (!opened) {
    el.modal.setAttribute('open', '');
    el.modal.classList.add('is-open-fallback');
  }

  /* "Connect" is an explicit intent to make contact, so it unmasks immediately */
  if (revealContact) revealContactDetails();

  const focusTarget = revealContact
    ? (el.modalContact.querySelector('a') || el.copyContact)
    : el.modalClose;
  if (focusTarget) setTimeout(() => focusTarget.focus(), 30);
}

/* Masked by default: no mailto:/tel: href exists in the DOM until the user asks for it */
function hideContactDetails() {
  state.contactRevealed = false;
  el.modalContact.innerHTML = '';
  el.modalContact.hidden = true;
  el.contactActions.hidden = true;
  el.contactNote.hidden = false;
  el.revealContact.hidden = false;
  el.copyNote.hidden = true;
  /* The copy button caches the value in a data attribute — that is still the raw
     contact string sitting in the DOM, so it has to be scrubbed too. */
  delete el.copyContact.dataset.value;
  el.copyContact.disabled = true;
}

function revealContactDetails() {
  const item = state.modalItem;
  if (!item) return;

  const parts = [];
  if (item.email) {
    parts.push('<span><span class="contact-kind">Email</span>' +
      '<a href="mailto:' + escapeHTML(item.email) + '">' + escapeHTML(item.email) + '</a></span>');
  }
  if (item.phone) {
    parts.push('<span><span class="contact-kind">Phone</span>' +
      '<a href="tel:' + escapeHTML(item.phone.replace(/[^\d+]/g, '')) + '">' +
      escapeHTML(item.phone) + '</a></span>');
  }

  el.modalContact.innerHTML = parts.join('') ||
    '<span class="contact-kind">No contact details were saved with this listing.</span>';
  el.modalContact.hidden = false;
  el.contactNote.hidden = true;
  el.revealContact.hidden = true;
  el.contactActions.hidden = parts.length === 0;

  el.copyNote.hidden = true;
  el.copyContact.dataset.value = item.email || item.phone || '';
  el.copyContact.disabled = !el.copyContact.dataset.value;
  state.contactRevealed = true;
}

el.revealContact.addEventListener('click', () => {
  revealContactDetails();
  const first = el.modalContact.querySelector('a');
  if (first) first.focus();
});

el.hideContact.addEventListener('click', () => {
  hideContactDetails();
  el.revealContact.focus();
});

function closeModal() {
  try {
    if (typeof el.modal.close === 'function' && el.modal.open) { el.modal.close(); return; }
  } catch (err) { /* fall through to the manual close below */ }
  el.modal.removeAttribute('open');
  el.modal.classList.remove('is-open-fallback');
  restoreFocus();
}

/* Return focus to the control that opened the modal */
function restoreFocus() {
  if (state.lastTrigger && document.contains(state.lastTrigger)) state.lastTrigger.focus();
  state.lastTrigger = null;
  /* Never leave a previous poster's contact details sitting in the DOM */
  state.modalItem = null;
  hideContactDetails();
}

el.modalClose.addEventListener('click', closeModal);
el.modalDone.addEventListener('click', closeModal);

el.modal.addEventListener('close', restoreFocus);

/* Backdrop click closes the dialog */
el.modal.addEventListener('click', event => {
  if (event.target === el.modal) closeModal();
});

/* Copy contact, with a textarea fallback when navigator.clipboard is unavailable */
el.copyContact.addEventListener('click', async () => {
  const value = el.copyContact.dataset.value;
  if (!value) return;

  let ok = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      ok = true;
    }
  } catch (_) { ok = false; }

  if (!ok) {
    const scratch = document.createElement('textarea');
    scratch.value = value;
    scratch.setAttribute('readonly', '');
    scratch.setAttribute('aria-hidden', 'true');
    scratch.className = 'sr-clipboard';
    document.body.appendChild(scratch);
    scratch.select();
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    scratch.remove();
  }

  el.copyNote.hidden = !ok;
  if (ok) {
    clearTimeout(el.copyContact._t);
    el.copyContact._t = setTimeout(() => { el.copyNote.hidden = true; }, COPY_NOTE_MS);
  } else {
    showBanner('Copy was blocked by the browser — select the contact text manually.', 'error');
  }
});

/* Escape also dismisses an open delete confirmation */
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && state.pendingDelete) closeConfirm();
});

/* ---------- 10. Init ---------- */
(function init() {
  state.listings = loadListings();
  updateCounter();
  syncFilterButtons();
  el.sortSelect.value = state.sort;
  hideContactDetails();
  render();
})();
