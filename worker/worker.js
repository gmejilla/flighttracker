/**
 * FlightWall OpenSky proxy for Cloudflare Workers
 *
 * Optional secrets:
 *   OPENSKY_CLIENT_ID
 *   OPENSKY_CLIENT_SECRET
 *
 * Optional variables:
 *   ALLOWED_ORIGIN  Example: https://YOUR-USERNAME.github.io
 *   CACHE_SECONDS   Default: 15
 */

const TOKEN_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
const STATES_URL = "https://opensky-network.org/api/states/all";
const ADSBLOL_URL = "https://api.adsb.lol";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== "GET") {
      return json({ error: "Method not allowed" }, 405, cors);
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({ ok: true, service: "flightwall-api" }, 200, cors);
    }

    if (url.pathname !== "/flights") {
      return json({ error: "Not found" }, 404, cors);
    }

    try {
      const lat = boundedNumber(url.searchParams.get("lat"), -90, 90);
      const lon = boundedNumber(url.searchParams.get("lon"), -180, 180);
      const radius = boundedNumber(url.searchParams.get("radius") ?? "35", 1, 250);
      const maximum = Math.round(boundedNumber(url.searchParams.get("max") ?? "16", 1, 50));

      if (lat === null || lon === null) {
        return json({ error: "lat and lon are required" }, 400, cors);
      }

      const bounds = boundingBox(lat, lon, radius);
      const openskyUrl = new URL(STATES_URL);
      openskyUrl.searchParams.set("lamin", String(bounds.lamin));
      openskyUrl.searchParams.set("lomin", String(bounds.lomin));
      openskyUrl.searchParams.set("lamax", String(bounds.lamax));
      openskyUrl.searchParams.set("lomax", String(bounds.lomax));

      const cacheKey = new Request(openskyUrl.toString(), { method: "GET" });
      const cache = caches.default;
      const forceRefresh = url.searchParams.get("refresh") === "1";
      let upstream = forceRefresh ? null : await cache.match(cacheKey);

      if (!upstream) {
        const headers = { "Accept": "application/json" };
        const token = await getAccessToken(env);
        if (token) headers.Authorization = `Bearer ${token}`;

        upstream = await fetch(openskyUrl, { headers });
        if (!upstream.ok) {
          const body = await upstream.text();
          throw new Error(`OpenSky returned ${upstream.status}: ${body.slice(0, 160)}`);
        }

        const cacheSeconds = Math.max(5, Number(env.CACHE_SECONDS || 15));
        upstream = new Response(upstream.body, upstream);
        upstream.headers.set("Cache-Control", `public, max-age=${cacheSeconds}`);
        ctx.waitUntil(cache.put(cacheKey, upstream.clone()));
      }

      const payload = await upstream.json();
      const flights = (payload.states || [])
        .map(state => normalizeState(state, lat, lon))
        .filter(Boolean)
        .filter(flight => flight.distanceMi <= radius)
        .sort((a, b) => a.distanceMi - b.distanceMi)
        .slice(0, maximum);

      return json({
        provider: "OpenSky",
        generatedAt: new Date().toISOString(),
        flights
      }, 200, cors);
    } catch (error) {
      try {
        const fallbackFlights = await fetchAdsbLolFlights(
          Number(url.searchParams.get("lat")),
          Number(url.searchParams.get("lon")),
          Number(url.searchParams.get("radius") || 35),
          Number(url.searchParams.get("max") || 16)
        );
        return json({
          provider: "ADSB.lol",
          generatedAt: new Date().toISOString(),
          flights: fallbackFlights,
          fallbackReason: error.message || "OpenSky unavailable"
        }, 200, cors);
      } catch (fallbackError) {
        return json({
          error: fallbackError.message || error.message || "Unexpected error"
        }, 502, cors);
      }
    }
  }
};

async function getAccessToken(env) {
  if (!env.OPENSKY_CLIENT_ID || !env.OPENSKY_CLIENT_SECRET) return "";

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.OPENSKY_CLIENT_ID,
    client_secret: env.OPENSKY_CLIENT_SECRET
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!response.ok) throw new Error(`OpenSky authentication failed with ${response.status}`);
  const payload = await response.json();
  return payload.access_token || "";
}

