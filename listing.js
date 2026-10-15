/* ═══════════════════════════════════════════════════════════
   SkillBridge — listing.js
   The permalink page for one listing: full description, poster, gated contact
   details, a copy-link button, and deletion when it belongs to you.
   ═══════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  const SB = window.SkillBridge;
  const state = SB.state;

  const el = {
    banner:      document.getElementById('banner'),
    bannerText:  document.getElementById('bannerText'),
    bannerClose: document.getElementById('bannerClose'),
    detail:      document.getElementById('detail'),
    badge:       document.getElementById('dBadge'),
    title:       document.getElementById('dTitle'),
    category:    document.getElementById('dCategory'),
    desc:        document.getElementById('dDesc'),
    name:        document.getElementById('dName'),
    date:        document.getElementById('dDate'),
    id:          document.getElementById('dId'),
    contactLines:document.getElementById('detailContact'),
    contactNote: document.getElementById('contactNote'),
    reveal:      document.getElementById('revealContact'),
    hide:        document.getElementById('hideContact'),
    actions:     document.getElementById('contactActions'),
    copy:        document.getElementById('copyContact'),
    copyNote:    document.getElementById('copyNote'),
    copyLink:    document.getElementById('copyLink'),
    linkNote:    document.getElementById('linkNote'),
    deleteMine:  document.getElementById('deleteMine'),
    cancelDelete:document.getElementById('cancelDelete'),
    notFound:    document.getElementById('notFound'),
    notFoundWhy: document.getElementById('notFoundWhy')
  };

  const banner = SB.createBanner(el.banner, el.bannerText, el.bannerClose);
  SB.setBanner(banner);

  let current = null;

  const contactGate = SB.createContactGate({
    lines: el.contactLines,
    note: el.contactNote,
    reveal: el.reveal,
    actions: el.actions,
    hide: el.hide,
    copy: el.copy,
    copyNote: el.copyNote
  }, () => current, () => {
    banner.show('Copy was blocked by the browser — select the text manually.', 'error');
  });

  function notFound(reason) {
    el.detail.hidden = true;
    el.notFound.hidden = false;
    el.notFoundWhy.textContent = reason;
    document.title = 'Listing not found — SkillBridge';
  }

  function render(item) {
    current = item;
    document.title = item.skill + ' — SkillBridge';

    el.badge.className = 'badge badge--' + item.type;
    el.badge.textContent = SB.TYPE_LABEL[item.type];
    el.title.textContent = item.skill;
    el.category.textContent = item.category || 'Other';
    el.desc.textContent = item.description || '—';
    el.name.textContent = item.name;
    el.date.textContent = SB.fullDate(item.createdAt) + ' · ' + SB.relativeTime(item.createdAt);
    el.id.textContent = item.id;

    /* Only the person who posted it can delete it */
    const mine = SB.isMine(item);
    el.deleteMine.hidden = !mine;
    if (el.cancelDelete) el.cancelDelete.hidden = true;

    contactGate.hide();
    el.notFound.hidden = true;
    el.detail.hidden = false;
  }

  /* Two-step delete, matching the card behaviour elsewhere in the app */
  let armed = false;
  let armTimer = null;

  function disarm() {
    armed = false;
    if (armTimer) clearTimeout(armTimer);
    el.deleteMine.textContent = 'Delete my listing';
    el.deleteMine.classList.remove('is-armed');
    if (el.cancelDelete) el.cancelDelete.hidden = true;
  }

  if (el.deleteMine) {
    el.deleteMine.addEventListener('click', () => {
      if (!current) return;

      if (!armed) {
        armed = true;
        el.deleteMine.textContent = 'Confirm delete?';
        el.deleteMine.classList.add('is-armed');
        if (el.cancelDelete) { el.cancelDelete.hidden = false; el.cancelDelete.focus(); }
        armTimer = setTimeout(disarm, SB.CONFIRM_TIMEOUT_MS);
        return;
      }

      const skill = current.skill;
      state.listings = state.listings.filter(l => l.id !== current.id);
      SB.saveListings(state.listings);
      disarm();
      current = null;
      banner.show('Deleted \u201c' + skill + '\u201d. Taking you back to the board.', 'success');
      setTimeout(() => { global.location.href = 'index.html'; }, 1200);
    });
  }

  if (el.cancelDelete) el.cancelDelete.addEventListener('click', disarm);

  /* Copy the permalink. It only resolves in this browser — see the note below. */
  if (el.copyLink) {
    el.copyLink.addEventListener('click', async () => {
      const url = global.location.href;
      let ok = false;
      try {
        if (navigator.clipboard && global.isSecureContext) {
          await navigator.clipboard.writeText(url);
          ok = true;
        }
      } catch (_) { ok = false; }

      if (!ok) {
        const scratch = document.createElement('textarea');
        scratch.value = url;
        scratch.setAttribute('readonly', '');
        scratch.setAttribute('aria-hidden', 'true');
        scratch.className = 'sr-clipboard';
        document.body.appendChild(scratch);
        scratch.select();
        try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
        scratch.remove();
      }

      el.linkNote.hidden = !ok;
      if (ok) {
        clearTimeout(el.copyLink._t);
        el.copyLink._t = setTimeout(() => { el.linkNote.hidden = true; }, SB.COPY_NOTE_MS);
      } else {
        banner.show('Copy was blocked by the browser — take the address from the URL bar.', 'error');
      }
    });
  }

  function init() {
    SB.boot();

    const id = new URLSearchParams(global.location.search).get('id');
    if (!id) {
      notFound('That link is missing its listing id, so there is nothing to open.');
      return;
    }

    const item = state.listings.find(l => l.id === id);
    if (!item) {
      notFound('SkillBridge keeps its listings in this browser\u2019s own localStorage, so a link only ' +
        'opens where the listing was created. If someone sent you this link, their listing is on ' +
        'their device — ask them to export it, or post your own on the board.');
      return;
    }

    render(item);
  }

  init();

  SB.listing = { render, notFound, disarm };
})(window);
