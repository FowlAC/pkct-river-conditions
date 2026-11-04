export async function onRequestGet() {
  const url = 'https://waterservices.usgs.gov/nwis/iv/?sites=14191000&parameterCd=00065,00060&format=json';

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'pkct-river-conditions/1.0 (+https://github.com/FowlAC/pkct-river-conditions)'
      }
    });

    if (!response.ok) {
      throw new Error(`USGS request failed with status ${response.status}`);
    }

    const data = await response.json();
    const series = data?.value?.timeSeries ?? [];

    const stageSeries = series.find((entry) =>
      entry?.variable?.variableCode?.some((code) => code?.value === '00065')
    );
    const dischargeSeries = series.find((entry) =>
      entry?.variable?.variableCode?.some((code) => code?.value === '00060')
    );

    const getLatest = (entry) => {
      const values = entry?.values?.[0]?.value ?? [];
      const latest = values[values.length - 1];
      if (!latest) return null;

      return {
        value: Number(latest.value),
        dateTime: latest.dateTime,
        unit: entry?.variable?.unit?.unitCode ?? 'unknown'
      };
    };

    const stage = getLatest(stageSeries);
    const discharge = getLatest(dischargeSeries);

    return Response.json({
      station: 'Willamette River',
      source: 'USGS',
      timestamp: new Date().toISOString(),
      stage,
      discharge,
      raw: data
    });
  } catch (error) {
    return Response.json(
      {
        error: 'Unable to fetch river conditions.',
        details: error.message
      },
      { status: 500 }
    );
  }
}
