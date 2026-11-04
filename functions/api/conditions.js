
export async function onRequestGet() {
  const stationId = '14211720';
  const url =
    `https://waterservices.usgs.gov/nwis/iv/` +
    `?sites=${stationId}` +
    `&parameterCd=00065,00060,00010` +
    `&format=json`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`USGS returned ${response.status}`);
    }

    const data = await response.json();
    const series = data?.value?.timeSeries ?? [];

    const getLatest = (parameterCode) => {
      const entry = series.find((item) =>
        item?.variable?.variableCode?.some(
          (code) => code?.value === parameterCode
        )
      );

      const values = entry?.values?.[0]?.value ?? [];
      const latest = values[values.length - 1];

      if (!latest || !Number.isFinite(Number(latest.value))) {
        return null;
      }

      return {
        value: Number(latest.value),
        dateTime: latest.dateTime,
        unit: entry?.variable?.unit?.unitCode ?? 'unknown'
      };
    };

    return Response.json({
      station: 'Willamette River at Portland, OR',
      stationId,
      source: 'USGS',
      timestamp: new Date().toISOString(),
      stage: getLatest('00065'),
      discharge: getLatest('00060'),
      temperature: getLatest('00010')
    }, {
      headers: {
        'Cache-Control': 'public, max-age=600'
      }
    });

  } catch (error) {
    return Response.json({
      error: 'Unable to fetch river conditions.',
      details: error.message
    }, { status: 500 });
  }
}