function normalizeState(state, homeLat, homeLon) {
  if (!Array.isArray(state)) return null;

  const [
    icao24, callsign, country, , lastContact, longitude, latitude,
    barometricAltitude, onGround, velocity, heading, verticalRate,
    , geometricAltitude, squawk
  ] = state;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const distanceMi = haversineMiles(homeLat, homeLon, latitude, longitude);
  const bearingDegrees = initialBearing(homeLat, homeLon, latitude, longitude);
  const altitudeMeters = Number.isFinite(geometricAltitude) ? geometricAltitude :
    Number.isFinite(barometricAltitude) ? barometricAltitude : 0;
  const rateMetersPerSecond = Number.isFinite(verticalRate) ? verticalRate : 0;

  return {
    id: String(icao24 || "").trim(),
    icao24: String(icao24 || "").trim().toUpperCase(),
    callsign: String(callsign || "").trim().toUpperCase(),
    flightNumber: String(callsign || "").trim().toUpperCase(),
    airline: "",
    origin: "---",
    destination: "---",
    aircraft: "AIRCRAFT TYPE UNKNOWN",
    country: country || "Unknown",
    latitude,
    longitude,
    altitudeFt: Math.round(altitudeMeters * 3.28084),
    speedMph: Math.round((Number(velocity) || 0) * 2.23694),
    heading: Number(heading) || 0,
    distanceMi: Math.round(distanceMi * 10) / 10,
    bearingDegrees,
    bearing: cardinal(bearingDegrees),
    verticalRateFpm: Math.round(rateMetersPerSecond * 196.8504),
    status: onGround ? "ON GROUND" :
      rateMetersPerSecond > 1.27 ? "CLIMBING" :
      rateMetersPerSecond < -1.27 ? "DESCENDING" : "LEVEL",
    squawk: squawk || "---",
    onGround: Boolean(onGround),
    lastContact
  };
}

async function fetchAdsbLolFlights(lat, lon, radiusMiles, maximum) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error("lat and lon are required");
  }

  const radiusNm = Math.max(1, Math.min(250, radiusMiles / 1.15078));
  const endpoint = `${ADSBLOL_URL}/v2/lat/${encodeURIComponent(lat)}/lon/${encodeURIComponent(lon)}/dist/${encodeURIComponent(radiusNm.toFixed(1))}`;
  const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`ADSB.lol returned ${response.status}`);

  const payload = await response.json();
  return (payload.ac || [])
    .map(raw => normalizeAdsbLol(raw, lat, lon))
    .filter(Boolean)
    .filter(flight => flight.distanceMi <= radiusMiles)
    .sort((a, b) => a.distanceMi - b.distanceMi)
    .slice(0, maximum);
}

function normalizeAdsbLol(raw, homeLat, homeLon) {
  if (!raw || !Number.isFinite(raw.lat) || !Number.isFinite(raw.lon)) return null;

  const callsign = String(raw.flight || "").trim().toUpperCase();
  const altitudeFt = raw.alt_baro === "ground"
    ? 0
    : Number(raw.alt_geom ?? raw.alt_baro ?? 0) || 0;
  const verticalRateFpm = Number(raw.geom_rate ?? raw.baro_rate ?? 0) || 0;
  const onGround = raw.alt_baro === "ground" || Boolean(raw.ground);
  const distanceMi = haversineMiles(homeLat, homeLon, raw.lat, raw.lon);
  const bearingDegrees = initialBearing(homeLat, homeLon, raw.lat, raw.lon);

  return {
    id: String(raw.hex || callsign || "").replace(/^~/, ""),
    icao24: String(raw.hex || "---").replace(/^~/, "").toUpperCase(),
    callsign,
    flightNumber: callsign,
    airline: "",
    origin: "---",
    destination: "---",
    aircraft: raw.t || raw.desc || "AIRCRAFT TYPE UNKNOWN",
    country: raw.ownOp || raw.r || "Unknown",
    latitude: raw.lat,
    longitude: raw.lon,
    altitudeFt: Math.round(altitudeFt),
    speedMph: Math.round((Number(raw.gs) || 0) * 1.15078),
    heading: Number(raw.track ?? raw.true_heading ?? raw.mag_heading ?? 0) || 0,
    distanceMi: Math.round(distanceMi * 10) / 10,
    bearingDegrees,
    bearing: cardinal(bearingDegrees),
    verticalRateFpm: Math.round(verticalRateFpm),
    status: onGround ? "ON GROUND" :
      verticalRateFpm > 250 ? "CLIMBING" :
      verticalRateFpm < -250 ? "DESCENDING" : "LEVEL",
    squawk: raw.squawk || "---",
    onGround,
    lastContact: Date.now() - Math.max(0, Number(raw.seen) || 0) * 1000
  };
}

function boundedNumber(value, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : null;
}

function boundingBox(lat, lon, radiusMiles) {
  const latDelta = radiusMiles / 69;
  const lonDelta = radiusMiles / Math.max(1, 69 * Math.cos(lat * Math.PI / 180));
  return {
    lamin: lat - latDelta,
    lamax: lat + latDelta,
    lomin: lon - lonDelta,
    lomax: lon + lonDelta
  };
}

function haversineMiles(lat1, lon1, lat2, lon2) {
  const toRad = degrees => degrees * Math.PI / 180;
  const earthRadiusMiles = 3958.7613;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function initialBearing(lat1, lon1, lat2, lon2) {
  const toRad = degrees => degrees * Math.PI / 180;
  const toDeg = radians => radians * 180 / Math.PI;
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function cardinal(degrees) {
  const names = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return names[Math.round(degrees / 45) % 8];
}

function corsHeaders(request, env) {
  const requestOrigin = request.headers.get("Origin") || "";
  const allowedOrigin = env.ALLOWED_ORIGIN || "*";
  const origin = allowedOrigin === "*" || requestOrigin === allowedOrigin ? allowedOrigin : allowedOrigin;

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function json(value, status, extraHeaders = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders
    }
  });
}
