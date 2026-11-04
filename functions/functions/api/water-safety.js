// Cloudflare Pages Function. Retrieves publicly displayed City of Portland information.
// Not an official API. If the City changes its HTML, show 'unavailable', never 'safe'.
const WATER_URL = 'https://www.portlandoregon.gov/bes/waterquality/results.cfm?location_id=7133';
const OVERFLOW_URL = 'https://www.portland.gov/bes/big-pipe-tracker';

function plain(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&darr;|&#8595;/gi, '↓')
    .replace(/&uarr;|&#8593;/gi, '↑')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ').trim();
}

async function getHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'text/html' } });
    if (!res.ok) throw new Error('Upstream HTTP ' + res.status);
    return await res.text();
  } finally { clearTimeout(timeout); }
}

function parseWater(html) {
  // City page gives newest Sellwood result at the top of a table.
  // Rows: Sample Collection Date | Temperature | E. coli Count.
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  for (const row of rows) {
    const cells = [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map(m => plain(m[1]));
    if (cells.length < 3) continue;
    const date = cells[0].match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
    if (!date) continue;
    const eColiText = cells[2];
    const count = eColiText.match(/\b([\d,]+)\b/);
    const nondetect = /\bND\b/i.test(eColiText);
    if (!count && !nondetect) continue;
    const year = Number(date[3].length === 2 ? '20' + date[3] : date[3]);
    const month = Number(date[1]);
    const day = Number(date[2]);
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (!Number.isFinite(Date.parse(iso + 'T12:00:00Z'))) continue;
    return {
      available: true, sampleDate: iso,
      eColiPer100mL: nondetect ? null : Number(count[1].replace(/,/g, '')),
      nonDetect: nondetect,
      // For context only; older sample does NOT establish today's safety.
      thresholdPer100mL: 406,
      location: 'Sellwood Riverfront Park Dock',
      sourceUrl: WATER_URL
    };
  }
  return { available: false, sourceUrl: WATER_URL };
}

function parseOverflow(html) {
  const text = plain(html);
  const match = text.match(/Current\s+CSO\s+Advisories\s*:\s*([\s\S]{0,350})/i);
  if (!match) return { status: 'unknown', sourceUrl: OVERFLOW_URL };
  const message = match[1].split(/CSO Advisory Notifications\s*:/i)[0].trim();
  if (/^There is no current CSO advisory in effect\b/i.test(message)) {
    return { status: 'none_reported', message: 'The City reports no current CSO advisory.', sourceUrl: OVERFLOW_URL };
  }
  if (/\b(advisory|overflow|avoid contact|stay out of the water)\b/i.test(message)) {
    return { status: 'possible_advisory', message: 'Review the City advisory before entering the water.', sourceUrl: OVERFLOW_URL };
  }
  return { status: 'unknown', sourceUrl: OVERFLOW_URL };
}

export async function onRequestGet() {
  const checkedAt = new Date().toISOString();
  const [water, overflow] = await Promise.allSettled([getHtml(WATER_URL), getHtml(OVERFLOW_URL)]);
  const output = {
    checkedAt,
    waterQuality: water.status === 'fulfilled' ? parseWater(water.value) : { available: false, sourceUrl: WATER_URL },
    overflow: overflow.status === 'fulfilled' ? parseOverflow(overflow.value) : { status: 'unknown', sourceUrl: OVERFLOW_URL },
    disclaimer: 'Historical samples and advisory status do not certify that the river is safe for paddling.'
  };
  return Response.json(output, {
    headers: { 'Cache-Control': 'public, max-age=300, s-maxage=900', 'X-Content-Type-Options': 'nosniff' }
  });
}
