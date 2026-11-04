const STATIONS = [
  { id: 'F8:B3:B7:81:E0:33', name: 'PRCWeather', role: 'primary' },
  { id: 'FC:F5:C4:98:70:34', name: '444SB', role: 'backup' }
];
const MAX_AGE_MS = 30 * 60 * 1000;
const SEARCH_ENDPOINT = 'https://lightning.ambientweather.net/devices';

function numberOrNull(value, low, high) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= low && number <= high
    ? number : null;
}

function toMillis(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return number < 1e11 ? number * 1000 : number;
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function response(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

function validStation(devices, config, now) {
  const device = devices.find(d =>
    String(d?.macAddress || '').toUpperCase() === config.id
  );
  if (!device) return null;
  if (String(device?.info?.name || '').trim().toLowerCase() !== config.name.toLowerCase()) {
    return null;
  }

  const raw = device.lastData || {};
  const observationMs = toMillis(raw.dateutc ?? raw.created_at);
  if (observationMs === null) return null;
  const age = now - observationMs;
  if (age < -5 * 60 * 1000 || age > MAX_AGE_MS) return null;

  const weather = {
    airTemperatureF: numberOrNull(raw.tempf, -100, 150),
    windSpeedMph: numberOrNull(raw.windspeedmph, 0, 200),
    windGustMph: numberOrNull(raw.windgustmph, 0, 250),
    windFromDegrees: numberOrNull(raw.winddir, 0, 360)
  };
  // Do not switch to a station with no useful observations.
  if (Object.values(weather).every(value => value === null)) return null;

  return {
    available: true,
    station: config.name,
    stationId: config.id,
    stationRole: config.role,
    source: 'Ambient Weather Network public station data (unofficial interface)',
    sourceUrl: 'https://ambientweather.net/dashboard/8950a179e1e7a3eae5670e35c0b4cb08',
    // The sourceUrl above points to the primary station page, not necessarily the backup.
    observationTime: new Date(observationMs).toISOString(),
    ...weather,
    reason: null
  };
}

export async function onRequestGet() {
  const endpoint = new URL(SEARCH_ENDPOINT);
  endpoint.searchParams.set('$publicBox[0][0]', '-122.70');
  endpoint.searchParams.set('$publicBox[0][1]', '45.44');
  endpoint.searchParams.set('$publicBox[1][0]', '-122.62');
  endpoint.searchParams.set('$publicBox[1][1]', '45.50');
  endpoint.searchParams.set('$limit', '100');

  const unavailable = {
    available: false,
    station: null,
    stationId: null,
    stationRole: null,
    source: 'Ambient Weather Network public station data (unofficial interface)',
    observationTime: null,
    airTemperatureF: null,
    windSpeedMph: null,
    windGustMph: null,
    windFromDegrees: null
  };

  try {
    const upstream = await fetch(endpoint.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000)
    });
    if (!upstream.ok) throw new Error(`Ambient returned ${upstream.status}`);
    const json = await upstream.json();
    const devices = Array.isArray(json?.data) ? json.data : [];
    const now = Date.now();
    for (const config of STATIONS) {
      const match = validStation(devices, config, now);
      if (match) return response(match);
    }
    return response({ ...unavailable, reason: 'no_fresh_station' });
  } catch (error) {
    return response({ ...unavailable, reason: 'source_unavailable' }, 502);
  }
}
