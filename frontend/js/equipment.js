/* NDRF Command Center · equipment inventory
   /api/equipment (catalogue + Excel kits) with a static JSON fallback. */
(() => {
  'use strict';
  const N = window.NDRF;
  const { $, $$, esc } = N;

  let items = [];
  let category = '';
  let nameIndex = [];

  const highlight = (text, q) => {
    const safe = esc(text);
    if (!q) return safe;
    const re = new RegExp(`(${q.split(/\s+/).filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    return safe.replace(re, '<mark>$1</mark>');
  };

  function filtered() {
    const q = $('#eqSearch').value.trim().toLowerCase();
    const status = $('#eqStatus').value;
    const words = q.split(/\s+/).filter(Boolean);
    return items.filter((i) => {
      if (category && i.category !== category) return false;
      if (status && i.status !== status) return false;
      if (!words.length) return true;
      const hay = `${i.name} ${i.category} ${i.subcategory || ''} ${i.description || ''} ${i.location || ''}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }

  function renderCats() {
    const counts = {};
    items.forEach((i) => { counts[i.category] = (counts[i.category] || 0) + 1; });
    const cats = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    $('#eqCats').innerHTML = [`<button class="${category ? '' : 'active'}" data-cat="">All<b>${items.length}</b></button>`]
      .concat(cats.map(([c, n]) => `<button class="${c === category ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}<b>${n}</b></button>`)).join('');
  }

  function render() {
    const q = $('#eqSearch').value.trim();
    const list = filtered();
    const units = list.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
    const limited = list.filter((i) => i.status && i.status !== 'Available').length;
    $('#eqSummary').innerHTML = `
      <div><small>LINES SHOWN</small><b>${list.length}</b></div>
      <div><small>TOTAL UNITS</small><b>${units.toLocaleString('en-IN')}</b></div>
      <div><small>CATEGORIES</small><b>${new Set(list.map((i) => i.category)).size}</b></div>
      <div><small>LIMITED STOCK</small><b style="color:${limited ? 'var(--amber)' : 'inherit'}">${limited}</b></div>`;
    $('#eqGrid').innerHTML = list.length
      ? list.slice(0, 160).map((i, k) => `
        <article class="eq" style="animation-delay:${Math.min(k, 20) * 0.02}s">
          <div class="eq-top"><h4>${highlight(i.name, q)}</h4><span class="eq-qty">${i.quantity}</span></div>
          ${i.description ? `<p>${highlight(i.description, q)}</p>` : ''}
          <div class="eq-meta"><span>${esc(i.category)}</span>${i.subcategory ? `<span>${esc(i.subcategory)}</span>` : ''}<span>📍 ${esc(i.location || '—')}</span><span class="st-${esc(i.status)}">${esc(i.status || 'Available')}</span></div>
        </article>`).join('')
      : `<div class="empty">No equipment matches "${esc(q)}".</div>`;
  }

  async function load() {
    try {
      const data = await N.api('/api/equipment', { timeout: 20000 });
      items = data.items || [];
    } catch (e) {
      N.log('Equipment API unavailable, loading local catalogue', 'warn');
      try { items = await (await fetch('data/equipment.json')).json(); } catch { items = []; }
    }
    nameIndex = items.map((i) => i.name.toLowerCase().replace(/\s*\(.*?\)\s*/g, ' ').trim());
    const cats = new Set(items.map((i) => i.category)).size;
    N.bumpKpi('kpiEquip', items.length);
    $('#kpiEquipFoot').textContent = `${cats} categories`;
    renderCats();
    render();
    N.log(`Equipment inventory loaded: ${items.length} lines`, 'success');
  }

  function init() {
    let t = 0;
    $('#eqSearch').addEventListener('input', () => { clearTimeout(t); t = setTimeout(render, 120); });
    $('#eqStatus').addEventListener('change', render);
    $('#eqCats').addEventListener('click', (e) => {
      const b = e.target.closest('[data-cat]');
      if (!b) return;
      category = b.dataset.cat;
      $$('#eqCats button').forEach((x) => x.classList.toggle('active', x === b));
      render();
    });
    return load();
  }

  N.equipment = {
    init,
    names: () => nameIndex,
    search(term) {
      N.go('equipment');
      category = '';
      renderCats();
      $('#eqSearch').value = term;
      render();
      return filtered();
    },
  };
})();
