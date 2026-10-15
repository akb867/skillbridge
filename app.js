/* ═══════════════════════════════════════════════════════════
   SkillBridge — app.js
   Logic for index.html only: hero stats, the posting form, search and filters,
   the card grid, the details dialog, and export/import.
   Shared behaviour (storage, profile, formatting, cards) lives in core.js.
   ═══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  const SB = window.SkillBridge;
  const state = SB.state;
  const {
    escapeHTML: esc, relativeTime, fullDate, debounce, cssEscape,
    TYPE_LABEL, CATEGORIES, SEARCH_DEBOUNCE_MS, CONFIRM_TIMEOUT_MS
  } = SB;

  /* ---------- Element references ---------- */
  const el = {
    liveCount:    document.getElementById('liveCount'),
    statStrip:    document.getElementById('statStrip'),
    demandHint:   document.getElementById('demandHint'),
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
    filterBtns:   Array.prototype.slice.call(document.querySelectorAll('.filter-btn')),
    resultsMeta:  document.getElementById('resultsMeta'),
    grid:         document.getElementById('grid'),
    empty:        document.getElementById('emptyState'),
    emptyTitle:   document.getElementById('emptyTitle'),
    emptySub:     document.getElementById('emptySub'),
    clearFilters: document.getElementById('clearFilters'),
    chipRow:      document.getElementById('chipRow'),
    sortSelect:   document.getElementById('sortSelect'),
    exportBtn:    document.getElementById('exportBtn'),
    importBtn:    document.getElementById('importBtn'),
    importFile:   document.getElementById('importFile'),
    mineBtn:      document.getElementById('mineBtn'),
    profileBar:   document.getElementById('profileBar'),
    profileAvatar:document.getElementById('profileAvatar'),
    profileName:  document.getElementById('profileName'),
    profileContact:document.getElementById('profileContact'),
    editProfile:  document.getElementById('editProfile'),
    clearProfile: document.getElementById('clearProfile'),
    fieldName:    document.getElementById('fieldName'),
    fieldContact: document.getElementById('fieldContact'),
    modal:        document.getElementById('detailModal'),
    modalClose:   document.getElementById('modalClose'),
    modalDone:    document.getElementById('modalDone'),
    modalBadge:   document.getElementById('modalBadge'),
    modalTitle:   document.getElementById('modalTitle'),
    modalCategory:document.getElementById('modalCategory'),
    modalDesc:    document.getElementById('modalDesc'),
    modalName:    document.getElementById('modalName'),
    modalDate:    document.getElementById('modalDate'),
    modalPermalink:document.getElementById('modalPermalink'),
    modalContact: document.getElementById('modalContact'),
    contactNote:  document.getElementById('contactNote'),
    revealContact:document.getElementById('revealContact'),
    hideContact:  document.getElementById('hideContact'),
    contactActions:document.getElementById('contactActions'),
    copyContact:  document.getElementById('copyContact'),
    copyNote:     document.getElementById('copyNote')
  };

  /* ---------- Banner ---------- */
  const banner = SB.createBanner(el.banner, el.bannerText, el.bannerClose);
  SB.setBanner(banner);
  const showBanner = banner.show;
  const hideBanner = banner.hide;

  /* ---------- Contact gate for the dialog ---------- */
  const contactGate = SB.createContactGate({
    lines: el.modalContact,
    note: el.contactNote,
    reveal: el.revealContact,
    actions: el.contactActions,
    hide: el.hideContact,
    copy: el.copyContact,
    copyNote: el.copyNote
  }, () => state.modalItem, () => {
    showBanner('Copy was blocked by the browser — select the contact text manually.', 'error');
  });

  /* ---------- Filtering ---------- */
  function visibleListings() {
    const terms = state.query.split(/\s+/).filter(Boolean); // AND logic across keywords

    const matched = state.listings
      .filter(item => state.filter === 'all' || item.type === state.filter)
      .filter(item => state.category === 'all' || item.category === state.category)
      .filter(item => !state.onlyMine || SB.isMine(item))
      .filter(item => {
        if (!terms.length) return true;
        const haystack = [item.skill, item.description, item.category, item.name]
          .filter(Boolean).join(' ').toLowerCase();
        return terms.every(term => haystack.includes(term));
      });

    return SB.sortListings(matched, state.sort);
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

  /* ---------- Hero: live stats + the supply/demand gap ---------- */
  function statHTML(value, label) {
    return '<li class="stat"><span class="stat-value">' + value + '</span>' +
      '<span class="stat-label">' + esc(label) + '</span></li>';
  }

  function renderHero() {
    if (!el.statStrip) return;
    const s = SB.computeStats(state.listings);
    el.statStrip.innerHTML =
      statHTML(s.offering, 'skills offered') +
      statHTML(s.looking, 'skills wanted') +
      statHTML(s.people, 'people posting') +
      statHTML(s.categories, 'categories');

    if (!el.demandHint) return;
    const unmet = SB.unmetDemand(state.listings);
    if (!unmet.length) { el.demandHint.hidden = true; return; }

    const top = unmet[0];
    const want = top.looking === 1 ? 'person is looking for' : 'people are looking for';
    const supply = top.offering === 0
      ? 'nobody is offering it yet'
      : (top.offering === 1 ? 'only 1 person is offering it' : 'only ' + top.offering + ' people are offering it');

    el.demandHint.hidden = false;
    el.demandHint.innerHTML =
      '<span class="demand-text"><strong>' + top.looking + ' ' + want + '</strong> help with ' +
      esc(top.category) + ', and ' + supply + '.</span>' +
      (top.offering === 0
        ? '<button type="button" class="btn btn-ghost btn-sm" data-fill-category="' +
          esc(top.category) + '">Offer ' + esc(top.category) + '</button>'
        : '');
  }

  /* Clicking "Offer it" prefills the form for that category */
  if (el.demandHint) {
    el.demandHint.addEventListener('click', event => {
      const button = event.target.closest('[data-fill-category]');
      if (!button) return;
      const cat = button.dataset.fillCategory;
      if (CATEGORIES.indexOf(cat) !== -1) el.category.value = cat;
      const offering = el.form.querySelector('input[name="type"][value="offering"]');
      if (offering) offering.checked = true;
      el.form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.skill.focus();
    });
  }

  /* ---------- Category chips ---------- */
  function renderChips() {
    const pool = state.listings.filter(item => state.filter === 'all' || item.type === state.filter);
    const counts = new Map();
    pool.forEach(item => {
      const cat = item.category || 'Other';
      counts.set(cat, (counts.get(cat) || 0) + 1);
    });

    const ordered = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    /* Keep the active chip on screen even when the type filter has nothing in it */
    if (state.category !== 'all' && !counts.has(state.category)) ordered.unshift([state.category, 0]);

    const chip = (label, value, count) => {
      const active = state.category === value;
      return '<button type="button" class="chip-btn' + (active ? ' is-active' : '') + '"' +
        ' data-category="' + esc(value) + '" aria-pressed="' + active + '">' +
        esc(label) +
        (count === null ? '' : '<span class="chip-count">' + count + '</span>') +
        '</button>';
    };

    el.chipRow.innerHTML = chip('All categories', 'all', null) +
      ordered.map(entry => chip(entry[0], entry[0], entry[1])).join('');
    el.chipRow.hidden = ordered.length === 0;
  }

  /* ---------- Render ---------- */
  function render(newIdToHighlight) {
    const shown = visibleListings();
    const total = state.listings.length;

    SB.updateLiveCount();
    el.resultsMeta.textContent =
      'Showing ' + shown.length + ' of ' + total + (total === 1 ? ' listing' : ' listings');

    renderHero();
    renderChips();

    el.grid.innerHTML = shown.map(item => SB.cardHTML(item, { mode: 'modal' })).join('');
    el.grid.hidden = shown.length === 0;

    const isFiltering = Boolean(state.query) || state.filter !== 'all' ||
      state.category !== 'all' || state.onlyMine;
    el.empty.hidden = shown.length !== 0;

    if (shown.length === 0) {
      if (total === 0) {
        el.emptyTitle.textContent = 'No listings yet';
        el.emptySub.textContent = 'Be the first to post a skill — the board above takes 20 seconds.';
        el.clearFilters.hidden = true;
      } else if (state.onlyMine && !state.query && state.filter === 'all' && state.category === 'all') {
        el.emptyTitle.textContent = 'You have not posted anything yet';
        el.emptySub.textContent = 'Listings you post from this browser will collect here.';
        el.clearFilters.hidden = false;
      } else if (isFiltering) {
        el.emptyTitle.textContent = 'Nothing matches your filters';
        const scope = scopeDescription();
        el.emptySub.innerHTML = state.query
          ? 'No ' + esc(scope) + ' matched <q>' + esc(state.query) + '</q>.'
          : 'Nothing has been posted under <q>' + esc(scope) + '</q> yet.';
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

  /* ---------- Profile UI ---------- */
  function applyProfileUI() {
    const active = SB.isProfiled();
    el.profileBar.hidden = !active;
    el.fieldName.hidden = active;
    el.fieldContact.hidden = active;
    el.form.classList.toggle('is-profiled', active);

    if (active) {
      el.profileName.textContent = state.profile.name;
      el.profileContact.textContent = state.profile.email || state.profile.phone || '';
      el.profileAvatar.textContent = SB.initials(state.profile.name);
    } else {
      el.profileName.textContent = '';
      el.profileContact.textContent = '';
      el.profileAvatar.textContent = '';
    }

    el.mineBtn.hidden = !state.profile;
    syncMineButton();
  }

  function syncMineButton() {
    const count = state.profile ? state.listings.filter(SB.isMine).length : 0;
    el.mineBtn.textContent = 'Mine' + (count ? ' (' + count + ')' : '');
    el.mineBtn.classList.toggle('is-active', state.onlyMine);
    el.mineBtn.setAttribute('aria-pressed', String(state.onlyMine));
  }

  /* ---------- Form validation ---------- */
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
    const profiled = SB.isProfiled();
    const saved = state.profile;

    /* When the identity fields are collapsed the profile is the source of truth,
       so they are neither read nor validated. */
    const name = profiled ? saved.name : el.name.value.trim();
    const email = profiled ? saved.email : el.email.value.trim();
    const phone = profiled ? saved.phone : el.phone.value.trim();

    const skill = el.skill.value.trim();
    const category = el.category.value;
    const description = el.description.value.trim();
    const checked = el.form.querySelector('input[name="type"]:checked');
    const type = checked ? checked.value : '';

    if (!profiled) {
      setError(el.name, errEl('err-fName'), name ? '' : 'Please enter your name.');
      if (!name) errors.push(el.name);
    } else {
      setError(el.name, errEl('err-fName'), '');
    }

    setError(el.skill, errEl('err-fSkill'), skill ? '' : 'Which skill is this about?');
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
    if (profiled) {
      contactError = '';                 // validated when the profile was saved
    } else if (!email && !phone) {
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

  function clearAllErrors() {
    ['err-fName', 'err-fSkill', 'err-type', 'err-fCategory', 'err-fDescription', 'err-contact']
      .forEach(id => { const node = errEl(id); if (node) { node.textContent = ''; node.hidden = true; } });
    [el.name, el.skill, el.category, el.description, el.email, el.phone]
      .forEach(field => field.removeAttribute('aria-invalid'));
  }

  function updateCounter() {
    const len = el.description.value.length;
    el.descCounter.textContent = len + ' / 240';
    el.descCounter.classList.toggle('is-full', len >= 240);
  }

  /* ---------- Submit ---------- */
  el.form.addEventListener('submit', event => {
    event.preventDefault();
    hideBanner();

    const invalidFields = validateForm();
    if (invalidFields.length) {
      invalidFields[0].focus();
      showBanner('Please fix the highlighted fields.', 'error');
      return;
    }

    const profiled = SB.isProfiled();
    /* Allocate the profile id up front: on the very first post the profile itself is
       only created a few lines below, but this listing must still belong to it. */
    const ownerId = state.profile ? state.profile.id : SB.newId();

    const record = {
      id: SB.newId(),
      name: profiled ? state.profile.name : el.name.value.trim(),
      type: el.form.querySelector('input[name="type"]:checked').value,
      skill: el.skill.value.trim(),
      category: el.category.value,
      description: el.description.value.trim(),
      email: profiled ? state.profile.email : el.email.value.trim(),
      phone: profiled ? state.profile.phone : el.phone.value.trim(),
      ownerId: ownerId,
      createdAt: Date.now()
    };

    if (isDuplicate(record)) {
      setError(el.skill, errEl('err-fSkill'), "You've already posted this skill.");
      el.skill.focus();
      showBanner("You've already posted this skill.", 'error');
      return;
    }

    state.listings.push(record);
    SB.saveListings(state.listings);

    /* Keep the view useful: a post the current filters would hide looks like a failed save */
    if (state.filter !== 'all' && state.filter !== record.type) state.filter = 'all';
    if (state.category !== 'all' && state.category !== record.category) state.category = 'all';
    syncFilterButtons();
    state.query = '';
    el.search.value = '';

    el.form.reset();
    updateCounter();
    clearAllErrors();

    /* Remember the identity: first post creates it, an edit updates it */
    let bannerNote = '';
    if (!state.profile) {
      state.profile = {
        id: ownerId, name: record.name, email: record.email, phone: record.phone,
        savedAt: Date.now()
      };
      SB.saveProfile(state.profile);
      state.editingProfile = false;
      state.onlyMine = false;
      bannerNote = ' We\u2019ll remember your details, so next time it\u2019s just the skill.';
    } else if (state.editingProfile) {
      state.profile = Object.assign({}, state.profile, {
        name: record.name, email: record.email, phone: record.phone, savedAt: Date.now()
      });
      SB.saveProfile(state.profile);
      state.editingProfile = false;
      bannerNote = ' Your saved details were updated.';
    }
    applyProfileUI();

    render(record.id);
    showBanner('Listing posted \u2713 — it is saved in this browser.' + bannerNote, 'success');
  });

  el.resetForm.addEventListener('click', () => {
    el.form.reset();
    updateCounter();
    clearAllErrors();
    hideBanner();
    (SB.isProfiled() ? el.skill : el.name).focus();
  });

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
  el.description.addEventListener('input', updateCounter);

  /* ---------- Search, filters, chips, sort ---------- */
  const onSearch = debounce(() => {
    state.query = el.search.value.trim().toLowerCase();
    render();
  }, SEARCH_DEBOUNCE_MS);
  el.search.addEventListener('input', onSearch);

  function syncFilterButtons() {
    el.filterBtns.forEach(btn => {
      const active = btn.dataset.filter === state.filter;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  el.filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      state.filter = btn.dataset.filter;
      syncFilterButtons();
      render();
    });
  });

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

  el.mineBtn.addEventListener('click', () => {
    if (!state.profile) return;
    state.onlyMine = !state.onlyMine;
    syncMineButton();
    render();
  });

  el.clearFilters.addEventListener('click', () => {
    state.query = '';
    state.filter = 'all';
    state.category = 'all';
    state.onlyMine = false;
    el.search.value = '';
    syncFilterButtons();
    syncMineButton();
    render();
    el.search.focus();
  });

  el.editProfile.addEventListener('click', () => {
    if (!state.profile) return;
    state.editingProfile = true;
    el.name.value = state.profile.name;
    el.email.value = state.profile.email;
    el.phone.value = state.profile.phone;
    applyProfileUI();
    hideBanner();
    el.name.focus();
  });

  /* Shared lab machine: forget who I am */
  el.clearProfile.addEventListener('click', () => {
    SB.dropProfile();
    state.profile = null;
    state.editingProfile = false;
    state.onlyMine = false;
    el.name.value = '';
    el.email.value = '';
    el.phone.value = '';
    clearAllErrors();
    applyProfileUI();
    render();
    showBanner('Your saved details were cleared from this browser.', 'success');
    el.name.focus();
  });

  /* ---------- Cards: details / connect ---------- */
  el.grid.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action !== 'details' && action !== 'connect') return;

    const card = button.closest('.card');
    const item = state.listings.find(l => l.id === card.dataset.id);
    if (!item) return;
    openModal(item, button, action === 'connect');
  });

  /* Delete lives in core so every page confirms and persists identically */
  SB.createDeleteFlow(el.grid, {
    onDeleted: item => {
      render();
      showBanner('Deleted \u201c' + item.skill + '\u201d.', 'success');
    }
  });

  /* ---------- Dialog ---------- */
  function openModal(item, trigger, revealContact) {
    state.lastTrigger = trigger || null;

    el.modalBadge.className = 'badge badge--' + item.type;
    el.modalBadge.textContent = TYPE_LABEL[item.type];
    el.modalTitle.textContent = item.skill;
    el.modalCategory.textContent = item.category || 'Other';
    el.modalDesc.textContent = item.description || '—';
    el.modalName.textContent = item.name;
    el.modalDate.textContent = fullDate(item.createdAt) + ' · ' + relativeTime(item.createdAt);
    el.modalPermalink.href = SB.listingURL(item.id);

    state.modalItem = item;
    contactGate.hide();               // masked on every open

    let opened = false;
    try {
      if (typeof el.modal.showModal === 'function') { el.modal.showModal(); opened = true; }
    } catch (err) { opened = false; }

    if (!opened) {
      el.modal.setAttribute('open', '');
      el.modal.classList.add('is-open-fallback');
    }

    /* "Connect" is an explicit intent to make contact, so it unmasks immediately */
    if (revealContact) contactGate.reveal();

    const focusTarget = revealContact
      ? (el.modalContact.querySelector('a') || el.copyContact)
      : el.modalClose;
    if (focusTarget) setTimeout(() => focusTarget.focus(), 30);
  }

  function closeModal() {
    try {
      if (typeof el.modal.close === 'function' && el.modal.open) { el.modal.close(); return; }
    } catch (err) { /* fall through */ }
    el.modal.removeAttribute('open');
    el.modal.classList.remove('is-open-fallback');
    restoreFocus();
  }

  function restoreFocus() {
    if (state.lastTrigger && document.contains(state.lastTrigger)) state.lastTrigger.focus();
    state.lastTrigger = null;
    /* Never leave a previous poster's contact details sitting in the DOM */
    state.modalItem = null;
    contactGate.hide();
  }

  el.modalClose.addEventListener('click', closeModal);
  el.modalDone.addEventListener('click', closeModal);
  el.modal.addEventListener('close', restoreFocus);
  el.modal.addEventListener('click', event => {
    if (event.target === el.modal) closeModal();
  });

  /* ---------- Export / import ---------- */
  function buildExportPayload() {
    return {
      app: 'SkillBridge',
      version: SB.EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      count: state.listings.length,
      listings: state.listings
    };
  }

  function exportJSON() {
    const text = JSON.stringify(buildExportPayload(), null, 2);
    const filename = 'skillbridge-' + new Date().toISOString().slice(0, 10) + '.json';

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
      id: typeof entry.id === 'string' && entry.id ? entry.id : SB.newId(),
      name,
      type,
      skill,
      category: CATEGORIES.indexOf(entry.category) !== -1 ? entry.category : 'Other',
      description: typeof entry.description === 'string' ? entry.description.slice(0, 240) : '',
      email: typeof entry.email === 'string' ? entry.email.trim() : '',
      phone: typeof entry.phone === 'string' ? entry.phone.trim() : '',
      /* Deliberately not carried over: an ownerId from another browser means nothing here */
      ownerId: null,
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

    if (added) SB.saveListings(state.listings);
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
        /* Imported listings may not match the current filters — show what arrived */
        if (result.added > 0 && visibleListings().length === 0) {
          state.query = ''; state.filter = 'all'; state.category = 'all';
          el.search.value = ''; syncFilterButtons();
        }
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

  /* ---------- Init ---------- */
  function init() {
    SB.boot();

    /* Deep link from me.html: index.html?edit=profile expands the identity fields */
    const params = new URLSearchParams(global.location.search);
    const arrivedToEdit = params.get('edit') === 'profile' && Boolean(state.profile);
    if (arrivedToEdit) {
      state.editingProfile = true;
      el.name.value = state.profile.name;
      el.email.value = state.profile.email;
      el.phone.value = state.profile.phone;
    }

    updateCounter();
    syncFilterButtons();
    el.sortSelect.value = state.sort;
    contactGate.hide();
    applyProfileUI();
    render();

    /* The deep link lands with the identity fields already open, which needs a reason */
    if (arrivedToEdit) {
      banner.show('Editing your saved details \u2014 change the fields, then post to save them.', 'success');
    }
  }

  /* Exposed for the headless test harness */
  SB.board = {
    visibleListings, scopeDescription, render, renderChips, renderHero,
    validateForm, isDuplicate, buildExportPayload, handleImportText, normaliseListing,
    openModal, closeModal, applyProfileUI, syncMineButton
  };

  init();
})(window);
