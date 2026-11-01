/* NDRF Command Center · AI damage analysis
   Image intake (drop / paste / upload / live frame) → Gemini → structured briefing. */
(() => {
  'use strict';
  const N = window.NDRF;
  const { $, esc } = N;

  const MAX_MB = 10;
  const STAGES = ['Uploading image…', 'Gemini is assessing damage…', 'Identifying hazards and survivors…', 'Estimating team and equipment…', 'Compiling tactical briefing…'];
  const TYPE_MAP = { earthquake: 'earthquake', flood: 'flood', fire: 'fire', landslide: 'landslide', 'building collapse': 'building collapse', cyclone: 'cyclone', 'road accident': 'road accident', industrial: 'chemical' };

  let blob = null;
  let fileName = 'image.jpg';
  let previewUrl = null;
  let last = null; // { report, meta, imageDataUrl }
  let stageTimer = 0;

  function setBlob(b, name) {
    if (!b || !/^image\//.test(b.type)) { N.toast('Unsupported file', 'Please choose a JPG, PNG or WEBP image.', 'warn'); return false; }
    if (b.size > MAX_MB * 1024 * 1024) { N.toast('Image too large', `Maximum size is ${MAX_MB} MB.`, 'warn'); return false; }
    blob = b;
    fileName = name || b.name || 'image.jpg';
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(b);
    const img = $('#previewImg');
    img.src = previewUrl;
    img.hidden = false;
    $('#dzEmpty').hidden = true;
    $('#btnAnalyze').disabled = false;
    return true;
  }

  async function setDataUrl(dataUrl, name) {
    const b = await (await fetch(dataUrl)).blob();
    return setBlob(b, name);
  }

  function clear() {
    blob = null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    $('#previewImg').hidden = true;
    $('#dzEmpty').hidden = false;
    $('#btnAnalyze').disabled = true;
    $('#fileInput').value = '';
  }

  function showState(state) {
    $('#reportIdle').hidden = state !== 'idle';
    $('#reportLoading').hidden = state !== 'loading';
    $('#report').hidden = state !== 'report';
    $('#dzScan').hidden = state !== 'loading';
  }

  const blobToDataUrl = (b) => new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(b); });

  async function run() {
    if (!blob) { N.toast('No image selected', 'Drop, paste or upload an image first.', 'warn'); return; }
    showState('loading');
    $('#btnAnalyze').disabled = true;
    let i = 0;
    $('#loadingText').textContent = STAGES[0];
    stageTimer = setInterval(() => { i = Math.min(i + 1, STAGES.length - 1); $('#loadingText').textContent = STAGES[i]; }, 2600);

    const form = new FormData();
    form.append('image', blob, fileName);
    let gps = null;
    if ($('#chkGps').checked) {
      try { gps = await N.geolocate(8000); form.append('lat', gps.lat); form.append('lon', gps.lon); }
      catch (e) { N.toast('GPS not attached', e.message, 'warn'); }
    }
    try {
      const data = await N.api('/analyze_image', { method: 'POST', form, timeout: 120000 });
      last = { report: data.report, meta: { model: data.model, ms: data.elapsed_ms, gps, at: new Date() }, imageDataUrl: await blobToDataUrl(blob) };
      render(last);
      const r = data.report;
      const type = r.risk_level === 'CRITICAL' ? 'critical' : r.risk_level === 'HIGH' ? 'warn' : 'success';
      N.alert(`AI assessment: ${r.risk_level} risk (${r.risk_score}/100) · ${r.people_visible} people visible`, type);
      N.speak(`Assessment complete. Risk level ${r.risk_level}. ${r.summary}`);
    } catch (e) {
      showState('idle');
      $('#reportIdle').querySelector('b').textContent = 'Analysis failed';
      $('#reportIdle').querySelector('span').textContent = e.message;
      N.toast('Analysis failed', e.message, 'error', 6000);
      N.log('Analysis failed: ' + e.message, 'error');
    } finally {
      clearInterval(stageTimer);
      $('#btnAnalyze').disabled = !blob;
    }
  }

  function section(title, items, color, full = false, markStock = false) {
    if (!items || !items.length) return '';
    const names = markStock && N.equipment ? N.equipment.names() : [];
    const inStock = (txt) => { const t = txt.toLowerCase(); return names.some((n) => n.length > 3 && (t.includes(n) || n.includes(t))); };
    const lis = items.map((x) => `<li${markStock && inStock(x) ? ' class="instock"' : ''}>${esc(x)}</li>`).join('');
    return `<div class="rsec${full ? ' full' : ''}" style="--sc:${color}"><h5>${title}</h5><ul>${lis}</ul></div>`;
  }

  function render({ report: r, meta }) {
    showState('report');
    const gauge = $('#riskGauge');
    gauge.className = `gauge lvl-${r.risk_level}`;
    gauge.style.setProperty('--v', 0);
    requestAnimationFrame(() => requestAnimationFrame(() => gauge.style.setProperty('--v', r.risk_score)));
    animateNumber($('#riskScore'), r.risk_score);
    $('#riskLevel').textContent = r.risk_level;
    $('#disasterType').textContent = (r.disaster_type || 'assessment').toUpperCase();
    $('#reportSummary').textContent = r.summary;
    $('#peopleVisible').textContent = r.people_visible;
    $('#teamSize').textContent = r.team.personnel || '—';
    $('#reportMeta').textContent = `${meta.model || 'gemini'} · ${(meta.ms / 1000).toFixed(1)}s`;
    $('#reportGrid').innerHTML = [
      section('🚨 IMMEDIATE ACTIONS', r.immediate_actions, 'var(--red)', true),
      section('🔍 OBSERVATIONS', r.observations, 'var(--cyan)'),
      section('☣️ HAZARDS', r.hazards, 'var(--amber)'),
      section('🗺️ STRATEGY', r.strategy, 'var(--blue)'),
      section('👥 TEAM REQUIRED', r.team.units, 'var(--violet)'),
      section('📦 EQUIPMENT NEEDED', r.equipment, 'var(--green)', true, true),
    ].join('');
  }

  function animateNumber(el, to) {
    const t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / 1100); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  function reportText(r, meta) {
    const list = (t, xs) => `${t}\n${(xs && xs.length ? xs : ['none reported']).map((x) => `  - ${x}`).join('\n')}`;
    return [
      'NDRF FIELD ASSESSMENT',
      `Generated: ${meta.at.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`,
      meta.gps ? `Location: ${meta.gps.lat}, ${meta.gps.lon}` : '',
      `Risk: ${r.risk_level} (${r.risk_score}/100) · Type: ${r.disaster_type} · People visible: ${r.people_visible}`,
      '',
      `SUMMARY\n  ${r.summary}`,
      list('IMMEDIATE ACTIONS', r.immediate_actions),
      list('OBSERVATIONS', r.observations),
      list('HAZARDS', r.hazards),
      list('STRATEGY', r.strategy),
      list(`TEAM (${r.team.personnel || '?'} personnel)`, r.team.units),
      list('EQUIPMENT', r.equipment),
    ].filter((x) => x !== '').join('\n\n');
  }

  function reportHtml({ report: r, meta, imageDataUrl }) {
    const li = (xs) => (xs && xs.length ? xs : ['none reported']).map((x) => `<li>${esc(x)}</li>`).join('');
    const color = { LOW: '#16a34a', MEDIUM: '#ca8a04', HIGH: '#ea580c', CRITICAL: '#dc2626' }[r.risk_level];
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>NDRF Field Assessment</title><style>
body{font:15px/1.5 "Segoe UI",Arial,sans-serif;color:#111;max-width:860px;margin:24px auto;padding:0 16px}
h1{font-size:22px;letter-spacing:2px;border-bottom:4px solid #ff8c1a;padding-bottom:8px}
.risk{display:inline-block;padding:4px 12px;border-radius:6px;color:#fff;background:${color};font-weight:700}
img{max-width:100%;border-radius:8px;margin:12px 0}h2{font-size:15px;letter-spacing:1px;margin:18px 0 4px;color:#333}
.meta{color:#555;font-size:13px}@media print{body{margin:0}}</style></head><body>
<h1>NDRF · FIELD ASSESSMENT</h1>
<p class="meta">Generated ${esc(meta.at.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }))} IST${meta.gps ? ` · GPS ${meta.gps.lat}, ${meta.gps.lon}` : ''} · AI model ${esc(meta.model || 'gemini')}</p>
<p><span class="risk">${r.risk_level} · ${r.risk_score}/100</span> &nbsp; <b>${esc(r.disaster_type)}</b> · ${r.people_visible} people visible · ${r.team.personnel || '?'} personnel recommended</p>
<p><b>${esc(r.summary)}</b></p><img src="${imageDataUrl}" alt="Assessed image">
<h2>IMMEDIATE ACTIONS</h2><ul>${li(r.immediate_actions)}</ul><h2>OBSERVATIONS</h2><ul>${li(r.observations)}</ul>
<h2>HAZARDS</h2><ul>${li(r.hazards)}</ul><h2>STRATEGY</h2><ol>${li(r.strategy)}</ol>
<h2>TEAM / UNITS</h2><ul>${li(r.team.units)}</ul><h2>EQUIPMENT</h2><ul>${li(r.equipment)}</ul>
<p class="meta">AI-generated decision support. Verify on the ground before committing resources.</p></body></html>`;
  }

  function init() {
    const dz = $('#dropzone');
    $('#fileInput').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) setBlob(f); });
    ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('drag'); }));
    dz.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) setBlob(f); });
    document.addEventListener('paste', (e) => {
      if (N.state.panel !== 'analysis') return;
      const item = Array.from(e.clipboardData?.items || []).find((x) => x.type.startsWith('image/'));
      if (item) { setBlob(item.getAsFile(), `pasted-${Date.now()}.png`); N.toast('Image pasted', 'Ready for analysis.', 'success'); }
    });
    $('#btnAnalyze').addEventListener('click', run);
    $('#btnClearImage').addEventListener('click', clear);
    $('#btnUseFrame').addEventListener('click', async () => {
      const url = N.camera.captureFrame();
      if (!url) { N.toast('Feed not running', 'Start the drone feed to use a live frame.', 'warn'); return; }
      await setDataUrl(url, `frame-${Date.now()}.jpg`);
    });
    $('#btnSpeakReport').addEventListener('click', () => {
      if (!last) return;
      const r = last.report;
      N.speak(`Risk ${r.risk_level}. ${r.summary}. Immediate actions: ${r.immediate_actions.join('. ')}`);
    });
    $('#btnCopyReport').addEventListener('click', async () => {
      if (!last) return;
      try { await navigator.clipboard.writeText(reportText(last.report, last.meta)); N.toast('Copied', 'Briefing copied to clipboard.', 'success'); }
      catch { N.toast('Copy failed', 'Clipboard not available.', 'warn'); }
    });
    $('#btnDownloadReport').addEventListener('click', () => {
      if (!last) return;
      N.download(`ndrf-assessment-${Date.now()}.html`, reportHtml(last), 'text/html');
    });
    $('#btnReportIncident').addEventListener('click', () => {
      if (!last) return;
      const r = last.report;
      const type = TYPE_MAP[(r.disaster_type || '').toLowerCase()] || 'other';
      N.incidents.create({
        title: `${(r.disaster_type || 'Incident').replace(/^\w/, (c) => c.toUpperCase())}: AI assessment`,
        type, severity: r.risk_level, people_affected: r.people_visible, source: 'ai',
        lat: last.meta.gps && last.meta.gps.lat, lon: last.meta.gps && last.meta.gps.lon,
        notes: `${r.summary}\nActions: ${r.immediate_actions.slice(0, 3).join('; ')}`.slice(0, 1000),
      });
    });
    showState('idle');
  }

  N.analysis = { init, setDataUrl, run, clear };
})();
