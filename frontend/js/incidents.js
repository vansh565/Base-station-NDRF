/* NDRF Command Center · incidents
   Real-time incident board (REST + Socket.IO), SOS, dashboard summary. */
(() => {
  'use strict';
  const N = window.NDRF;
  const { $, $$, esc } = N;

  let list = [];
  let filter = 'ACTIVE';
  const SEV_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

  const active = () => list.filter((i) => i.status !== 'RESOLVED');

  function upsert(incident) {
    const idx = list.findIndex((i) => i.id === incident.id);
    if (idx >= 0) list[idx] = incident; else list.unshift(incident);
  }

  function card(i, compact = false) {
    const coords = i.lat != null && i.lon != null;
    const meta = [
      `🏷 ${esc(i.type)}`,
      i.people_affected ? `👥 ${i.people_affected} affected` : '',
      i.team ? `🛡 ${esc(i.team)}` : '',
      coords ? `📍 ${i.lat.toFixed(4)}, ${i.lon.toFixed(4)}` : (i.location_name ? `📍 ${esc(i.location_name)}` : ''),
      `🕒 ${N.timeAgo(i.created_at)}`,
      i.source !== 'manual' ? `⚡ ${esc(i.source)}` : '',
    ].filter(Boolean).map((m) => `<span>${m}</span>`).join('');
    const actions = compact ? '' : `
      <div class="inc-actions">
        ${i.status === 'OPEN' ? `<button class="btn" data-act="RESPONDING" data-id="${i.id}">🚒 Responding</button>` : ''}
        ${i.status !== 'RESOLVED' ? `<button class="btn" data-act="RESOLVED" data-id="${i.id}">✅ Resolve</button>` : `<button class="btn" data-act="OPEN" data-id="${i.id}">↺ Reopen</button>`}
        ${coords ? `<button class="btn" data-act="map" data-id="${i.id}">📍 Map</button><button class="btn" data-act="route" data-id="${i.id}">🗺 Route</button>` : ''}
        <button class="btn btn-danger" data-act="delete" data-id="${i.id}" title="Delete">🗑</button>
      </div>`;
    return `<article class="inc lvl-${i.severity} status-${i.status}" data-inc="${i.id}">
      <div class="inc-top"><span class="pill lvl-${i.severity}">${i.severity}</span><h4>${esc(i.title)}</h4><span class="status-tag s-${i.status}">${i.status}</span></div>
      <div class="inc-meta">${meta}</div>
      ${i.notes && !compact ? `<p class="inc-notes">${esc(i.notes)}</p>` : ''}
      <div class="inc-id">${i.id}</div>
      ${actions}
    </article>`;
  }

  function render() {
    const sorted = [...list].sort((a, b) => (a.status === 'RESOLVED') - (b.status === 'RESOLVED')
      || SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || b.created_at.localeCompare(a.created_at));
    const shown = sorted.filter((i) => filter === 'ALL' || (filter === 'RESOLVED' ? i.status === 'RESOLVED' : i.status !== 'RESOLVED'));
    $('#incList').innerHTML = shown.length ? shown.map((i) => card(i)).join('') : '<div class="empty">No incidents in this view.</div>';

    const act = sorted.filter((i) => i.status !== 'RESOLVED');
    $('#incMini').innerHTML = act.length
      ? act.slice(0, 6).map((i) => card(i, true)).join('')
      : '<div class="empty">No active incidents. Use <b>New Incident</b> or <b>SOS</b> to raise one.</div>';

    const critical = act.filter((i) => i.severity === 'CRITICAL').length;
    N.bumpKpi('kpiIncidents', act.length);
    $('#kpiIncidentsFoot').textContent = critical ? `${critical} critical` : 'none critical';
    const badge = $('#navIncidentCount');
    badge.textContent = act.length;
    badge.dataset.zero = act.length ? '0' : '1';

    const hero = $('#heroStatus');
    if (critical) { hero.textContent = `⚠ ${critical} critical incident${critical > 1 ? 's' : ''} active`; hero.style.color = '#fca5a5'; }
    else if (act.length) { hero.textContent = `${act.length} incident${act.length > 1 ? 's' : ''} under response`; hero.style.color = '#fde68a'; }
    else { hero.textContent = 'All systems nominal'; hero.style.color = ''; }

    N.emit('incidents:changed', list);
  }

  async function load() {
    try {
      const data = await N.api('/api/incidents', { timeout: 20000 });
      list = data.incidents || [];
      N.log(`Incident board synced: ${active().length} active`, 'success');
    } catch (e) {
      N.log('Incident board unavailable: ' + e.message, 'warn');
    }
    render();
  }

  async function create(data, { quiet = false } = {}) {
    try {
      const res = await N.api('/api/incidents', { method: 'POST', body: data });
      upsert(res.incident);
      render();
      if (!quiet) announce(res.incident);
      return res.incident;
    } catch (e) {
      N.toast('Could not raise incident', e.message, 'error');
      return null;
    }
  }

  async function update(id, patch) {
    try {
      const res = await N.api(`/api/incidents/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch });
      upsert(res.incident);
      render();
      N.log(`${id} → ${patch.status || 'updated'}`, 'success');
    } catch (e) { N.toast('Update failed', e.message, 'error'); }
  }

  async function remove(id) {
    if (!confirm(`Delete incident ${id}? This cannot be undone.`)) return;
    try {
      await N.api(`/api/incidents/${encodeURIComponent(id)}`, { method: 'DELETE' });
      list = list.filter((i) => i.id !== id);
      render();
    } catch (e) { N.toast('Delete failed', e.message, 'error'); }
  }

  const announced = new Set(); // REST reply and socket broadcast can both deliver the same incident
  function announce(i) {
    if (announced.has(i.id)) return;
    announced.add(i.id);
    const crit = i.severity === 'CRITICAL';
    N.alert(`${crit ? '🚨 ' : ''}${i.severity} incident: ${i.title} (${i.id})`, crit ? 'critical' : 'warn', { toast: true, title: crit ? 'CRITICAL INCIDENT' : 'NEW INCIDENT' });
    if (crit || i.severity === 'HIGH') { N.beep(); N.speak(`${i.severity} incident. ${i.title}`); }
    requestAnimationFrame(() => { const el = document.querySelector(`[data-inc="${i.id}"]`); if (el) el.classList.add('flash'); });
  }

  async function raiseSOS() {
    const btn = $('#sosConfirm');
    btn.disabled = true;
    btn.textContent = 'Locating…';
    let pos = null;
    try { pos = await N.geolocate(6000); } catch { /* broadcast without position */ }
    btn.textContent = 'Broadcasting…';
    const note = $('#sosNote').value.trim();
    const inc = await create({
      title: note || 'SOS: immediate assistance required',
      severity: 'CRITICAL', type: 'other', source: 'sos',
      lat: pos && pos.lat, lon: pos && pos.lon,
      notes: `SOS raised from a field console${pos ? ` (±${Math.round(pos.accuracy)} m)` : ' (no GPS fix)'}.`,
    }, { quiet: true });
    btn.disabled = false;
    btn.textContent = 'Confirm SOS';
    N.closeModal('sosModal');
    $('#sosNote').value = '';
    if (inc) { announce(inc); N.go('incidents'); }
  }

  function init() {
    $('#incidentForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const data = Object.fromEntries(new FormData(form).entries());
      if ((data.lat && !data.lon) || (!data.lat && data.lon)) { N.toast('Coordinates incomplete', 'Enter both latitude and longitude, or neither.', 'warn'); return; }
      data.people_affected = parseInt(data.people_affected || '0', 10) || 0;
      const btn = form.querySelector('[type=submit]');
      btn.disabled = true;
      const inc = await create(data, { quiet: true });
      btn.disabled = false;
      if (inc) { form.reset(); announce(inc); }
    });

    $('#btnIncLocate').addEventListener('click', async () => {
      try {
        const p = await N.geolocate();
        const f = $('#incidentForm');
        f.lat.value = p.lat; f.lon.value = p.lon;
        N.toast('Location set', `${p.lat}, ${p.lon} (±${Math.round(p.accuracy)} m)`, 'success');
      } catch (e) { N.toast('Location unavailable', e.message, 'warn'); }
    });

    $('#incFilter').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      $$('#incFilter button').forEach((x) => x.classList.toggle('active', x === b));
      filter = b.dataset.f;
      render();
    });

    $('#incList').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const inc = list.find((i) => i.id === b.dataset.id);
      if (!inc) return;
      const act = b.dataset.act;
      if (act === 'delete') remove(inc.id);
      else if (act === 'map') N.maps.focus(inc.lat, inc.lon);
      else if (act === 'route') N.maps.routeToPoint(inc.lat, inc.lon);
      else update(inc.id, { status: act });
    });
    $('#incMini').addEventListener('click', () => N.go('incidents'));

    $('#sosBtn').addEventListener('click', () => N.openModal('sosModal'));
    $('#sosConfirm').addEventListener('click', raiseSOS);

    N.onSocket('incident_created', (i) => { upsert(i); render(); announce(i); });
    N.onSocket('incident_updated', (i) => { upsert(i); render(); });
    N.onSocket('incident_deleted', ({ id }) => { list = list.filter((i) => i.id !== id); render(); });
    setInterval(render, 60000); // refresh "x min ago" labels
    return load();
  }

  N.incidents = {
    init,
    create,
    newIncident(prefill = {}) {
      N.go('incidents');
      const f = $('#incidentForm');
      Object.entries(prefill).forEach(([k, v]) => { if (f[k] != null) f[k].value = v; });
      setTimeout(() => f.title.focus(), 80);
    },
    sos: () => N.openModal('sosModal'),
    active,
  };
})();
