// PKCT Version 4: standalone velocity chart. Does not modify existing USGS cards.
(() => {
  'use strict';
  const TZ = 'America/Los_Angeles';
  const FT_PER_SEC_TO_MPH = 3600 / 5280;
  const NS = 'http://www.w3.org/2000/svg';
  const fmt = n => Number(n).toFixed(2);

  function makeSVGElement(tag, attrs, content) {
    const element = document.createElementNS(NS, tag);
    for (const [name, val] of Object.entries(attrs)) element.setAttribute(name, String(val));
    if (content != null) element.textContent = content;
    return element;
  }

  function installSection() {
    if (document.getElementById('velocity-chart')) return;
    const stageCard = document.querySelector('.trend-card');
    if (!stageCard) return;
    const section = document.createElement('section');
    section.className = 'card velocity-trend-card';
    section.setAttribute('aria-labelledby', 'velocity-trend-title');
    section.innerHTML = `
      <div class="status-row">
        <h2 id="velocity-trend-title">Current velocity · past 24 hours</h2>
        <span id="velocity-chart-status" class="chart-status" role="status">Loading trend…</span>
      </div>
      <div id="velocity-chart" class="chart" aria-label="Signed current velocity readings over the past 24 hours"></div>
      <p class="metric-note">Broadway Bridge USGS gauge · signed velocity in mph · zero indicates no net measured flow at the gauge; negative readings indicate upstream (reverse) flow at the gauge; positive readings indicate downstream flow. Not a measurement at Oaks Park. Gaps indicate missing data.</p>
    `;
    stageCard.insertAdjacentElement('afterend', section);
  }

  function draw(history) {
    const target = document.getElementById('velocity-chart');
    const status = document.getElementById('velocity-chart-status');
    if (!target || !status) return;
    const end = Date.now();
    const start = end - 24 * 3600000;
    const data = (Array.isArray(history) ? history : [])
      .filter(p => p && Number.isFinite(Number(p.value)) && ![-999999, -99999, -9999].includes(Number(p.value)) && Number.isFinite(Date.parse(p.dateTime)) && Date.parse(p.dateTime) >= start && Date.parse(p.dateTime) <= end + 60000)
      .map(p => ({t: Date.parse(p.dateTime), mph: Number(p.value) * FT_PER_SEC_TO_MPH}))
      .sort((a,b) => a.t-b.t);

    if (data.length < 2) {
      status.textContent = 'Insufficient readings';
      target.textContent = 'Not enough recent velocity readings to draw a trend.';
      return;
    }
    const W = 850, H = 265, L = 68, R = 20, T = 22, B = 45;
    const chartW = W - L - R, chartH = H - T - B;
    const absMax = Math.max(0.15, ...data.map(p => Math.abs(p.mph)));
    const bound = Math.ceil(absMax * 1.15 * 10) / 10;
    const x = t => L + (t - start) / (end - start) * chartW;
    const y = v => T + (bound - v) / (bound * 2) * chartH;
    const svg = makeSVGElement('svg', {viewBox:`0 0 ${W} ${H}`, role:'img', 'aria-label':'24-hour current velocity chart at Broadway Bridge, in miles per hour. Zero line marks flow reversal.'});
    const add = (tag, attrs, content) => {
      const elem = makeSVGElement(tag, attrs, content);
      svg.appendChild(elem);
      return elem;
    };
    const tick = v => `${Math.abs(v) < 0.005 ? '0.00' : fmt(v)}`;
    for (let i=0; i<=4; i++) {
      const v = -bound + i * bound / 2;
      const py = y(v);
      add('line', {x1:L,y1:py,x2:W-R,y2:py,stroke:Math.abs(v)<0.001?'#66798a':'#dfe7ee','stroke-width':Math.abs(v)<0.001?2:1,'stroke-dasharray':Math.abs(v)<0.001?'5 4':'none'});
      add('text', {x:L-10,y:py+5,'text-anchor':'end',fill:'#536170','font-size':13},tick(v));
    }
    for (let i=0; i<=4; i++) {
      const t = start + i * 6 * 3600000;
      const timeLabel = new Intl.DateTimeFormat('en-US',{hour:'numeric',timeZone:TZ}).format(new Date(t));
      add('text', {x:x(t),y:H-10,'text-anchor':i===0?'start':i===4?'end':'middle',fill:'#536170','font-size':13},timeLabel);
    }
    // Split series at gaps > 90 mins (typical reporting interval is much shorter).
    let path = '', prev = null;
    for (const point of data) {
      const separated = prev !== null && point.t-prev > 90*60000;
      path += `${prev === null || separated ? 'M' : 'L'}${x(point.t).toFixed(2)},${y(point.mph).toFixed(2)} `;
      prev = point.t;
    }
    add('path', {d:path,fill:'none',stroke:'#1d7db5','stroke-width':3,'stroke-linecap':'round','stroke-linejoin':'round'});
    status.textContent = `${data.length} observations`;
    target.replaceChildren(svg);
  }

  async function load() {
    installSection();
    const status = document.getElementById('velocity-chart-status');
    if (!status) return;
    try {
      const response = await fetch('/api/conditions', {cache:'no-store'});
      if (!response.ok) throw new Error(`River API returned ${response.status}`);
      const payload = await response.json();
      if (payload.stationId !== '14211720') throw new Error('Unexpected station');
      draw(payload.velocityHistory);
    } catch (error) {
      status.textContent = 'Currently unavailable';
      document.getElementById('velocity-chart').textContent = 'Unable to load the velocity trend.';
      console.error('PKCT velocity chart:', error);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();
