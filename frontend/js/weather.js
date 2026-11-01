/* NDRF Command Center · weather risk
   Backend /api/weather (risk engine) with a direct Open-Meteo fallback. */
(() => {
  'use strict';
  const N = window.NDRF;
  const { $, esc } = N;

  const WMO = {
    0: ['☀️', 'Clear sky'], 1: ['🌤️', 'Mainly clear'], 2: ['⛅', 'Partly cloudy'], 3: ['☁️', 'Overcast'],
    45: ['🌫️', 'Fog'], 48: ['🌫️', 'Rime fog'], 51: ['🌦️', 'Light drizzle'], 53: ['🌦️', 'Drizzle'], 55: ['🌧️', 'Dense drizzle'],
    61: ['🌧️', 'Light rain'], 63: ['🌧️', 'Rain'], 65: ['🌧️', 'Heavy rain'], 66: ['🌧️', 'Freezing rain'], 67: ['🌧️', 'Freezing rain'],
    71: ['🌨️', 'Light snow'], 73: ['🌨️', 'Snow'], 75: ['❄️', 'Heavy snow'], 77: ['🌨️', 'Snow grains'],
    80: ['🌦️', 'Rain showers'], 81: ['🌧️', 'Heavy showers'], 82: ['⛈️', 'Violent showers'], 85: ['🌨️', 'Snow showers'], 86: ['🌨️', 'Snow showers'],
    95: ['⛈️', 'Thunderstorm'], 96: ['⛈️', 'Thunderstorm + hail'], 99: ['⛈️', 'Severe thunderstorm'],
  };
  const LVL_COLOR = { LOW: 'var(--green)', MEDIUM: 'var(--amber)', HIGH: 'var(--orange)', CRITICAL: 'var(--red)' };
  const fmt = (v, unit, d = 0) => (v == null ? '--' : `${Number(v).toFixed(d)}${unit}`);

  /** Same rule cascade as the backend, used only in offline fallback. */
  function localRisk(c) {
    const rain = c.rain || 0; const wind = c.wind || 0; const gust = c.gust || 0; const temp = c.temp || 0;
    let r;
    if (rain > 5) r = ['HIGH', 90, 'Flood risk: deploy boats and water rescue teams.'];
    else if (wind > 40 || gust > 60) r = ['HIGH', 85, 'High wind: ground the drones and secure the area.'];
    else if (temp > 40) r = ['MEDIUM', 60, 'Heat risk: activate medical and hydration units.'];
    else if (rain > 1 || wind > 25) r = ['MEDIUM', 45, 'Unsettled weather: brief teams and monitor closely.'];
    else r = ['LOW', 20, 'Safe conditions. Monitoring active.'];
    const flags = [];
    if (wind > 30) flags.push('Drone flight not advised (limit 30 km/h)');
    if (rain > 0) flags.push('Rain: slippery debris and low visibility');
    if (temp < 5) flags.push('Cold exposure risk for survivors');
    return { level: r[0], score: r[1], advice: r[2], flags };
  }

  async function fetchDirect({ city, lat, lon, name }) {
    if (city) {
      const g = await (await N.fetchWithTimeout(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en`, {}, 12000)).json();
      if (!g.results || !g.results.length) throw new Error(`Couldn't find '${city}'.`);
      ({ latitude: lat, longitude: lon } = g.results[0]);
      name = [g.results[0].name, g.results[0].admin1, g.results[0].country].filter(Boolean).join(', ');
    }
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=auto&forecast_days=3`
      + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m'
      + '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code';
    const d = await (await N.fetchWithTimeout(url, {}, 12000)).json();
    const c = d.current;
    const current = { temp: c.temperature_2m, feels_like: c.apparent_temperature, humidity: c.relative_humidity_2m, rain: c.precipitation, wind: c.wind_speed_10m, gust: c.wind_gusts_10m, cloud: c.cloud_cover, code: c.weather_code };
    const daily = d.daily.time.map((t, i) => ({ date: t, t_max: d.daily.temperature_2m_max[i], t_min: d.daily.temperature_2m_min[i], rain: d.daily.precipitation_sum[i], wind_max: d.daily.wind_speed_10m_max[i], code: d.daily.weather_code[i] }));
    return { location: { name: name || `${lat}, ${lon}`, lat, lon }, current, daily, risk: localRisk(current) };
  }

  async function load(params) {
    const q = params.city ? `city=${encodeURIComponent(params.city)}` : `lat=${params.lat}&lon=${params.lon}&name=${encodeURIComponent(params.name || '')}`;
    try {
      return await N.api(`/api/weather?${q}`, { timeout: 20000 });
    } catch (e) {
      if (e.status === 404) throw e;
      N.log('Weather via backend failed, using Open-Meteo directly', 'warn');
      return fetchDirect(params);
    }
  }

  function render(w) {
    const c = w.current; const r = w.risk;
    const [ico, desc] = WMO[c.code] || ['🌡️', 'Current conditions'];
    $('#wxPlace').textContent = w.location.name;
    $('#wxBigTemp').textContent = fmt(c.temp, '°', 1);
    $('#wxDesc').textContent = `${ico} ${desc}`;
    $('#wxFeels').textContent = fmt(c.feels_like, '°C', 1);
    $('#wxWindG').textContent = `${fmt(c.wind, '')} / ${fmt(c.gust, ' km/h')}`;
    $('#wxRainNow').textContent = fmt(c.rain, ' mm', 1);
    $('#wxHumNow').textContent = fmt(c.humidity, '%');
    $('#wxCloud').textContent = fmt(c.cloud, '%');
    const droneOk = (c.wind || 0) <= 30 && (c.gust || 0) <= 45 && (c.rain || 0) < 2;
    $('#wxDrone').innerHTML = droneOk ? '<span style="color:var(--green)">GO ✓</span>' : '<span style="color:var(--red)">NO-GO ✕</span>';

    const pill = $('#wxRiskPill');
    pill.className = `pill lvl-${r.level}`;
    pill.textContent = r.level;
    const g = $('#wxGauge');
    g.className = `gauge big lvl-${r.level}`;
    requestAnimationFrame(() => g.style.setProperty('--v', r.score));
    $('#wxScore').textContent = r.score;
    $('#wxAdvice').textContent = r.advice;
    $('#wxFlags').innerHTML = (r.flags || []).map((f) => `<li>${esc(f)}</li>`).join('');
    $('#wxDays').innerHTML = (w.daily || []).map((d, i) => {
      const [di, dd] = WMO[d.code] || ['🌡️', ''];
      const label = i === 0 ? 'Today' : new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
      return `<div class="day" style="animation-delay:${i * 0.08}s"><small>${label}</small><span class="ico">${di}</span><b>${fmt(d.t_max, '°')} / ${fmt(d.t_min, '°')}</b><small>${esc(dd)}</small><small>🌧 ${fmt(d.rain, ' mm', 1)} · 💨 ${fmt(d.wind_max, ' km/h')}</small></div>`;
    }).join('');
  }

  function renderDashboard(w) {
    const c = w.current; const r = w.risk;
    N.state.weatherRisk = r;
    $('#wxTemp').textContent = fmt(c.temp, '°C', 1);
    $('#wxWind').textContent = fmt(c.wind, ' km/h');
    $('#wxRain').textContent = fmt(c.rain, ' mm', 1);
    $('#wxHum').textContent = fmt(c.humidity, '%');
    $('#aiDecision').textContent = `${r.advice} (${w.location.name.split(',')[0]})`;
    const pill = $('#decisionPill');
    pill.className = `pill lvl-${r.level}`;
    pill.textContent = r.level;
    const bar = $('#decisionBar');
    bar.style.width = r.score + '%';
    bar.style.background = LVL_COLOR[r.level];
    bar.style.color = LVL_COLOR[r.level];
    N.bumpKpi('kpiRisk', r.level);
    $('#kpiRiskFoot').textContent = `${fmt(c.temp, '°C', 0)} · ${w.location.name.split(',')[0]}`;
  }

  async function check(params, { announce = true, dashboard = false } = {}) {
    try {
      const w = await load(params);
      render(w);
      if (dashboard) renderDashboard(w);
      if (announce) {
        const msg = `${w.location.name.split(',')[0]}: ${fmt(w.current.temp, '°C', 1)}, wind ${fmt(w.current.wind, ' km/h')}. Risk ${w.risk.level}. ${w.risk.advice}`;
        N.alert(msg, w.risk.level === 'HIGH' || w.risk.level === 'CRITICAL' ? 'warn' : 'info');
        N.speak(msg);
        if (w.risk.level === 'HIGH') N.beep();
      }
      return w;
    } catch (e) {
      N.toast('Weather unavailable', e.message, 'warn');
      return null;
    }
  }

  const checkBase = (announce = false) => check({ ...N.state.base }, { announce, dashboard: true });

  function init() {
    $('#wxForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const city = $('#wxCity').value.trim();
      if (city) check({ city });
    });
    $('#wxBase').addEventListener('click', () => checkBase(true));
    setInterval(() => checkBase(false), 15 * 60 * 1000);
    return checkBase(false);
  }

  N.weather = {
    init,
    check: (city, opts) => check({ city }, opts),
    checkBase,
  };
})();
