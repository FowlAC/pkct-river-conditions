const statusEl = document.querySelector('#status');
const stageEl = document.querySelector('#stage');
const dischargeEl = document.querySelector('#discharge');
const timestampEl = document.querySelector('#timestamp');

async function loadConditions() {
  try {
    statusEl.textContent = 'Loading river conditions...';

    const response = await fetch('/api/conditions');
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.details || data.error);
    }

    const stageValue = data.stage ? `${data.stage.value.toFixed(2)} ft` : 'Unavailable';
    const dischargeValue = data.discharge ? `${data.discharge.value.toFixed(0)} cfs` : 'Unavailable';
    const timestamp = data.timestamp ? new Date(data.timestamp).toLocaleString() : 'Unavailable';

    stageEl.textContent = stageValue;
    dischargeEl.textContent = dischargeValue;
    timestampEl.textContent = timestamp;
    statusEl.textContent = `Updated ${timestamp}`;
  } catch (error) {
    statusEl.textContent = 'Conditions unavailable right now.';
    stageEl.textContent = 'Unavailable';
    dischargeEl.textContent = 'Unavailable';
    timestampEl.textContent = 'N/A';
    console.error(error);
  }
}

document.addEventListener('DOMContentLoaded', loadConditions);
