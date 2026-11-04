// Cloudflare Pages Function. USGS station 14211720, Portland, Oregon.
// USGS legacy IV endpoint used to preserve the currently working integration.
// Migration to api.waterdata.usgs.gov is required before February 22, 2027.
const SITE = '14211720';
const CODES = {stage:'00065', discharge:'00060', temperature:'00010', velocity:'72255'};
const INVALID = new Set([-999999, -99999, -9999]);

function seriesReadings(series, code) {
  const matching = series.filter(s => (s.variable?.variableCode || []).some(c => c.value === code));
  const values = matching.flatMap(s => (s.values || []).flatMap(group => (group.value || []).map(x => ({
    value: Number(x.value), dateTime: x.dateTime, unit: s.variable?.unit?.unitCode || ''
  }))));
  return values.filter(x => Number.isFinite(x.value) && !INVALID.has(x.value) && !Number.isNaN(Date.parse(x.dateTime)))
    .sort((a,b) => Date.parse(a.dateTime) - Date.parse(b.dateTime));
}

export async function onRequestGet() {
  const url = new URL('https://waterservices.usgs.gov/nwis/iv/');
  url.searchParams.set('sites', SITE);
  url.searchParams.set('parameterCd', Object.values(CODES).join(','));
  url.searchParams.set('period', 'P1D');
  url.searchParams.set('format', 'json');
  const headers = {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'public, max-age=300, s-maxage=300'};
  try {
    const upstream = await fetch(url.toString(), {cf: {cacheTtl:300, cacheEverything:true}});
    if (!upstream.ok) throw new Error(`USGS HTTP ${upstream.status}`);
    const json = await upstream.json();
    const series = json?.value?.timeSeries || [];
    const result = {};
    for (const [name,code] of Object.entries(CODES)) {
      const readings = seriesReadings(series,code);
      result[name] = readings.length ? readings[readings.length - 1] : null;
      // Limit payload size but keep full 24 hours of stage readings for a chart.
      if (name === 'stage') result.stageHistory = readings.map(({value,dateTime}) => ({value,dateTime}));
    }
    if (!Object.values(CODES).some((_,i) => result[Object.keys(CODES)[i]])) {
      throw new Error('No recent measurements available for station 14211720');
    }
    return new Response(JSON.stringify({station:'Willamette River at Portland, OR',stationId:SITE, source:'USGS',fetchedAt:new Date().toISOString(),...result}),{headers});
  } catch (err) {
    return new Response(JSON.stringify({error:'Unable to retrieve USGS conditions', details:String(err.message || err)}), {status:503,headers:{...headers,'Cache-Control':'no-store'}});
  }
}
