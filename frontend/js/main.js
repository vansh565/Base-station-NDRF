/* NDRF Command Center · boot sequence
   Starts every module in order. A failing module is logged, never fatal. */
(() => {
  'use strict';
  const N = window.NDRF;
  const { $ } = N;

  const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);

  async function step(label, pct, fn, ms = 8000) {
    try {
      await withTimeout(Promise.resolve().then(fn), ms);
      N.bootStep(label, pct);
    } catch (e) {
      N.bootStep(`${label}: degraded`, pct, false);
      N.log(`${label} failed: ${e.message}`, 'error');
    }
  }

  async function boot() {
    const failsafe = setTimeout(N.finishBoot, 12000);
    N.initCore();
    N.bootStep('Initialising command console', 8);

    await step('Linking to base station', 22, async () => {
      await withTimeout(N.apiReady, 9000);
      await N.loadConfig();
    }, 12000);
    await step('Checking AI and services', 38, async () => {
      const h = await N.checkHealth();
      N.connectSocket();
      if (!h) N.alert('Base station unreachable. Running in offline mode.', 'warn', { toast: true, title: 'OFFLINE MODE' });
    });
    await step('Loading operations map', 52, () => N.maps.init());
    N.camera.init();
    N.analysis.init();
    N.assistant.init();
    await step('Syncing incident board', 66, () => N.incidents.init());
    await step('Loading equipment inventory', 80, () => N.equipment.init());
    await step('Fetching base weather', 94, () => N.weather.init(), 6000);

    clearTimeout(failsafe);
    N.bootStep('Fateh online · all consoles ready', 100);
    N.finishBoot();
    N.alert('Command center online', 'success');

    document.addEventListener('click', (e) => {
      const a = e.target.closest('[data-action]');
      if (!a) return;
      if (a.dataset.action === 'start-camera') N.camera.start();
      if (a.dataset.action === 'new-incident') N.incidents.newIncident();
    });
    $('#btnRecheck').addEventListener('click', async () => { const h = await N.checkHealth(); N.toast(h ? 'Services online' : 'Base unreachable', h ? `AI ${h.ai.enabled ? 'ready' : 'not configured'} · routing ${h.routing}` : 'Check the server or your connection.', h ? 'success' : 'error'); });
    document.querySelectorAll('.shot').forEach((s) => s.addEventListener('click', () => N.lightbox(s.dataset.src)));
    setInterval(N.checkHealth, 60000);
  }

  boot();
})();
