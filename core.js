/* ═══════════════════════════════════════════════════════════
   SkillBridge — core.js
   Shared layer for every page. Classic script (not a module) so the site also
   works when opened straight from the filesystem, where ES modules are blocked.

   Exposes one global: window.SkillBridge
     .state            shared in-memory state
     .boot()           load listings + profile, wire the nav
     storage/profile   loadListings, saveListings, loadProfile, isMine, …
     helpers           escapeHTML, relativeTime, debounce, listingURL, …
     ui                createBanner, createContactGate, cardHTML
     data              computeStats, categoryBreakdown, findMatches
   ═══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* ---------- Constants ---------- */
  const STORAGE_KEY = 'skillbridge_listings';
  const PROFILE_KEY = 'skillbridge_profile';
  const SEARCH_DEBOUNCE_MS = 150;
  const CONFIRM_TIMEOUT_MS = 6000;
  const COPY_NOTE_MS = 2000;
  const EXPORT_VERSION = 1;

  const TYPE_LABEL = { offering: 'Offering', lookingfor: 'Looking For' };

  /* Single source of truth: the <select> on every page and the import validator agree */
  const CATEGORIES = ['Programming', 'Web Development', 'Data & AI', 'Mathematics', 'Science',
    'Design & Media', 'Music & Arts', 'Languages', 'Academics & Exams', 'Soft Skills', 'Other'];

  const state = {
    listings: [],
    profile: null,
    query: '',
    filter: 'all',
    category: 'all',
    sort: 'newest',
    onlyMine: false,
    pendingDelete: null,
    lastTrigger: null,
    modalItem: null,
    contactRevealed: false,
    editingProfile: false
  };

  /* Banners are page-level; core only needs a sink so save failures can warn */
  let bannerSink = { show: function () {}, hide: function () {} };
  function setBanner(sink) { if (sink) bannerSink = sink; }

  /* ---------- Storage ---------- */
  /* Every read is guarded: corrupt or blocked storage degrades, never crashes. */
  function loadListings() {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      console.warn('SkillBridge: localStorage unavailable — running in memory only.', err);
      return [];
    }

    if (raw === null) {                 // first ever visit → seed the board
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
      bannerSink.show('Heads up — this browser is blocking storage, so listings will disappear on refresh.', 'error');
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
    if (global.crypto && typeof global.crypto.randomUUID === 'function') return global.crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }

  /* ---------- Saved profile ---------- */
  /* A convenience, not authentication. Plain localStorage, one browser, editable
     from devtools in seconds. It answers "stop making me retype", not "who are you". */
  function loadProfile() {
    let raw;
    try {
      raw = localStorage.getItem(PROFILE_KEY);
    } catch (err) {
      return null;
    }
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') throw new Error('not an object');
      const name = typeof parsed.name === 'string' ? parsed.name.trim() : '';
      if (!name) throw new Error('no name');
      return {
        id: typeof parsed.id === 'string' && parsed.id ? parsed.id : newId(),
        name,
        email: typeof parsed.email === 'string' ? parsed.email.trim() : '',
        phone: typeof parsed.phone === 'string' ? parsed.phone.trim() : '',
        savedAt: Number.isFinite(Number(parsed.savedAt)) ? Number(parsed.savedAt) : Date.now()
      };
    } catch (err) {
      console.warn('SkillBridge: saved profile was unreadable, ignoring it.', err);
      try { localStorage.removeItem(PROFILE_KEY); } catch (_) { /* ignore */ }
      return null;
    }
  }

  function saveProfile(profile) {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch (err) {
      console.warn('SkillBridge: could not save your profile.', err);
    }
  }

  function dropProfile() {
    try { localStorage.removeItem(PROFILE_KEY); } catch (_) { /* ignore */ }
  }

  function isProfiled() {
    return Boolean(state.profile) && !state.editingProfile;
  }

  /* ownerId is authoritative; listings from before the profile existed fall back to
     matching on name plus whichever contact detail is present. */
  function isMine(item) {
    const p = state.profile;
    if (!p || !item) return false;
    if (item.ownerId) return item.ownerId === p.id;

    const sameName = String(item.name || '').trim().toLowerCase() === p.name.trim().toLowerCase();
    if (!sameName) return false;
    if (p.email && item.email) return item.email.trim().toLowerCase() === p.email.trim().toLowerCase();
    if (p.phone && item.phone) return item.phone.replace(/\D/g, '') === p.phone.replace(/\D/g, '');
    return false;
  }

  function initials(name) {
    return String(name).trim().split(/\s+/).slice(0, 2)
      .map(part => part.charAt(0).toUpperCase()).join('') || '?';
  }

  /* ---------- Seed data ---------- */
  /* Created only when the key is absent, never when it holds an empty array. */
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
      ownerId: null,
      createdAt: now - ago
    }));
  }

  /* ---------- Helpers ---------- */
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
    return function () {
      const args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(self, args), wait);
    };
  }

  function cssEscape(value) {
    return global.CSS && global.CSS.escape
      ? global.CSS.escape(value)
      : String(value).replace(/["\\]/g, '\\$&');
  }

  function listingURL(id) {
    return 'listing.html?id=' + encodeURIComponent(id);
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

  /* ---------- Board analytics ---------- */
  function computeStats(listings) {
    const list = listings || state.listings;
    const people = new Set();
    let offering = 0, looking = 0;
    const cats = new Set();

    list.forEach(item => {
      if (item.type === 'offering') offering++; else looking++;
      cats.add(item.category || 'Other');
      const who = String(item.name || '').trim().toLowerCase();
      if (who) people.add(who);
    });

    return {
      total: list.length,
      offering,
      looking,
      categories: cats.size,
      people: people.size
    };
  }

  /* Per-category supply vs demand, sorted by the size of the gap */
  function categoryBreakdown(listings) {
    const list = listings || state.listings;
    const rows = new Map();
    CATEGORIES.forEach(cat => rows.set(cat, { category: cat, offering: 0, looking: 0 }));

    list.forEach(item => {
      const cat = item.category || 'Other';
      if (!rows.has(cat)) rows.set(cat, { category: cat, offering: 0, looking: 0 });
      const row = rows.get(cat);
      if (item.type === 'offering') row.offering++; else row.looking++;
    });

    return [...rows.values()]
      .filter(row => row.offering || row.looking)
      .map(row => Object.assign(row, { gap: row.looking - row.offering }))
      .sort((a, b) => b.gap - a.gap || b.looking - a.looking || a.category.localeCompare(b.category));
  }

  /* Categories where demand outstrips supply — the most useful sentence the data can say */
  function unmetDemand(listings) {
    return categoryBreakdown(listings).filter(row => row.gap > 0);
  }

  /* Lightweight token-overlap matching. Not semantic: "Python" ↔ "Python for
     Beginners" matches, "OS scheduling" ↔ "Operating Systems" leans on category. */
  function tokens(text) {
    return String(text || '').toLowerCase()
      .replace(/[^a-z0-9+#.\s-]/g, ' ')
      .split(/[\s\-]+/)
      .filter(token => token.length > 2);
  }

  function findMatches(listings) {
    const list = listings || state.listings;
    const offers = list.filter(item => item.type === 'offering');
    const requests = list.filter(item => item.type === 'lookingfor');
    const pairs = [];

    requests.forEach(request => {
      const wanted = new Set(tokens(request.skill));
      const requestCat = (request.category || '').toLowerCase();

      offers.forEach(offer => {
        const overlap = tokens(offer.skill).filter(token => wanted.has(token));
        const sameCategory = requestCat && requestCat === (offer.category || '').toLowerCase();
        const score = overlap.length * 2 + (sameCategory ? 1 : 0);
        if (overlap.length || sameCategory) {
          pairs.push({ request, offer, score, shared: overlap, sameCategory: Boolean(sameCategory) });
        }
      });
    });

    return pairs.sort((a, b) => b.score - a.score);
  }

  /* ---------- UI: banner ---------- */
  function createBanner(bannerEl, textEl, closeEl) {
    if (!bannerEl || !textEl) return { show: function () {}, hide: function () {} };
    let timer = null;

    function hide() {
      bannerEl.hidden = true;
      if (timer) { clearTimeout(timer); timer = null; }
    }
    function show(message, kind) {
      textEl.textContent = message;
      bannerEl.className = 'banner banner--' + (kind === 'error' ? 'error' : 'success');
      bannerEl.hidden = false;
      if (timer) clearTimeout(timer);
      timer = setTimeout(hide, 6000);
    }
    if (closeEl) closeEl.addEventListener('click', hide);
    return { show, hide };
  }

  /* ---------- UI: contact gate ---------- */
  /* Masked by default. No mailto:/tel: href exists in the DOM until asked for, and
     the copy button's data attribute is scrubbed on hide — it held the raw value. */
  function contactLinksHTML(item) {
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
    return parts;
  }

  function createContactGate(els, getItem, onBlocked) {
    function hide() {
      state.contactRevealed = false;
      els.lines.innerHTML = '';
      els.lines.hidden = true;
      if (els.actions) els.actions.hidden = true;
      if (els.note) els.note.hidden = false;
      if (els.reveal) els.reveal.hidden = false;
      if (els.copyNote) els.copyNote.hidden = true;
      if (els.copy) { delete els.copy.dataset.value; els.copy.disabled = true; }
    }

    function reveal() {
      const item = getItem();
      if (!item) return;

      const parts = contactLinksHTML(item);
      els.lines.innerHTML = parts.join('') ||
        '<span class="contact-kind">No contact details were saved with this listing.</span>';
      els.lines.hidden = false;
      if (els.note) els.note.hidden = true;
      if (els.reveal) els.reveal.hidden = true;
      if (els.actions) els.actions.hidden = parts.length === 0;

      if (els.copy) {
        if (els.copyNote) els.copyNote.hidden = true;
        els.copy.dataset.value = item.email || item.phone || '';
        els.copy.disabled = !els.copy.dataset.value;
      }
      state.contactRevealed = true;
    }

    if (els.reveal) {
      els.reveal.addEventListener('click', () => {
        reveal();
        const first = els.lines.querySelector('a');
        if (first) first.focus();
      });
    }
    if (els.hide) {
      els.hide.addEventListener('click', () => {
        hide();
        if (els.reveal) els.reveal.focus();
      });
    }
    if (els.copy) {
      els.copy.addEventListener('click', async () => {
        const value = els.copy.dataset.value;
        if (!value) return;

        let ok = false;
        try {
          if (navigator.clipboard && global.isSecureContext) {
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

        if (els.copyNote) els.copyNote.hidden = !ok;
        if (ok) {
          clearTimeout(els.copy._t);
          els.copy._t = setTimeout(() => { if (els.copyNote) els.copyNote.hidden = true; }, COPY_NOTE_MS);
        } else if (typeof onBlocked === 'function') {
          onBlocked();
        }
      });
    }

    return { hide, reveal };
  }

  /* ---------- UI: listing card ---------- */
  /* mode 'modal' → View Details / Connect buttons (the board page has a dialog)
     mode 'page'  → an Open link to the permalink (pages without a dialog)      */
  function cardHTML(item, options) {
    const opts = options || {};
    const mode = opts.mode === 'page' ? 'page' : 'modal';
    const url = listingURL(item.id);

    const actions = mode === 'page'
      ? '<a class="btn btn-primary btn-sm" href="' + escapeHTML(url) + '">Open</a>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="delete">Delete</button>'
      : '<button type="button" class="btn btn-primary btn-sm" data-action="details">View Details</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="connect">Connect</button>';

    return (
      '<article class="card card--' + item.type + '" data-id="' + escapeHTML(item.id) + '">' +
        '<div class="card-top">' +
          '<span class="badge badge--' + item.type + '">' + TYPE_LABEL[item.type] + '</span>' +
          '<button type="button" class="card-delete" data-action="delete" ' +
            'aria-label="Delete listing: ' + escapeHTML(item.skill) + '">&times;</button>' +
        '</div>' +

        '<h3 class="card-title"><a href="' + escapeHTML(url) + '">' + escapeHTML(item.skill) + '</a></h3>' +
        '<span class="chip">' + escapeHTML(item.category || 'Other') + '</span>' +
        '<p class="card-desc">' + escapeHTML(item.description || '') + '</p>' +

        '<p class="card-by">by <strong>' + escapeHTML(item.name) + '</strong>' +
          '<span class="dot" aria-hidden="true"></span>' +
          '<time datetime="' + new Date(item.createdAt).toISOString() + '">' +
            escapeHTML(relativeTime(item.createdAt)) + '</time></p>' +

        '<div class="card-actions">' + actions + '</div>' +
      '</article>'
    );
  }

  /* ---------- UI: two-step delete ---------- */
  /* Inline confirmation on the card itself. No blocking native dialog anywhere. */
  function createDeleteFlow(container, options) {
    const opts = options || {};
    const timeout = opts.timeout || CONFIRM_TIMEOUT_MS;
    let pendingId = null;
    let timer = null;

    function close() {
      if (timer) clearTimeout(timer);
      pendingId = null;
      const open = container.querySelector('.confirm');
      if (open) open.remove();
    }

    function ask(item, card) {
      if (pendingId === item.id) { close(); return; }
      close();
      pendingId = item.id;

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

      timer = setTimeout(close, timeout);
    }

    function remove(item) {
      state.listings = state.listings.filter(l => l.id !== item.id);
      saveListings(state.listings);
      close();
      if (typeof opts.onDeleted === 'function') opts.onDeleted(item);
    }

    container.addEventListener('click', event => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      if (action !== 'delete' && action !== 'confirm-yes' && action !== 'confirm-no') return;

      const card = button.closest('.card');
      if (!card) return;
      const item = state.listings.find(l => l.id === card.dataset.id);
      if (!item) return;

      if (action === 'delete') ask(item, card);
      else if (action === 'confirm-yes') remove(item);
      else {
        close();
        const again = card.querySelector('.card-delete');
        if (again) again.focus();
      }
    });

    document.addEventListener('click', event => {
      if (pendingId && !event.target.closest('.confirm') &&
          !event.target.closest('[data-action="delete"]')) close();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && pendingId) close();
    });

    return { close, remove, isOpen: () => Boolean(pendingId) };
  }

  /* ---------- UI: shared header ---------- */
  function initNav() {
    const here = (global.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    document.querySelectorAll('.site-nav a').forEach(link => {
      const href = (link.getAttribute('href') || '').toLowerCase();
      if (href === here || (here === '' && href === 'index.html')) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
    updateLiveCount();
  }

  function updateLiveCount() {
    const node = document.getElementById('liveCount');
    if (!node) return;
    const total = state.listings.length;
    node.textContent = total + (total === 1 ? ' listing' : ' listings');
  }

  /* ---------- Boot ---------- */
  function boot() {
    state.listings = loadListings();
    state.profile = loadProfile();
    initNav();
    return state;
  }

  /* ---------- Public surface ---------- */
  global.SkillBridge = {
    STORAGE_KEY, PROFILE_KEY, SEARCH_DEBOUNCE_MS, CONFIRM_TIMEOUT_MS, COPY_NOTE_MS,
    EXPORT_VERSION, TYPE_LABEL, CATEGORIES,
    state,
    boot, setBanner, initNav, updateLiveCount,
    loadListings, saveListings, isValidListing, newId,
    loadProfile, saveProfile, dropProfile, isProfiled, isMine, initials,
    seedListings,
    escapeHTML, relativeTime, fullDate, debounce, cssEscape, listingURL, sortListings,
    computeStats, categoryBreakdown, unmetDemand, findMatches, tokens,
    createBanner, createContactGate, contactLinksHTML, cardHTML, createDeleteFlow
  };
})(window);
