
export async function onRequestGet() {
  // Search publicly shared weather stations
  // around Sellwood and Oaks Park, Portland.

  const url = new URL(
    'https://lightning.ambientweather.net/devices'
  );

  // Geographic search area around Sellwood
  url.searchParams.set('$publicBox[0][0]', '-122.70');
  url.searchParams.set('$publicBox[0][1]', '45.44');
  url.searchParams.set('$publicBox[1][0]', '-122.62');
  url.searchParams.set('$publicBox[1][1]', '45.50');
  url.searchParams.set('$limit', '100');

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json'
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(
        `Ambient Weather returned HTTP ${response.status}`
      );
    }

    const result = await response.json();
    const stations = Array.isArray(result.data)
      ? result.data
      : [];

    const simplified = stations.map((station) => {
      const info = station.info || {};
      const reading = station.lastData || {};

      return {
        name: info.name || info.location || 'Unnamed station',
        deviceId: station.macAddress || null,
        airTemperatureF: reading.tempf ?? null,
        windSpeedMph: reading.windspeedmph ?? null,
        windGustMph: reading.windgustmph ?? null,
        windDirectionDegrees: reading.winddir ?? null,
        observationTime:
          reading.dateutc ?? reading.created_at ?? null
      };
    });

    return Response.json({
      success: true,
      stationCount: simplified.length,
      stations: simplified
    }, {
      headers: {
        'Cache-Control': 'public, max-age=600'
      }
    });

  } catch (error) {
    return Response.json({
      success: false,
      error: 'Unable to retrieve public Ambient Weather stations.',
      details: error.message
    }, {
      status: 502
    });
  }
}
