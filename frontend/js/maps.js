/* NDRF Command Center · maps
   Leaflet operations map + dashboard mini map, incident markers and routing. */
(() => {
  'use strict';
  const N = window.NDRF;
  const { $, $$, esc } = N;

  // All keyless providers. Each layer is a list of [url, options] stacked bottom to top.
  const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
  const TILES = {
    dark: [
      [`${ESRI}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`, { attribution: 'Basemap &copy; Esri, HERE, OpenStreetMap', maxNativeZoom: 16, maxZoom: 19 }],
      [`${ESRI}/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, { maxNativeZoom: 16, maxZoom: 19 }],
    ],
    sat: [
      [`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, { attribution: 'Imagery &copy; Esri, Maxar, Earthstar', maxZoom: 19 }],
      [`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 19 }],
    ],
    street: [['https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }]],
  };
  const tileLayer = (name) => L.layerGroup(TILES[name].map(([url, o]) => L.tileLayer(url, o)));
  const SEV = { LOW: '#22d3ee', MEDIUM: '#f5b70b', HIGH: '#ff8c1a', CRITICAL: '#ef4444' };

  let ops = null;
  let mini = null;
  let opsTiles = null;
  const incGroups = {};
  const routeGroups = {};
  let meMarker = null;
  let destMarker = null;
  let lastIncidents = [];

  const pin = (color, cls = '') => L.divIcon({ className: '', html: `<div class="map-pin ${cls}" style="--c:${color}"></div>`, iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -10] });

  function makeMap(id, opts = {}) {
    const b = N.state.base;
    const m = L.map(id, { zoomControl: true, attributionControl: true, ...opts }).setView([b.lat, b.lon], 11);
    const tiles = tileLayer('dark').addTo(m);
    L.marker([b.lat, b.lon], { icon: pin('#22c55e', 'base'), zIndexOffset: 1000 })
      .addTo(m).bindPopup(`<b>${esc(b.name)}</b><br>Base of operations`);
    incGroups[id] = L.layerGroup().addTo(m);
    routeGroups[id] = L.layerGroup().addTo(m);
    return { m, tiles };
  }

  function init() {
    if (!window.L) {
      ['miniMap', 'opsMap'].forEach((id) => { $('#' + id).innerHTML = '<div class="empty">Map library failed to load. Check your internet connection.</div>'; });
      N.log('Leaflet not loaded: maps disabled', 'error');
      return;
    }
    mini = makeMap('miniMap', { zoomControl: false, scrollWheelZoom: false, dragging: !L.Browser.mobile, tap: false }).m;
    const o = makeMap('opsMap');
    ops = o.m;
    opsTiles = o.tiles;

    ops.on('click', (e) => {
      const { lat, lng } = e.latlng;
      $('#routeTo').value = `${lat.toFixed(5)},${lng.toFixed(5)}`;
      setDest(lat, lng, 'Selected point');
    });

    $('#layerSeg').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      $$('#layerSeg button').forEach((x) => x.classList.toggle('active', x === b));
      ops.removeLayer(opsTiles);
      opsTiles = tileLayer(b.dataset.layer).addTo(ops);
    });
    $('#btnRoute').addEventListener('click', () => planRoute());
    $('#routeTo').addEventListener('keydown', (e) => { if (e.key === 'Enter') planRoute(); });
    $('#btnClearRoute').addEventListener('click', clearRoute);
    $('#btnLocate').addEventListener('click', locateMe);
    $('#btnFitIncidents').addEventListener('click', fitIncidents);

    N.on('panel', (p) => {
      if (p === 'map') setTimeout(() => ops.invalidateSize(), 60);
      if (p === 'dashboard') setTimeout(() => mini.invalidateSize(), 60);
    });
    N.on('incidents:changed', renderIncidents);
    window.addEventListener('resize', () => { ops.invalidateSize(); mini.invalidateSize(); });
    N.log('Operations map ready', 'success');
  }

  function setDest(lat, lon, label) {
    if (destMarker) ops.removeLayer(destMarker);
    destMarker = L.marker([lat, lon], { icon: pin('#ef4444') }).addTo(ops).bindPopup(`<b>${esc(label)}</b><br>${lat.toFixed(4)}, ${lon.toFixed(4)}`);
  }

  function renderIncidents(list) {
    lastIncidents = (list || []).filter((i) => i.lat != null && i.lon != null && i.status !== 'RESOLVED');
    if (!ops) return;
    Object.values(incGroups).forEach((g) => g.clearLayers());
    lastIncidents.forEach((i) => {
      const html = `<b>${esc(i.title)}</b><br>${esc(i.severity)} · ${esc(i.status)} · ${esc(i.type)}<br><small>${esc(i.id)} · ${N.timeAgo(i.created_at)}</small>`;
      Object.values(incGroups).forEach((g) => L.marker([i.lat, i.lon], { icon: pin(SEV[i.severity] || SEV.MEDIUM) }).bindPopup(html).addTo(g));
    });
  }

  function fitIncidents() {
    if (!ops) return;
    const pts = lastIncidents.map((i) => [i.lat, i.lon]);
    if (!pts.length) { N.toast('No mapped incidents', 'Active incidents with coordinates appear here.', 'info'); return; }
    pts.push([N.state.base.lat, N.state.base.lon]);
    ops.fitBounds(pts, { padding: [40, 40], maxZoom: 14 });
  }

  async function locateMe() {
    try {
      const p = await N.geolocate();
      if (meMarker) ops.removeLayer(meMarker);
      meMarker = L.marker([p.lat, p.lon], { icon: pin('#22d3ee') }).addTo(ops).bindPopup(`<b>You are here</b><br>±${Math.round(p.accuracy)} m`);
      ops.flyTo([p.lat, p.lon], 15, { duration: 1.2 });
      return p;
    } catch (e) {
      N.toast('Location unavailable', e.message, 'warn');
      return null;
    }
  }

  function clearRoute() {
    Object.values(routeGroups).forEach((g) => g.clearLayers());
    if (destMarker) { ops.removeLayer(destMarker); destMarker = null; }
    ['routeKm', 'routeEta', 'routeProv'].forEach((id) => { $('#' + id).textContent = '--'; });
  }

  function haversine(a, b) {
    const R = 6371; const r = Math.PI / 180;
    const dLat = (b.lat - a.lat) * r; const dLon = (b.lon - a.lon) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  /** Browser-side fallback when the backend is unreachable. */
  async function routeDirect(start, end) {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson`;
      const r = await N.fetchWithTimeout(url, {}, 15000);
      const d = await r.json();
      const route = d.routes[0];
      return { provider: 'osrm (direct)', distance_km: route.distance / 1000, duration_min: route.duration / 60, coordinates: route.geometry.coordinates.map(([lo, la]) => [la, lo]), start, end };
    } catch {
      const km = haversine(start, end);
      return { provider: 'estimate', distance_km: km, duration_min: km * 2.5, coordinates: [[start.lat, start.lon], [end.lat, end.lon]], start, end };
    }
  }

  async function planRoute(destText) {
    const to = (destText ?? $('#routeTo').value).trim();
    if (!to) { N.toast('Destination needed', 'Type a place, enter lat,lng or tap the map.', 'warn'); $('#routeTo').focus(); return null; }
    $('#routeTo').value = to;
    const btn = $('#btnRoute');
    btn.disabled = true;
    btn.lastChild.textContent = 'Planning…';
    try {
      let start = { ...N.state.base };
      if ($('#routeFrom').value === 'me') {
        const p = await locateMe();
        if (p) start = { name: 'My location', lat: p.lat, lon: p.lon };
      }
      const coords = N.parseLatLng(to);
      const body = { start_lat: start.lat, start_lon: start.lon };
      if (coords) Object.assign(body, { end_lat: coords.lat, end_lon: coords.lon, destination: to });
      else body.destination = to;

      let data;
      try {
        data = await N.api('/api/route', { method: 'POST', body, timeout: 35000 });
      } catch (e) {
        if (!e.network || !coords) throw e;
        N.log('Backend unreachable: routing directly from the browser', 'warn');
        data = await routeDirect(start, { name: to, lat: coords.lat, lon: coords.lon });
      }
      drawRoute(data);
      return data;
    } catch (e) {
      N.toast('Route failed', e.message, 'error');
      N.log('Route failed: ' + e.message, 'error');
      return null;
    } finally {
      btn.disabled = false;
      btn.lastChild.textContent = 'Plan Route';
    }
  }

  function drawRoute(data) {
    if (!ops || !data || !data.coordinates) return;
    Object.values(routeGroups).forEach((g) => g.clearLayers());
    [[ops, routeGroups.opsMap], [mini, routeGroups.miniMap]].forEach(([map, group]) => {
      L.polyline(data.coordinates, { color: '#ff8c1a', weight: 11, opacity: 0.18 }).addTo(group);
      L.polyline(data.coordinates, { color: '#ffb347', weight: 4, opacity: 0.95, className: 'route-line', dashArray: data.provider === 'estimate' ? '6 10' : null }).addTo(group);
      map.fitBounds(data.coordinates, { padding: [40, 40] });
    });
    setDest(data.end.lat, data.end.lon, data.end.name || 'Destination');
    const km = Number(data.distance_km).toFixed(1);
    const mins = Math.round(data.duration_min);
    const eta = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`;
    $('#routeKm').textContent = `${km} km`;
    $('#routeEta').textContent = eta;
    $('#routeProv').textContent = data.provider.toUpperCase();
    const msg = `Route to ${data.end.name || 'destination'}: ${km} km, about ${eta}`;
    N.alert(msg + (data.provider === 'estimate' ? ' (straight-line estimate)' : ''), 'success');
    N.speak(msg);
  }

  N.maps = {
    init,
    planRouteTo(dest) { N.go('map'); return planRoute(dest); },
    focus(lat, lon) { N.go('map'); setTimeout(() => ops && ops.flyTo([lat, lon], 15, { duration: 1 }), 120); },
    routeToPoint(lat, lon) { N.go('map'); $('#routeFrom').value = 'base'; return planRoute(`${lat},${lon}`); },
  };
})();
