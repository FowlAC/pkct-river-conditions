// Self-contained Water Safety card. Does not modify existing USGS application code.
(() => {
  const waterURL = 'https://www.portlandoregon.gov/bes/waterquality/results.cfm?location_id=7133';
  const overflowURL = 'https://www.portland.gov/bes/big-pipe-tracker';

  function appendCard() {
    const main = document.querySelector('main.container') || document.querySelector('main');
    if (!main || document.getElementById('water-safety')) return;

    const card = document.createElement('section');
    card.id = 'water-safety';
    card.className = 'card water-safety-card';
    card.setAttribute('aria-labelledby', 'water-safety-title');
    card.innerHTML = `
      <div class="status-row">
        <h2 id="water-safety-title">Water safety information</h2>
        <span id="safety-checked" class="safety-checked">Checking City sources…</span>
      </div>
      <div class="safety-grid">
        <article class="safety-tile">
          <p class="safety-kicker">E. COLI · SELLWOOD RIVERFRONT DOCK</p>
          <p id="safety-ecoli" class="safety-reading" aria-live="polite">Checking…</p>
          <p id="safety-sampled" class="safety-note">Latest published sample</p>
          <p class="safety-explain">Portland's E. coli samples are periodic, not live. A past result cannot establish today's water quality.</p>
          <a href="${waterURL}" target="_blank" rel="noopener noreferrer">View official test results ↗</a>
        </article>
        <article class="safety-tile">
          <p class="safety-kicker">COMBINED SEWER OVERFLOW (CSO)</p>
          <p id="safety-cso" class="safety-reading" aria-live="polite">Checking…</p>
          <p id="safety-cso-note" class="safety-note">Official City advisory status</p>
          <p class="safety-explain">The Big Pipe tracker may lag by up to 45 minutes. Even without an advisory, other river hazards may exist.</p>
          <a href="${overflowURL}" target="_blank" rel="noopener noreferrer">Check Big Pipe Tracker ↗</a>
        </article>
      </div>
      <p class="safety-disclaimer">Information only — not a paddling safety determination. Check current advisories, recent rainfall, debris, temperature and conditions at your launch site.</p>
    `;
    // Insert water safety before local weather, even after removing the redundant Resources panel.
    const weather = main.querySelector('.weather-section');
    if (weather) main.insertBefore(card, weather);
    else main.appendChild(card);
    refreshSafety();
  }

  const fmtDate = (date) => {
    const [y, m, d] = date.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d, 12)));
  };

  async function refreshSafety() {
    const checked = document.getElementById('safety-checked');
    const reading = document.getElementById('safety-ecoli');
    const sampled = document.getElementById('safety-sampled');
    const cso = document.getElementById('safety-cso');
    const csoNote = document.getElementById('safety-cso-note');
    try {
      const response = await fetch('/api/water-safety', { cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      const when = data.checkedAt ? new Intl.DateTimeFormat('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles'
      }).format(new Date(data.checkedAt)) : null;
      checked.textContent = when ? `City pages checked ${when}` : 'City source check unavailable';

      const w = data.waterQuality || {};
      if (w.available && /^\d{4}-\d{2}-\d{2}$/.test(w.sampleDate)) {
        reading.textContent = w.nonDetect ? 'Not detected' :
          Number.isFinite(w.eColiPer100mL) ? `${w.eColiPer100mL.toLocaleString()} / 100 mL` : 'Unavailable';
        sampled.textContent = `Sample collected ${fmtDate(w.sampleDate)} · historic measurement`;
      } else {
        reading.textContent = 'Result unavailable';
        sampled.textContent = 'Use the official City results page';
      }

      const o = data.overflow || {};
      cso.classList.remove('safety-alert');
      if (o.status === 'none_reported') {
        cso.textContent = 'No advisory reported';
        csoNote.textContent = 'According to the City page when checked; not an all-clear';
      } else if (o.status === 'possible_advisory') {
        cso.textContent = 'Review City advisory';
        cso.classList.add('safety-alert');
        csoNote.textContent = 'Possible advisory on official page — follow City instructions';
      } else {
        cso.textContent = 'Status not verified';
        csoNote.textContent = 'Open the official Big Pipe Tracker';
      }
    } catch (err) {
      checked.textContent = 'City source check unavailable';
      reading.textContent = 'Result unavailable';
      sampled.textContent = 'Use the official City results page';
      cso.textContent = 'Status not verified';
      csoNote.textContent = 'Open the official Big Pipe Tracker';
      console.error('Water safety source check failed', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', appendCard);
  } else appendCard();
})();
