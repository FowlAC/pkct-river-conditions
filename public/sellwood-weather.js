(() => {
  const stats = document.querySelector('.stats');
  if (!stats) return;

  const primaryUrl = 'https://ambientweather.net/dashboard/8950a179e1e7a3eae5670e35c0b4cb08';
  const cards = [
    ['Air temperature', 'sellwood-air-temp'],
    ['Wind speed', 'sellwood-wind-speed'],
    ['Wind gusts', 'sellwood-wind-gusts'],
    ['Wind direction', 'sellwood-wind-direction']
  ];

  for (const [label, id] of cards) {
    if (document.getElementById(id)) continue;
    const card = document.createElement('div');
    card.className = 'sellwood-weather-card';
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.id = id;
    dd.textContent = '—';
    const source = document.createElement('small');
    source.className = 'sellwood-weather-source';
    source.textContent = 'Local station · Loading…';
    card.append(dt, dd, source);
    stats.appendChild(card);
  }

  let footer = document.getElementById('sellwood-weather-footer');
  if (!footer) {
    footer = document.createElement('p');
    footer.className = 'sellwood-weather-footer';
    footer.id = 'sellwood-weather-footer';
    stats.insertAdjacentElement('afterend', footer);
  }
  const sourceLink = document.createElement('a');
  sourceLink.href = primaryUrl;
  sourceLink.target = '_blank';
  sourceLink.rel = 'noopener noreferrer';
  sourceLink.textContent = 'Original PRCWeather dashboard';
  const footerDetail = document.createElement('span');
  footer.replaceChildren('Local weather: ', sourceLink, footerDetail);

  function display(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }
  const format = (value, unit) => typeof value === 'number' && Number.isFinite(value)
    ? `${value.toFixed(1)}${unit}` : 'Unavailable';
  function compass(degrees) {
    if (typeof degrees !== 'number' || !Number.isFinite(degrees)) return 'Unavailable';
    const points = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    const normalized = ((degrees % 360) + 360) % 360;
    return `${points[Math.round(normalized / 22.5) % 16]} (${Math.round(degrees)}°)`;
  }
  function showStation(label) {
    document.querySelectorAll('.sellwood-weather-source').forEach(el => {
      el.textContent = label;
    });
  }
  function showUnavailable() {
    for (const [, id] of cards) display(id, 'Unavailable');
    showStation('Local station · Unavailable');
    footerDetail.textContent = ' · No recent observations available';
  }

  async function refresh() {
    try {
      const request = await fetch('/api/weather', { cache: 'no-store' });
      if (!request.ok) throw new Error('Weather API unavailable');
      const data = await request.json();
      const isPrimary = data.stationId === 'F8:B3:B7:81:E0:33' && data.stationRole === 'primary';
      const isBackup = data.stationId === 'FC:F5:C4:98:70:34' && data.stationRole === 'backup';
      if (!data.available || !(isPrimary || isBackup)) throw new Error('No approved station');

      display('sellwood-air-temp', format(data.airTemperatureF, '°F'));
      display('sellwood-wind-speed', format(data.windSpeedMph, ' mph'));
      display('sellwood-wind-gusts', format(data.windGustMph, ' mph'));
      display('sellwood-wind-direction', compass(data.windFromDegrees));
      const stationLabel = isBackup ? '444SB · Backup station' : 'PRCWeather · Primary station';
      showStation(stationLabel);
      const t = data.observationTime ? new Date(data.observationTime) : null;
      const stamp = t && Number.isFinite(t.getTime())
        ? t.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'short', timeStyle: 'short' }) + ' PT'
        : 'Time unavailable';
      footerDetail.textContent = ` · Showing ${stationLabel}, observed ${stamp}`;
    } catch (error) {
      showUnavailable();
    }
  }

  refresh();
  setInterval(refresh, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });
})();
