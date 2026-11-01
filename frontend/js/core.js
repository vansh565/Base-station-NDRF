/* NDRF Command Center · core
   Config, API client, event bus, UI helpers (toasts, alerts, logs, ticker),
   navigation, speech output, realtime link and health checks. */
(() => {
  'use strict';

  const HOSTED_API = 'https://base-station-ndrf-7.onrender.com';
  const PANEL_ORDER = ['dashboard', 'map', 'incidents', 'camera', 'analysis', 'assistant', 'weather', 'equipment', 'gallery', 'logs', 'help'];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem('ndrf.' + key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('ndrf.' + key, JSON.stringify(value)); } catch { /* storage unavailable */ }
    },
  };

  const NDRF = (window.NDRF = {
    $, $$, esc, store,
    state: {
      base: { name: 'NDRF Base · Dehradun', lat: 30.3165, lon: 78.0322 },
      backendUp: false,
      aiEnabled: false,
      socketUp: false,
      peakPersons: 0,
      weatherRisk: null,
      startedAt: Date.now(),
      muted: store.get('muted', false),
      panel: 'dashboard',
    },
  });

  /* ---------------- event bus ---------------- */
  const listeners = {};
  NDRF.on = (name, fn) => { (listeners[name] = listeners[name] || []).push(fn); };
  NDRF.emit = (name, data) => (listeners[name] || []).forEach((fn) => { try { fn(data); } catch (e) { console.error(name, e); } });

  /* ---------------- API ---------------- */
  function fetchWithTimeout(url, init = {}, ms = 30000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
  }
  NDRF.fetchWithTimeout = fetchWithTimeout;

  async function looksLikeBackend(base, ms) {
    try {
      const r = await fetchWithTimeout(base + '/api/health', { cache: 'no-store' }, ms);
      return r.ok && (r.headers.get('content-type') || '').includes('json');
    } catch { return false; }
  }

  async function resolveApiBase() {
    const override = new URLSearchParams(location.search).get('api');
    if (override) return override.replace(/\/$/, '');
    if (location.protocol === 'file:') return HOSTED_API;
    if (await looksLikeBackend('', 5000)) return '';            // served by Flask itself
    if (await looksLikeBackend('http://localhost:10000', 2500)) return 'http://localhost:10000';
    return HOSTED_API;                                           // static host / Live Server
  }
  NDRF.apiReady = resolveApiBase().then((base) => { NDRF.apiBase = base; return base; });

  NDRF.api = async function api(path, { method = 'GET', body, form, timeout = 30000 } = {}) {
    const base = await NDRF.apiReady;
    const init = { method, headers: {} };
    if (form) init.body = form;
    else if (body !== undefined) { init.body = JSON.stringify(body); init.headers['Content-Type'] = 'application/json'; }
    let res;
    try {
      res = await fetchWithTimeout(base + path, init, timeout);
    } catch (e) {
      const err = new Error(e.name === 'AbortError' ? 'Request timed out. The server may be waking up, so try again.' : 'Cannot reach the base station server.');
      err.network = true;
      throw err;
    }
    let data = null;
    try { data = await res.json(); } catch { /* non-JSON body */ }
    if (!res.ok) {
      const err = new Error((data && (data.error || data.response)) || `Server error (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  };

  /* ---------------- time helpers ---------------- */
  const IST = { timeZone: 'Asia/Kolkata' };
  NDRF.timeStr = (d = new Date()) => d.toLocaleTimeString('en-GB', { ...IST, hour12: false });
  NDRF.timeAgo = (iso) => {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    return new Date(iso).toLocaleDateString('en-IN', IST);
  };

  /* ---------------- logs ---------------- */
  const logBuffer = [];
  let logFilter = 'all';
  NDRF.log = function log(message, type = 'info') {
    const entry = { t: NDRF.timeStr(), message: String(message), type };
    logBuffer.push(entry);
    if (logBuffer.length > 600) logBuffer.shift();
    (type === 'error' ? console.error : type === 'warn' ? console.warn : console.log)('[NDRF]', message);
    appendLog(entry);
  };
  function appendLog(e) {
    const box = $('#console');
    if (!box) return;
    if (logFilter !== 'all' && e.type !== logFilter) return;
    const div = document.createElement('div');
    div.className = e.type;
    div.innerHTML = `<time>${e.t}</time>${esc(e.message)}`;
    box.appendChild(div);
    while (box.children.length > 600) box.firstChild.remove();
    box.scrollTop = box.scrollHeight;
  }
  function rerenderLogs() {
    const box = $('#console');
    box.innerHTML = '';
    logBuffer.forEach(appendLog);
  }

  /* ---------------- toasts ---------------- */
  const ICONS = { info: 'ℹ️', success: '✅', warn: '⚠️', error: '⛔', critical: '🚨' };
  NDRF.toast = function toast(title, message = '', type = 'info', ms = 4200) {
    const wrap = $('#toasts');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="toast-ico">${ICONS[type] || ICONS.info}</span><div><b>${esc(title)}</b>${esc(message)}</div>`;
    wrap.appendChild(el);
    while (wrap.children.length > 4) wrap.firstChild.remove();
    const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 320); };
    el.addEventListener('click', close);
    setTimeout(close, ms);
  };

  /* ---------------- alert feed + ticker ---------------- */
  const alerts = [];
  NDRF.alert = function alert(message, type = 'info', { toast = false, title } = {}) {
    alerts.unshift({ message, type, t: NDRF.timeStr() });
    if (alerts.length > 40) alerts.pop();
    const feed = $('#alertFeed');
    if (feed) {
      feed.innerHTML = alerts.slice(0, 25).map((a) => `<li class="${a.type}"><time>${a.t}</time><span>${esc(a.message)}</span></li>`).join('');
    }
    const count = alerts.filter((a) => a.type === 'warn' || a.type === 'error' || a.type === 'critical').length;
    const badge = $('#alertCount');
    if (badge) badge.textContent = count;
    updateTicker();
    NDRF.log(message, type === 'critical' ? 'error' : type);
    if (toast) NDRF.toast(title || (type === 'critical' ? 'CRITICAL' : type.toUpperCase()), message, type);
  };
  function updateTicker() {
    const el = $('#ticker');
    if (!el) return;
    const items = alerts.slice(0, 8).map((a) => `<span>${a.t} · ${esc(a.message)}</span>`).join('');
    el.innerHTML = items || '<span>All consoles stand by</span>';
    el.style.animationDuration = `${Math.max(24, el.textContent.length / 7)}s`;
  }

  /* ---------------- status chips & system list ---------------- */
  NDRF.setChip = (id, state) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('on', 'warn', 'err');
    if (state) el.classList.add(state);
  };
  NDRF.setSys = (key, text, cls = '') => {
    const el = document.querySelector(`[data-sys="${key}"]`);
    if (!el) return;
    el.textContent = text;
    el.className = cls;
  };
  NDRF.bumpKpi = (id, value) => {
    const el = document.getElementById(id);
    if (!el || el.textContent === String(value)) return;
    el.textContent = value;
    const card = el.closest('.kpi');
    if (card) { card.classList.remove('bump'); void card.offsetWidth; card.classList.add('bump'); }
  };

  /* ---------------- speech output ---------------- */
  let voice = null;
  function pickVoice() {
    const voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    voice = voices.find((v) => v.lang === 'en-IN') || voices.find((v) => v.lang === 'en-GB') || voices.find((v) => /^en/i.test(v.lang)) || null;
  }
  if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  NDRF.speak = function speak(text) {
    if (NDRF.state.muted || !('speechSynthesis' in window) || !text) return;
    const clean = String(text).replace(/[*_#`>|]/g, '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').slice(0, 600);
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = 'en-IN';
    if (voice) u.voice = voice;
    u.rate = 1.03;
    speechSynthesis.speak(u);
  };
  function renderMute() {
    const btn = $('#muteBtn');
    btn.innerHTML = `<svg><use href="#${NDRF.state.muted ? 'i-mute' : 'i-speaker'}"/></svg>`;
    btn.title = NDRF.state.muted ? 'Voice output off' : 'Voice output on';
  }
  NDRF.setMuted = (muted) => {
    NDRF.state.muted = muted;
    store.set('muted', muted);
    if (muted && window.speechSynthesis) speechSynthesis.cancel();
    renderMute();
  };
  NDRF.beep = () => { const a = $('#beep'); if (a && !NDRF.state.muted) { a.currentTime = 0; a.play().catch(() => {}); } };

  /* ---------------- misc helpers ---------------- */
  NDRF.geolocate = (timeout = 10000) => new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation is not supported on this device.'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: +p.coords.latitude.toFixed(6), lon: +p.coords.longitude.toFixed(6), accuracy: p.coords.accuracy }),
      (e) => reject(new Error(e.code === 1 ? 'Location permission denied.' : 'Could not get your location.')),
      { enableHighAccuracy: true, timeout, maximumAge: 30000 },
    );
  });
  NDRF.download = (filename, content, mime = 'text/plain') => {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  NDRF.parseLatLng = (text) => {
    const m = String(text || '').trim().match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
    if (!m) return null;
    const lat = parseFloat(m[1]); const lon = parseFloat(m[2]);
    return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
  };

  /* ---------------- modals ---------------- */
  NDRF.openModal = (id) => { const m = document.getElementById(id); if (m) { m.hidden = false; const f = m.querySelector('input'); if (f) setTimeout(() => f.focus(), 60); } };
  NDRF.closeModal = (id) => { const m = document.getElementById(id); if (m) m.hidden = true; };
  NDRF.lightbox = (src) => { $('#lightboxImg').src = src; NDRF.openModal('lightbox'); };

  /* ---------------- navigation ---------------- */
  NDRF.go = function go(panel) {
    if (!PANEL_ORDER.includes(panel)) panel = 'dashboard';
    const section = document.getElementById('panel-' + panel);
    $$('.panel').forEach((p) => p.classList.toggle('active', p === section));
    $$('[data-panel]').forEach((a) => a.classList.toggle('active', a.dataset.panel === panel));
    $('#pageTitle').textContent = section.dataset.title.replace('&amp;', '&');
    document.title = `${section.dataset.title.replace('&amp;', '&')} · NDRF Command Center`;
    if (location.hash !== '#' + panel) history.replaceState(null, '', '#' + panel);
    $('#panels').scrollTop = 0;
    document.body.classList.remove('nav-open');
    NDRF.state.panel = panel;
    NDRF.emit('panel', panel);
  };

  function initNavigation() {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('[data-panel]');
      if (link) { e.preventDefault(); NDRF.go(link.dataset.panel); return; }
      const goto = e.target.closest('[data-goto]');
      if (goto) NDRF.go(goto.dataset.goto);
      const closer = e.target.closest('[data-close]');
      if (closer) closer.closest('.modal').hidden = true;
      if (e.target.classList.contains('modal')) e.target.hidden = true;
    });
    $('#menuBtn').addEventListener('click', () => document.body.classList.add('nav-open'));
    $('#sidebarClose').addEventListener('click', () => document.body.classList.remove('nav-open'));
    $('#scrim').addEventListener('click', () => document.body.classList.remove('nav-open'));
    window.addEventListener('hashchange', () => NDRF.go(location.hash.slice(1)));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        $$('.modal').forEach((m) => { m.hidden = true; });
        document.body.classList.remove('nav-open');
        return;
      }
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '/') { e.preventDefault(); NDRF.go('assistant'); setTimeout(() => $('#chatInput').focus(), 50); return; }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9) NDRF.go(PANEL_ORDER[n - 1]);
    });

    $('#muteBtn').addEventListener('click', () => NDRF.setMuted(!NDRF.state.muted));
    renderMute();

    $('#logFilter').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      $$('#logFilter button').forEach((x) => x.classList.toggle('active', x === b));
      logFilter = b.dataset.f;
      rerenderLogs();
    });
    $('#btnClearLogs').addEventListener('click', () => { logBuffer.length = 0; rerenderLogs(); NDRF.log('Console cleared'); });
    $('#btnExportLogs').addEventListener('click', () => {
      NDRF.download(`ndrf-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.txt`,
        logBuffer.map((l) => `[${l.t}] ${l.type.toUpperCase().padEnd(7)} ${l.message}`).join('\n'));
    });
  }

  /* ---------------- clock ---------------- */
  function tick() {
    const now = new Date();
    const t = NDRF.timeStr(now);
    $('#clock').textContent = t;
    $('#clockDate').textContent = now.toLocaleDateString('en-IN', { ...IST, weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    const hud = $('#hudTime');
    if (hud) hud.textContent = t;
    const s = Math.floor((Date.now() - NDRF.state.startedAt) / 1000);
    $('#uptime').textContent = s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  }

  /* ---------------- link & health ---------------- */
  function setLink(state, label) {
    const el = $('#linkState');
    el.className = 'link-state ' + state;
    el.querySelector('span').textContent = label;
  }

  NDRF.checkHealth = async function checkHealth() {
    try {
      const h = await NDRF.api('/api/health', { timeout: 15000 });
      NDRF.state.backendUp = true;
      NDRF.state.aiEnabled = !!(h.ai && h.ai.enabled);
      NDRF.setChip('chipLink', 'on');
      NDRF.setSys('api', `ONLINE · v${h.version || '?'}`, 'ok');
      NDRF.setChip('chipAI', NDRF.state.aiEnabled ? 'on' : 'warn');
      NDRF.setSys('ai', NDRF.state.aiEnabled ? `READY · ${h.ai.model}` : 'NOT CONFIGURED', NDRF.state.aiEnabled ? 'ok' : 'warn');
      if (h.consoles) $('#consoleCount').textContent = h.consoles;
      if (!NDRF.state.socketUp) setLink('on', 'API ONLINE');
      return h;
    } catch (e) {
      NDRF.state.backendUp = false;
      NDRF.setChip('chipLink', 'err');
      NDRF.setChip('chipAI', 'err');
      NDRF.setSys('api', 'UNREACHABLE', 'err');
      NDRF.setSys('ai', 'UNAVAILABLE', 'err');
      setLink('off', 'OFFLINE MODE');
      return null;
    }
  };

  NDRF.loadConfig = async function loadConfig() {
    try {
      const cfg = await NDRF.api('/api/config', { timeout: 15000 });
      if (cfg && cfg.base) NDRF.state.base = cfg.base;
    } catch { /* keep defaults */ }
    $('#baseName').textContent = NDRF.state.base.name;
  };

  /* ---------------- realtime (Socket.IO) ---------------- */
  const socketHandlers = [];
  NDRF.onSocket = (event, fn) => {
    socketHandlers.push([event, fn]);
    if (NDRF.socket) NDRF.socket.on(event, fn);
  };
  NDRF.connectSocket = function connectSocket() {
    if (!window.io) { NDRF.setSys('socket', 'LIBRARY MISSING', 'err'); return; }
    const s = (NDRF.socket = window.io(NDRF.apiBase || undefined, { reconnectionDelayMax: 10000 }));
    socketHandlers.forEach(([ev, fn]) => s.on(ev, fn));
    s.on('connect', () => {
      NDRF.state.socketUp = true;
      setLink('on', 'LINK SECURE');
      NDRF.setSys('socket', 'CONNECTED', 'ok');
      NDRF.log('Realtime link established', 'success');
    });
    s.on('disconnect', () => {
      NDRF.state.socketUp = false;
      setLink('off', 'LINK LOST · RETRYING');
      NDRF.setSys('socket', 'RECONNECTING', 'warn');
    });
    s.on('connect_error', () => NDRF.setSys('socket', 'UNAVAILABLE', 'warn'));
    s.on('presence', (d) => { $('#consoleCount').textContent = d.consoles; });
    s.on('analysis_completed', (d) => {
      if (d && d.risk_level && (d.risk_level === 'HIGH' || d.risk_level === 'CRITICAL')) {
        NDRF.alert(`AI assessment: ${d.risk_level} risk · ${d.people_visible} people visible`, 'warn');
      }
    });
  };

  /* ---------------- boot screen ---------------- */
  let bootPct = 0;
  NDRF.bootStep = (text, pct, ok = true) => {
    const logEl = $('#bootLog');
    const line = document.createElement('div');
    line.textContent = text;
    if (ok) line.className = 'ok';
    logEl.appendChild(line);
    while (logEl.children.length > 5) logEl.firstChild.remove();
    bootPct = Math.max(bootPct, pct);
    $('#bootBar').style.width = bootPct + '%';
  };
  NDRF.finishBoot = () => {
    $('#bootBar').style.width = '100%';
    setTimeout(() => $('#boot').classList.add('done'), 350);
    setTimeout(() => $('#boot').remove(), 1100);
  };

  /* ---------------- init ---------------- */
  NDRF.initCore = function initCore() {
    initNavigation();
    tick();
    setInterval(tick, 1000);
    const start = location.hash.slice(1);
    if (start && start !== 'dashboard') NDRF.go(start);
  };
})();
