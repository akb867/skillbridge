/* ═══════════════════════════════════════════════════════════
   SkillBridge — insights.js
   Supply vs demand across the board: headline numbers, a per-category table,
   the biggest gaps, and keyword-overlap matches between requests and offers.
   All computed client-side from this browser's own listings.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const SB = window.SkillBridge;
  const state = SB.state;
  const esc = SB.escapeHTML;

  const el = {
    statStrip: document.getElementById('statStrip'),
    catTable:  document.querySelector('#catTable tbody'),
    catEmpty:  document.getElementById('catEmpty'),
    gapList:   document.getElementById('gapList'),
    gapEmpty:  document.getElementById('gapEmpty'),
    matchList: document.getElementById('matchList'),
    matchMore: document.getElementById('matchMore'),
    matchEmpty:document.getElementById('matchEmpty')
  };

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  /* Discrete widths so no inline style attribute is ever needed */
  function widthClass(ratio) {
    if (ratio <= 0) return 'w-0';
    if (ratio < 0.25) return 'w-25';
    if (ratio < 0.6) return 'w-50';
    if (ratio < 0.9) return 'w-75';
    return 'w-100';
  }

  function renderStats() {
    const s = SB.computeStats(state.listings);
    const stat = (value, label) =>
      '<li class="stat"><span class="stat-value">' + value + '</span>' +
      '<span class="stat-label">' + esc(label) + '</span></li>';

    el.statStrip.innerHTML =
      stat(s.total, 'listings') +
      stat(s.offering, 'skills offered') +
      stat(s.looking, 'skills wanted') +
      stat(s.people, 'people posting') +
      stat(s.categories, 'categories');
  }

  function renderTable() {
    const rows = SB.categoryBreakdown(state.listings);
    el.catEmpty.hidden = rows.length > 0;
    if (!rows.length) { el.catTable.innerHTML = ''; return; }

    el.catTable.innerHTML = rows.map(row => {
      const total = row.offering + row.looking;
      const ratio = total ? row.offering / total : 0;
      const gapText = row.gap > 0 ? '+' + row.gap + ' wanted'
        : row.gap < 0 ? Math.abs(row.gap) + ' spare'
        : 'balanced';
      const gapClass = row.gap > 0 ? 'gap-hot' : row.gap < 0 ? 'gap-cool' : 'gap-even';

      return '<tr>' +
        '<th scope="row">' + esc(row.category) + '</th>' +
        '<td class="num">' + row.offering + '</td>' +
        '<td class="num">' + row.looking + '</td>' +
        '<td class="num ' + gapClass + '">' + esc(gapText) + '</td>' +
        '<td><span class="bar" title="' + row.offering + ' offering, ' + row.looking +
          ' looking for"><span class="bar-offer ' + widthClass(ratio) + '"></span></span></td>' +
        '</tr>';
    }).join('');
  }

  function renderGaps() {
    const gaps = SB.unmetDemand(state.listings);
    el.gapEmpty.hidden = gaps.length > 0;
    if (!gaps.length) { el.gapList.innerHTML = ''; return; }

    el.gapList.innerHTML = gaps.map(row => {
      const verb = row.offering === 0 ? 'nobody is offering it'
        : 'only ' + plural(row.offering, 'person is', 'people are') + ' offering it';
      return '<li class="insight">' +
        '<span class="insight-main">' +
          '<strong>' + plural(row.looking, 'person wants', 'people want') + '</strong> help with ' +
          esc(row.category) + ', and ' + verb + '.' +
        '</span>' +
        (row.offering === 0
          ? '<a class="btn btn-ghost btn-sm" href="index.html">Offer ' + esc(row.category) + '</a>'
          : '') +
        '</li>';
    }).join('');
  }

  const MATCH_CAP = 12;

  function renderMatches() {
    const all = SB.findMatches(state.listings);
    const pairs = all.slice(0, MATCH_CAP);
    el.matchEmpty.hidden = pairs.length > 0;
    el.matchMore.hidden = all.length <= pairs.length;
    if (el.matchMore.hidden === false) {
      el.matchMore.textContent = 'Showing the ' + pairs.length + ' closest of ' + all.length +
        ' possible pairings.';
    }
    if (!pairs.length) { el.matchList.innerHTML = ''; return; }

    el.matchList.innerHTML = pairs.map(pair => {
      const why = [];
      if (pair.shared.length) why.push('shares ' + pair.shared.map(esc).join(', '));
      if (pair.sameCategory) why.push('both in ' + pair.request.category);

      return '<li class="insight">' +
        '<span class="insight-main">' +
          '<strong>' + esc(pair.request.skill) + '</strong>' +
          '<span class="insight-wanted">wanted by ' + esc(pair.request.name) + '</span>' +
          '<span class="insight-arrow" aria-hidden="true">&rarr;</span>' +
          '<strong>' + esc(pair.offer.skill) + '</strong>' +
          '<span class="insight-offered">offered by ' + esc(pair.offer.name) + '</span>' +
          '<span class="insight-why">' + esc(why.join(' · ')) + '</span>' +
        '</span>' +
        '<a class="btn btn-ghost btn-sm" href="' + esc(SB.listingURL(pair.offer.id)) + '">Open offer</a>' +
        '</li>';
    }).join('');
  }

  function render() {
    SB.updateLiveCount();
    renderStats();
    renderTable();
    renderGaps();
    renderMatches();
  }

  SB.boot();
  render();

  SB.insights = { render, renderStats, renderTable, renderGaps, renderMatches };
})();
