/* NDRF Command Center · Fateh assistant
   Chat UI + Web Speech voice input. Local commands run instantly; anything else goes to Gemini. */
(() => {
  'use strict';
  const N = window.NDRF;
  const { $, esc } = N;

  const COMMANDS = [
    ['start camera / stop camera', 'Control the live drone feed'],
    ['analyze frame', 'AI-assess the current camera frame'],
    ['human only', 'Toggle person-only detection'],
    ['route to <place>', 'Plan a rescue route from base'],
    ['weather in <city>', 'Conditions + disaster risk'],
    ['search equipment <item>', 'Find gear in the inventory'],
    ['new incident', 'Open the incident form'],
    ['sos', 'Raise a CRITICAL SOS'],
    ['status report', 'Spoken situation summary'],
    ['open <panel>', 'map, incidents, weather, logs…'],
    ['mute / unmute', 'Voice output on or off'],
    ['anything else', 'Answered by Gemini AI'],
  ];
  const PANELS = { dashboard: 'dashboard', home: 'dashboard', map: 'map', route: 'map', incident: 'incidents', incidents: 'incidents', camera: 'camera', feed: 'camera', drone: 'camera', analysis: 'analysis', ai: 'analysis', weather: 'weather', equipment: 'equipment', inventory: 'equipment', gallery: 'gallery', logs: 'logs', help: 'help', guide: 'help' };
  const GREETINGS = [
    [/^(hi|hello|hey|namaste)\b/, 'Jai Hind! I am Fateh, your NDRF assistant. How can I help?'],
    [/who are you|your name/, 'I am Fateh, the AI assistant of this NDRF base station.'],
    [/thank/, "You're welcome. Stay safe out there."],
  ];

  let recognition = null;
  let listening = false;
  let history = N.store.get('chat', []);

  function addMsg(role, text, save = true) {
    const chat = $('#chat');
    const div = document.createElement('div');
    div.className = `msg ${role}`;
    div.innerHTML = `<small>${role === 'user' ? 'YOU' : 'FATEH'} · ${N.timeStr().slice(0, 5)}</small>${esc(text)}`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    if (save) { history.push({ role, text }); history = history.slice(-50); N.store.set('chat', history); }
    return div;
  }
  function typing() {
    const div = document.createElement('div');
    div.className = 'msg bot typing';
    div.innerHTML = '<i></i><i></i><i></i>';
    $('#chat').appendChild(div);
    $('#chat').scrollTop = 1e9;
    return div;
  }
  function reply(text) { addMsg('bot', text); N.speak(text); return text; }

  function statusReport() {
    const act = N.incidents.active();
    const crit = act.filter((i) => i.severity === 'CRITICAL').length;
    const wx = N.state.weatherRisk;
    return [
      `${act.length} active incident${act.length === 1 ? '' : 's'}${crit ? `, ${crit} critical` : ''}.`,
      wx ? `Weather risk at base is ${wx.level}: ${wx.advice}` : 'Weather data pending.',
      `Peak persons detected on the feed this session: ${N.state.peakPersons}.`,
      `Backend ${N.state.backendUp ? 'online' : 'offline'}, AI ${N.state.aiEnabled ? 'ready' : 'unavailable'}, camera ${N.camera.isActive() ? 'live' : 'off'}.`,
    ].join(' ');
  }

  async function handle(raw) {
    const text = String(raw || '').trim();
    if (!text) return;
    addMsg('user', text);
    const c = text.toLowerCase().replace(/[?.!]+$/, '');
    let m;

    if (/\b(stop|end)\s+(the\s+)?(camera|feed)\b/.test(c)) { N.camera.stop(); return reply('Drone feed stopped.'); }
    if (/\b(start|open|begin)\s+(the\s+)?(camera|feed|drone)\b/.test(c)) { N.go('camera'); N.camera.start(); return reply('Starting the drone feed.'); }
    if (/\banaly[sz]e\b/.test(c)) {
      if (N.camera.isActive()) { N.camera.analyzeFrame(); return reply('Sending the current frame for AI assessment.'); }
      N.go('analysis'); return reply('Camera is off. Upload or drop an image on the analysis panel.');
    }
    if (/human only|humans only|people only/.test(c)) { const on = N.camera.toggleHumanOnly(); return reply(`Human-only detection ${on ? 'on' : 'off'}.`); }
    if ((m = c.match(/(?:route|path|directions|navigate)\s+to\s+(.+)/))) {
      reply(`Planning a route to ${m[1]}…`);
      const r = await N.maps.planRouteTo(m[1]);
      if (r) addMsg('bot', `Route ready: ${Number(r.distance_km).toFixed(1)} km, about ${Math.round(r.duration_min)} minutes (${r.provider}).`);
      return;
    }
    if ((m = c.match(/(?:weather|temperature|forecast)\s+(?:in|at|for|of)\s+(.+)/)) || (m = c.match(/^weather\s+(.+)/)) || (m = c.match(/^(.+?)\s+weather$/))) {
      const w = await N.weather.check(m[1], { announce: false });
      if (!w) return reply(`I couldn't get the weather for ${m[1]}.`);
      return reply(`${w.location.name}: ${w.current.temp}°C, wind ${w.current.wind} km/h, rain ${w.current.rain} mm. Risk ${w.risk.level}: ${w.risk.advice}`);
    }
    if (/^weather$/.test(c)) { const w = await N.weather.checkBase(false); return reply(w ? `At base: ${w.current.temp}°C, risk ${w.risk.level}. ${w.risk.advice}` : 'Weather unavailable.'); }
    if ((m = c.match(/^(?:search|find)\s+(?:equipment|inventory|gear|stock)?\s*(?:for\s+)?(.+)/) || c.match(/^(?:check|search)\s+(?:equipment|inventory|stock)\s+(?:for\s+)?(.+)/)) && !/^(equipment|inventory)$/.test(m[1])) {
      const res = N.equipment.search(m[1]);
      const top = res.slice(0, 3).map((i) => `${i.name} (${i.quantity})`).join(', ');
      return reply(res.length ? `Found ${res.length} item${res.length > 1 ? 's' : ''} for ${m[1]}: ${top}${res.length > 3 ? '…' : ''}` : `No equipment matches ${m[1]}.`);
    }
    if (/\b(equipment|inventory)\b/.test(c) && c.split(' ').length <= 3) { N.go('equipment'); return reply('Opening the equipment inventory.'); }
    if (/\bsos\b|emergency/.test(c)) { N.incidents.sos(); return reply('SOS dialog open. Confirm to broadcast a critical alert.'); }
    if (/new incident|report (an )?incident|raise (an )?incident/.test(c)) { N.incidents.newIncident(); return reply('Opening the incident form.'); }
    if (/^(status|sitrep)\b|status report|situation report/.test(c)) return reply(statusReport());
    if ((m = c.match(/^(?:open|show|go to)\s+(?:the\s+)?(\w+)/)) && PANELS[m[1]]) { N.go(PANELS[m[1]]); return reply(`Opening ${m[1]}.`); }
    if (/^unmute|voice on/.test(c)) { N.setMuted(false); return reply('Voice output on.'); }
    if (/^mute|voice off/.test(c)) { reply('Voice output off.'); N.setMuted(true); return; }
    if (/stop listening/.test(c)) { stopListening(); return reply('Voice input stopped.'); }
    if (/^(help|commands)$/.test(c)) { return reply('Try: start camera, route to Rishikesh, weather in Guwahati, search equipment rope, status report, or ask me any disaster-response question.'); }
    if (/\btime\b/.test(c) && c.length < 30) return reply(`It is ${N.timeStr().slice(0, 5)} IST.`);
    if (/\bdate|today\b/.test(c) && c.length < 30) return reply(`Today is ${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.`);
    for (const [re, answer] of GREETINGS) if (re.test(c)) return reply(answer);

    const t = typing();
    try {
      const data = await N.api('/api/assistant', { method: 'POST', body: { query: text }, timeout: 60000 });
      t.remove();
      reply(data.response || 'No answer.');
      if (data.intent === 'route' && data.data) N.maps.planRouteTo(data.data.end.name);
    } catch (e) {
      t.remove();
      reply(e.network ? "I can't reach the base server right now. Local commands still work." : e.message);
    }
  }

  /* ---------------- voice input ---------------- */
  function initVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { N.setSys('voice', 'NOT SUPPORTED', 'warn'); return null; }
    const r = new SR();
    r.lang = 'en-IN';
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) { $('#chatInput').value = ''; handle(res[0].transcript); }
        else interim += res[0].transcript;
      }
      if (interim) $('#chatInput').value = interim;
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { N.toast('Microphone blocked', 'Allow microphone access to use voice.', 'error'); stopListening(); }
      else if (e.error !== 'no-speech' && e.error !== 'aborted') N.log('Voice error: ' + e.error, 'warn');
    };
    r.onend = () => { if (listening) setTimeout(() => { try { r.start(); } catch { /* already started */ } }, 300); };
    return r;
  }
  function startListening() {
    recognition = recognition || initVoice();
    if (!recognition) { N.toast('Voice not supported', 'Use Chrome or Edge for voice commands.', 'warn'); return; }
    listening = true;
    try { recognition.start(); } catch { /* already running */ }
    $('#micBtn').classList.add('listening');
    N.setChip('chipVoice', 'on');
    N.setSys('voice', 'LISTENING', 'ok');
    N.log('Voice input active', 'success');
  }
  function stopListening() {
    listening = false;
    if (recognition) recognition.stop();
    $('#micBtn').classList.remove('listening');
    N.setChip('chipVoice', '');
    N.setSys('voice', 'OFF');
  }

  function init() {
    $('#cmdList').innerHTML = COMMANDS.map(([c, d]) => `<li data-cmd="${esc(c.split(' / ')[0].replace(/<.*?>/, '').trim())}"><code>${esc(c)}</code><span>${esc(d)}</span></li>`).join('');
    $('#cmdList').addEventListener('click', (e) => { const li = e.target.closest('[data-cmd]'); if (li) { $('#chatInput').value = li.dataset.cmd + ' '; $('#chatInput').focus(); } });
    $('#quickChips').addEventListener('click', (e) => { const b = e.target.closest('[data-cmd]'); if (b) handle(b.dataset.cmd); });
    $('#composer').addEventListener('submit', (e) => { e.preventDefault(); const v = $('#chatInput').value; $('#chatInput').value = ''; handle(v); });
    $('#micBtn').addEventListener('click', () => (listening ? stopListening() : startListening()));
    $('#btnClearChat').addEventListener('click', () => { history = []; N.store.set('chat', []); $('#chat').innerHTML = ''; addMsg('bot', 'Chat cleared. How can I help?', false); });

    if (history.length) history.forEach((h) => addMsg(h.role, h.text, false));
    else addMsg('bot', 'Jai Hind! I am Fateh. Ask me anything about the operation, or tap the mic and speak a command.', false);
    if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) N.setSys('voice', 'NOT SUPPORTED', 'warn');
  }

  N.assistant = { init, handle };
})();
