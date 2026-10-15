/* ═══════════════════════════════════════════════════════════
   SkillBridge — me.js
   My listings: the saved profile, everything this browser posted, and an export
   of just those listings.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const SB = window.SkillBridge;
  const state = SB.state;
  const esc = SB.escapeHTML;

  const el = {
    banner:       document.getElementById('banner'),
    bannerText:   document.getElementById('bannerText'),
    bannerClose:  document.getElementById('bannerClose'),
    noProfile:    document.getElementById('noProfile'),
    section:      document.getElementById('profileSection'),
    avatar:       document.getElementById('meAvatar'),
    name:         document.getElementById('meName'),
    contact:      document.getElementById('meContact'),
    meta:         document.getElementById('meMeta'),
    clearProfile: document.getElementById('clearProfile'),
    count:        document.getElementById('meCount'),
    grid:         document.getElementById('myGrid'),
    noneMine:     document.getElementById('noneMine'),
    noneMineWhy:  document.getElementById('noneMineWhy'),
    exportMine:   document.getElementById('exportMine'),
    mineBtns:     Array.prototype.slice.call(document.querySelectorAll('[data-mine]'))
  };

  const banner = SB.createBanner(el.banner, el.bannerText, el.bannerClose);
  SB.setBanner(banner);

  let mineFilter = 'all';   // 'all' | 'offering' | 'lookingfor'

  function ownListings() {
    return state.listings.filter(SB.isMine);
  }

  function shownListings() {
    return SB.sortListings(
      ownListings().filter(item => mineFilter === 'all' || item.type === mineFilter),
      'newest'
    );
  }

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  function render() {
    SB.updateLiveCount();

    const hasProfile = Boolean(state.profile);
    el.noProfile.hidden = hasProfile;
    el.section.hidden = !hasProfile;
    if (!hasProfile) return;

    const p = state.profile;
    const mine = ownListings();
    const offered = mine.filter(item => item.type === 'offering').length;

    el.avatar.textContent = SB.initials(p.name);
    el.name.textContent = p.name;
    el.contact.textContent = p.email || p.phone || 'No contact details saved';
    el.meta.textContent =
      plural(mine.length, 'listing', 'listings') + ' · ' +
      plural(offered, 'offer', 'offers') + ' · ' +
      plural(mine.length - offered, 'request', 'requests') + ' · saved ' +
      SB.relativeTime(p.savedAt);

    const shown = shownListings();
    el.count.textContent = 'Showing ' + plural(shown.length, 'listing', 'listings') +
      (mineFilter === 'all' ? '' : ' of ' + mine.length);
    el.grid.innerHTML = shown.map(item => SB.cardHTML(item, { mode: 'page' })).join('');
    el.grid.hidden = shown.length === 0;
    el.noneMine.hidden = shown.length !== 0;

    if (shown.length === 0) {
      el.noneMineWhy.textContent = mine.length === 0
        ? 'Your details are saved, but you have not posted a listing with them.'
        : 'You have no ' + SB.TYPE_LABEL[mineFilter].toLowerCase() + ' listings.';
    }
  }

  function syncMineButtons() {
    el.mineBtns.forEach(btn => {
      const active = btn.dataset.mine === mineFilter;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  el.mineBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      mineFilter = btn.dataset.mine;
      syncMineButtons();
      render();
    });
  });

  SB.createDeleteFlow(el.grid, {
    onDeleted: item => {
      render();
      banner.show('Deleted \u201c' + item.skill + '\u201d.', 'success');
    }
  });

  /* Export only this browser's own listings */
  el.exportMine.addEventListener('click', () => {
    const mine = ownListings();
    if (!mine.length) {
      banner.show('You have no listings to export yet.', 'error');
      return;
    }

    const payload = {
      app: 'SkillBridge',
      version: SB.EXPORT_VERSION,
      scope: 'mine',
      exportedAt: new Date().toISOString(),
      count: mine.length,
      listings: mine
    };
    const text = JSON.stringify(payload, null, 2);
    const filename = 'skillbridge-mine-' + new Date().toISOString().slice(0, 10) + '.json';

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
      banner.show('Exported ' + plural(mine.length, 'listing', 'listings') + ' to ' + filename + '.', 'success');
    } catch (err) {
      console.info(text);
      banner.show('This browser blocked the download — the JSON is printed in the console instead.', 'error');
    } finally {
      if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }
  });

  el.clearProfile.addEventListener('click', () => {
    const count = ownListings().length;
    SB.dropProfile();
    state.profile = null;
    state.editingProfile = false;
    mineFilter = 'all';
    syncMineButtons();
    render();
    banner.show(count
      ? 'Your saved details were cleared. Your ' + plural(count, 'listing stays', 'listings stay') +
        ' on the board.'
      : 'Your saved details were cleared from this browser.', 'success');
  });

  SB.boot();
  syncMineButtons();
  render();

  SB.me = { render, ownListings, shownListings };
})();
