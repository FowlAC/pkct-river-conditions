(() => {
  'use strict';

  const stats = document.querySelector('.stats');
  if (!stats) return;

  const SOURCE_URL = 'https://ambientweather.net/dashboard/8950a179e1e7a3eae5670e35c0b4cb08';
  const PRIMARY_ID = 'F8:B3:B7:81:E0:33';
  const BACKUP_ID = 'FC:F5:C4:98:70:34';
  const MAX_AGE_MS = 30 * 60 * 1000;
  const UPDATE_MS = 5 * 60 * 1000;
  const cards = [
    ['Air temperature', 'sellwood-air-temp', 'airTemperatureF', '\u00b0F'],
    ['Wind speed', 'sellwood-wind-speed', 'windSpeedMph', ' mph'],
    ['Wind gusts', 'sellwood-wind-gusts', 'windGustMph', ' mph'],
    ['Wind direction', 'sellwood-wind-direction', 'windFromDegrees', '']
  ];

  // Headings are direct <dt> children of the existing definition list.
  // This keeps the original four USGS cards and their scripts untouched.
  function addHeading(text, beforeNode, id) {
    let heading = document.getElementById(id);
    if (!heading) {
      heading = document.createElement('dt');
      heading.className = 'measurement-section-label';
      heading.id = id;
      heading.textContent = text;
      stats.insertBefore(heading, beforeNode);
    }
    return heading;
  }

  const riverFirstCard = Array.from(stats.children).find(
    (el) => el.tagName === 'DIV' && !el.classList.contains('sellwood-weather-card')
  );
  if (riverFirstCard) {
    addHeading('River measurements', riverFirstCard, 'river-measurements-heading');
  }

  const weatherFirstCard = document.getElementById('sellwood-air-temp')?.closest('.sellwood-weather-card');
  const localHeading = addHeading('Local weather \u00b7 Sellwood area', weatherFirstCard || null, 'local-weather-heading');

  for (const [label, id] of cards) {
    if (document.getElementById(id)) continue;
    const card = document.createElement('div');
    card.className = 'sellwood-weather-card';

    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.id = id;
    dd.textContent = '\u2014';
    const source = document.createElement('small');
    source.className = 'sellwood-weather-source';
    source.textContent = 'Loading local observation\u2026';
    card.append(dt, dd, source);
    stats.appendChild(card);
  }

  // If cards already existed, ensure their heading is before them.
  const firstWeather = document.getElementById('sellwood-air-temp')?.closest('.sellwood-weather-card');
  if (firstWeather && localHeading.nextElementSibling !== firstWeather) {
    stats.insertBefore(localHeading, firstWeather);
  }

  let footer = document.getElementById('sellwood-weather-footer');
  if (!footer) {
    footer = document.createElement('p');
    footer.id = 'sellwood-weather-footer';
    footer.className = 'sellwood-weather-footer';
    stats.insertAdjacentElement('afterend', footer);
  }
  const sourceLink = document.createElement('a');
  sourceLink.href = SOURCE_URL;
  sourceLink.target = '_blank';
  sourceLink.rel = 'noopener noreferrer';
  sourceLink.textContent = 'View original Ambient Weather station';
  const footerDetail = document.createElement('span');
  footer.replaceChildren('Local weather: ', sourceLink, footerDetail);

  function setValue(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function formatNumber(value, suffix) {
    return typeof value === 'number' && Number.isFinite(value)
      ? `${value.toFixed(1)}${suffix}` : 'Unavailable';
  }

  function compass(degrees) {
    if (typeof degrees !== 'number' || !Number.isFinite(degrees)) return 'Unavailable';
    const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const normalized = ((degrees % 360) + 360) % 360;
    return `${points[Math.round(normalized / 22.5) % 16]} (${Math.round(normalized)}\u00b0)`;
  }

  function formatTime(date) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    }).format(date);
  }

  function setSources(text) {
    document.querySelectorAll('.sellwood-weather-source').forEach((node) => {
      node.textContent = text;
    });
  }

  function unavailable() {
    for (const [, id] of cards) setValue(id, 'Unavailable');
    setSources('Local weather \u00b7 No fresh observation');
    footerDetail.textContent = ' \u00b7 No recent station observations available';
  }

  async function refresh() {
    try {
      const response = await fetch('/api/weather', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Weather API returned ${response.status}`);
      const data = await response.json();
      const isPrimary = data.stationId === PRIMARY_ID && data.stationRole === 'primary';
      const isBackup = data.stationId === BACKUP_ID && data.stationRole === 'backup';
      if (!data.available || !(isPrimary || isBackup)) throw new Error('No approved, available station');

      const observation = new Date(data.observationTime);
      const ageMs = Date.now() - observation.getTime();
      if (!Number.isFinite(ageMs) || ageMs < -5 * 60 * 1000 || ageMs > MAX_AGE_MS) {
        throw new Error('Missing or stale weather observation');
      }

      setValue('sellwood-air-temp', formatNumber(data.airTemperatureF, '\u00b0F'));
      setValue('sellwood-wind-speed', formatNumber(data.windSpeedMph, ' mph'));
      setValue('sellwood-wind-gusts', formatNumber(data.windGustMph, ' mph'));
      setValue('sellwood-wind-direction', compass(data.windFromDegrees));

      const station = isBackup ? '444SB \u00b7 Backup' : 'PRCWeather \u00b7 Primary';
      const stamp = formatTime(observation);
      setSources(`${station} \u00b7 ${stamp} PT`);
      footerDetail.textContent = ` \u00b7 ${station} \u00b7 observed ${stamp} PT`;
    } catch (error) {
      unavailable();
      console.warn('Local weather readings unavailable:', error);
    }
  }

  refresh();
  setInterval(refresh, UPDATE_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });
})();
