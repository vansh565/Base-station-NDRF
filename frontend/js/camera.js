/* NDRF Command Center · live drone / camera feed
   getUserMedia + TF.js COCO-SSD (lazy-loaded), tactical HUD, person alerts, snapshots. */
(() => {
  'use strict';
  const N = window.NDRF;
  const { $, esc } = N;

  const LIBS = [
    'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.18.0/dist/tf.min.js',
    'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.2/dist/coco-ssd.min.js',
  ];
  const COLORS = { person: '#22c55e', car: '#ff8c1a', truck: '#ff8c1a', bus: '#ff8c1a', motorcycle: '#ff8c1a', bicycle: '#ff8c1a', dog: '#a78bfa', cat: '#a78bfa', cow: '#a78bfa', horse: '#a78bfa' };
  const isMobile = matchMedia('(max-width: 768px)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
  const DETECT_EVERY = isMobile ? 220 : 110;
  const PERSON_ALERT_GAP = 15000;

  let video, canvas, ctx, view;
  let stream = null;
  let model = null;
  let modelPromise = null;
  let active = false;
  let busy = false;
  let boxes = true;
  let humanOnly = false;
  let facing = 'environment';
  let lastDetect = 0;
  let lastPersonAlert = 0;
  let inferTimes = [];
  let preds = [];
  let rafId = 0;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const s = Object.assign(document.createElement('script'), { src, async: true, crossOrigin: 'anonymous' });
      s.onload = resolve;
      s.onerror = () => reject(new Error('Could not load ' + src.split('/').slice(-1)[0]));
      document.head.appendChild(s);
    });
  }

  function ensureModel() {
    if (model) return Promise.resolve(model);
    if (modelPromise) return modelPromise;
    N.setSys('model', 'LOADING…', 'warn');
    N.log('Loading detection model (first use)…');
    modelPromise = (async () => {
      for (const src of LIBS) await loadScript(src);
      model = await window.cocoSsd.load({ base: isMobile ? 'lite_mobilenet_v2' : 'mobilenet_v2' });
      N.setSys('model', `COCO-SSD · ${isMobile ? 'LITE' : 'FULL'}`, 'ok');
      N.log('Detection model ready', 'success');
      return model;
    })().catch((e) => {
      modelPromise = null;
      N.setSys('model', 'FAILED', 'err');
      N.toast('Detection unavailable', e.message, 'error');
      throw e;
    });
    return modelPromise;
  }

  async function start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      N.toast('Camera not supported', 'This browser or connection (HTTP) does not allow camera access. Use HTTPS or localhost.', 'error', 7000);
      return;
    }
    stop(true);
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
      });
    } catch (e) {
      const msg = e.name === 'NotAllowedError' ? 'Camera permission denied.' : e.name === 'NotFoundError' ? 'No camera found.' : e.message;
      N.toast('Camera error', msg, 'error');
      N.setChip('chipCam', 'err');
      N.setSys('camera', 'ERROR', 'err');
      return;
    }
    video.srcObject = stream;
    await video.play().catch(() => {});
    await new Promise((r) => (video.videoWidth ? r() : video.addEventListener('loadedmetadata', r, { once: true })));
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    active = true;
    view.classList.add('live');
    view.classList.toggle('mirror', facing === 'user');
    $('#camPlaceholder').hidden = true;
    $('#btnCamStart').disabled = true;
    $('#btnCamStop').disabled = false;
    N.setChip('chipCam', 'on');
    N.setSys('camera', `LIVE · ${video.videoWidth}×${video.videoHeight}`, 'ok');
    N.alert(`Drone feed live (${facing === 'user' ? 'front' : 'rear'} camera)`, 'success');
    loop();
    ensureModel().catch(() => {});
  }

  function stop(silent = false) {
    cancelAnimationFrame(rafId);
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    const wasActive = active;
    active = false;
    if (video) video.srcObject = null;
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!view) return;
    view.classList.remove('live');
    $('#camPlaceholder').hidden = false;
    $('#btnCamStart').disabled = false;
    $('#btnCamStop').disabled = true;
    $('#hudCount').textContent = '0 TARGETS';
    $('#hudFps').textContent = '0 FPS';
    N.setChip('chipCam', '');
    N.setSys('camera', 'OFF');
    if (wasActive && !silent) N.log('Drone feed stopped');
  }

  function loop() {
    if (!active) return;
    rafId = requestAnimationFrame(loop);
    const now = performance.now();
    if (!model || busy || now - lastDetect < DETECT_EVERY || video.readyState < 2) return;
    lastDetect = now;
    busy = true;
    const t0 = performance.now();
    model.detect(video, 20, 0.45).then((p) => {
      inferTimes.push(performance.now() - t0);
      if (inferTimes.length > 20) inferTimes.shift();
      preds = humanOnly ? p.filter((x) => x.class === 'person') : p;
      draw();
      updateList();
    }).catch((e) => console.error('detect', e)).finally(() => { busy = false; });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!boxes) return;
    const s = Math.max(1, canvas.width / 900);
    ctx.lineWidth = 2 * s;
    ctx.font = `600 ${Math.round(14 * s)}px "JetBrains Mono", monospace`;
    preds.forEach((p) => {
      const [x, y, w, h] = p.bbox;
      const c = COLORS[p.class] || '#22d3ee';
      const k = Math.min(w, h) * 0.22;
      ctx.strokeStyle = c;
      ctx.globalAlpha = 0.35;
      ctx.strokeRect(x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.lineWidth = 3.5 * s;
      ctx.beginPath(); // tactical corner brackets
      [[x, y + k, x, y, x + k, y], [x + w - k, y, x + w, y, x + w, y + k], [x, y + h - k, x, y + h, x + k, y + h], [x + w - k, y + h, x + w, y + h, x + w, y + h - k]]
        .forEach(([a, b, c2, d, e, f]) => { ctx.moveTo(a, b); ctx.lineTo(c2, d); ctx.lineTo(e, f); });
      ctx.stroke();
      ctx.lineWidth = 2 * s;
      const label = `${p.class.toUpperCase()} ${Math.round(p.score * 100)}%`;
      const tw = ctx.measureText(label).width + 10 * s;
      const th = 20 * s;
      const ly = y > th + 2 ? y - th - 2 : y + 2;
      ctx.fillStyle = 'rgba(5,10,20,.78)';
      ctx.fillRect(x, ly, tw, th);
      ctx.fillStyle = c;
      ctx.fillRect(x, ly, 3 * s, th);
      ctx.fillText(label, x + 6 * s, ly + th - 6 * s);
    });
  }

  function updateList() {
    const people = preds.filter((p) => p.class === 'person').length;
    const groups = {};
    preds.forEach((p) => {
      const g = (groups[p.class] = groups[p.class] || { n: 0, best: 0 });
      g.n += 1; g.best = Math.max(g.best, p.score);
    });
    const rows = Object.entries(groups).sort((a, b) => (b[0] === 'person') - (a[0] === 'person') || b[1].n - a[1].n);
    $('#detList').innerHTML = rows.length
      ? rows.map(([cls, g]) => `<li style="--c:${COLORS[cls] || '#22d3ee'}"><i></i><span>${esc(cls)} ×${g.n}</span><span class="bar"><u style="width:${Math.round(g.best * 100)}%"></u></span><b>${Math.round(g.best * 100)}%</b></li>`).join('')
      : `<li class="empty">${humanOnly ? 'No people in view' : 'No objects in view'}</li>`;
    $('#detCount').textContent = preds.length;
    $('#hudCount').textContent = `${preds.length} TARGETS · ${people} PERSON${people === 1 ? '' : 'S'}`;
    const avg = inferTimes.reduce((a, b) => a + b, 0) / (inferTimes.length || 1);
    $('#hudFps').textContent = `${Math.min(60, Math.round(1000 / Math.max(avg, DETECT_EVERY)))} DET/S`;

    if (people > N.state.peakPersons) { N.state.peakPersons = people; N.bumpKpi('kpiSurvivors', people); }
    const now = Date.now();
    if (people > 0 && now - lastPersonAlert > PERSON_ALERT_GAP) {
      lastPersonAlert = now;
      N.alert(`👤 ${people} person${people > 1 ? 's' : ''} detected on live feed`, 'warn', { toast: N.state.panel !== 'camera', title: 'PERSON DETECTED' });
      N.beep();
    }
  }

  /** Current frame as a JPEG data URL (without overlays). */
  function captureFrame(withBoxes = false) {
    if (!active || !video.videoWidth) return null;
    const c = document.createElement('canvas');
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    const cx = c.getContext('2d');
    cx.drawImage(video, 0, 0);
    if (withBoxes) cx.drawImage(canvas, 0, 0);
    return c.toDataURL('image/jpeg', 0.85);
  }

  function snapshot() {
    const url = captureFrame(true);
    if (!url) { N.toast('Feed not running', 'Start the drone feed first.', 'warn'); return; }
    const wrap = $('#snaps');
    wrap.querySelector('.empty')?.remove();
    const img = Object.assign(document.createElement('img'), { src: url, alt: `Snapshot ${N.timeStr()}`, title: 'Tap to analyze with AI' });
    img.addEventListener('click', () => { N.analysis.setDataUrl(url, `snapshot-${Date.now()}.jpg`); N.go('analysis'); });
    wrap.prepend(img);
    while (wrap.children.length > 9) wrap.lastChild.remove();
    N.log('Snapshot captured', 'success');
  }

  function toggleFullscreen() {
    const el = view;
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else (el.requestFullscreen || el.webkitRequestFullscreen || (() => N.toast('Fullscreen unavailable', '', 'warn'))).call(el);
  }

  function setToggle(id, on) { $('#' + id).setAttribute('aria-pressed', String(on)); }

  function init() {
    video = $('#camVideo');
    canvas = $('#camCanvas');
    ctx = canvas.getContext('2d');
    view = $('#camView');
    $('#btnCamStart').addEventListener('click', start);
    $('#btnCamStop').addEventListener('click', () => stop());
    $('#btnCamFlip').addEventListener('click', () => { facing = facing === 'environment' ? 'user' : 'environment'; if (active) start(); else N.toast('Camera switched', facing === 'user' ? 'Front camera' : 'Rear camera'); });
    $('#btnBoxes').addEventListener('click', () => { boxes = !boxes; setToggle('btnBoxes', boxes); draw(); });
    $('#btnHumanOnly').addEventListener('click', () => api.toggleHumanOnly());
    $('#btnSnap').addEventListener('click', snapshot);
    $('#btnFullscreen').addEventListener('click', toggleFullscreen);
    $('#btnCamAnalyze').addEventListener('click', () => api.analyzeFrame());
    document.addEventListener('visibilitychange', () => { if (document.hidden && active && isMobile) stop(); });
  }

  const api = (N.camera = {
    init,
    start,
    stop: () => stop(),
    isActive: () => active,
    captureFrame,
    toggleHumanOnly() {
      humanOnly = !humanOnly;
      setToggle('btnHumanOnly', humanOnly);
      N.log(`Human-only mode ${humanOnly ? 'on' : 'off'}`);
      return humanOnly;
    },
    analyzeFrame() {
      const url = captureFrame();
      if (!url) { N.toast('Feed not running', 'Start the drone feed first.', 'warn'); return false; }
      N.analysis.setDataUrl(url, `frame-${Date.now()}.jpg`).then(() => N.analysis.run());
      N.go('analysis');
      return true;
    },
  });
})();
