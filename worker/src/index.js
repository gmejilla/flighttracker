const ALLOWED_ORIGINS = new Set([
  "https://gmejilla.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000"
]);

const SUCCESS_TTL_SECONDS = 900;
const FAILURE_TTL_SECONDS = 60;

function corsHeaders(request) {
  const origin = request.headers.get("Origin");
  const allowedOrigin = ALLOWED_ORIGINS.has(origin)
    ? origin
    : "https://gmejilla.github.io";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function jsonResponse(request, body, status = 200, cacheSeconds = 0) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders(request)
  };

  if (cacheSeconds > 0) {
    headers["Cache-Control"] = `public, max-age=${cacheSeconds}`;
  } else {
    headers["Cache-Control"] = "no-store";
  }

  return new Response(JSON.stringify(body), { status, headers });
}

function normalizeFlight(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function cleanCode(value) {
  return String(value || "").trim().toUpperCase();
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return null;
}

function parseAirLabs(payload, requestedFlight) {
  const rows = Array.isArray(payload?.response)
    ? payload.response
    : payload?.response
      ? [payload.response]
      : [];

  if (!rows.length) return null;

  const exact = rows.find((row) =>
    normalizeFlight(row?.flight_icao) === requestedFlight ||
    normalizeFlight(row?.flight_iata) === requestedFlight
  );

  const f = exact || rows[0];

  const originIata = cleanCode(f?.dep_iata);
  const originIcao = cleanCode(f?.dep_icao);
  const destinationIata = cleanCode(f?.arr_iata);
  const destinationIcao = cleanCode(f?.arr_icao);

  if (!(originIata || originIcao) || !(destinationIata || destinationIcao)) {
    return null;
  }

  let confidence = exact ? 95 : 82;

  if (f?.hex) confidence += 2;
  if (f?.reg_number) confidence += 2;
  confidence = Math.min(confidence, 99);

  return {
    success: true,
    provider: "airlabs",
    callsign: normalizeFlight(firstNonEmpty(f?.flight_icao, f?.flight_iata, requestedFlight)),
    origin: {
      iata: originIata,
      icao: originIcao,
      name: firstNonEmpty(f?.dep_name, f?.dep_airport, null)
    },
    destination: {
      iata: destinationIata,
      icao: destinationIcao,
      name: firstNonEmpty(f?.arr_name, f?.arr_airport, null)
    },
    registration: firstNonEmpty(f?.reg_number, null),
    hex: cleanCode(firstNonEmpty(f?.hex, "")) || null,
    aircraft: firstNonEmpty(f?.aircraft_icao, f?.aircraft_model, null),
    airline: firstNonEmpty(f?.airline_name, f?.airline_icao, f?.airline_iata, null),
    status: firstNonEmpty(f?.status, null),
    confidence,
    cached: false
  };
}

function parseAdsbDb(payload, requestedFlight) {
  const route = payload?.response?.flightroute || payload?.flightroute || payload?.route || null;
  if (!route) return null;

  const origin = route?.origin || route?.departure || {};
  const destination = route?.destination || route?.arrival || {};

  const originIata = cleanCode(firstNonEmpty(origin?.iata_code, origin?.iata, origin?.code_iata, ""));
  const originIcao = cleanCode(firstNonEmpty(origin?.icao_code, origin?.icao, origin?.code_icao, ""));
  const destinationIata = cleanCode(firstNonEmpty(destination?.iata_code, destination?.iata, destination?.code_iata, ""));
  const destinationIcao = cleanCode(firstNonEmpty(destination?.icao_code, destination?.icao, destination?.code_icao, ""));

  if (!(originIata || originIcao) || !(destinationIata || destinationIcao)) {
    return null;
  }

  return {
    success: true,
    provider: "adsbdb",
    callsign: requestedFlight,
    origin: {
      iata: originIata,
      icao: originIcao,
      name: firstNonEmpty(origin?.name, origin?.municipality, null)
    },
    destination: {
      iata: destinationIata,
      icao: destinationIcao,
      name: firstNonEmpty(destination?.name, destination?.municipality, null)
    },
    registration: null,
    hex: null,
    aircraft: null,
    airline: null,
    status: null,
    confidence: 70,
    cached: false
  };
}

async function fetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "Accept": "application/json" }
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const error = new Error(`Upstream request failed with HTTP ${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveFromAirLabs(env, flight) {
  if (!env.AIRLABS_API_KEY) return null;

  const endpoint =
    "https://airlabs.co/api/v9/flight" +
    `?api_key=${encodeURIComponent(env.AIRLABS_API_KEY)}` +
    `&flight_icao=${encodeURIComponent(flight)}`;

  const payload = await fetchJson(endpoint);
  return parseAirLabs(payload, flight);
}

async function resolveFromAdsbDb(flight) {
  const endpoint = `https://api.adsbdb.com/v0/callsign/${encodeURIComponent(flight)}`;
  const payload = await fetchJson(endpoint);
  return parseAdsbDb(payload, flight);
}

async function resolveRoute(env, flight) {
  const errors = [];

  try {
    const airLabs = await resolveFromAirLabs(env, flight);
    if (airLabs) return airLabs;
    errors.push("AirLabs returned no usable route");
  } catch (error) {
    errors.push(`AirLabs: ${error.message}`);
  }

  try {
    const adsbDb = await resolveFromAdsbDb(flight);
    if (adsbDb) return adsbDb;
    errors.push("ADSBDB returned no usable route");
  } catch (error) {
    errors.push(`ADSBDB: ${error.message}`);
  }

  return {
    success: false,
    provider: null,
    callsign: flight,
    route: null,
    confidence: 0,
    error: "ROUTE UNAVAILABLE",
    details: errors
  };
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request)
      });
    }

    if (request.method !== "GET") {
      return jsonResponse(
        request,
        { success: false, error: "Method not allowed" },
        405
      );
    }

    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return jsonResponse(request, {
        success: true,
        service: "flightwall-api",
        airlabsConfigured: Boolean(env.AIRLABS_API_KEY)
      });
    }

    const flight = normalizeFlight(url.searchParams.get("flight"));

    if (!flight) {
      return jsonResponse(
        request,
        { success: false, error: "Missing flight parameter" },
        400
      );
    }

    if (!/^[A-Z0-9]{2,10}$/.test(flight)) {
      return jsonResponse(
        request,
        { success: false, error: "Invalid flight parameter" },
        400
      );
    }

    const cacheUrl = new URL(request.url);
    cacheUrl.pathname = "/route";
    cacheUrl.search = `?flight=${encodeURIComponent(flight)}`;

    const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
    const cache = caches.default;

    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      const cachedBody = await cachedResponse.clone().json();
      cachedBody.cached = true;
      return jsonResponse(
        request,
        cachedBody,
        cachedResponse.status,
        cachedBody.success ? SUCCESS_TTL_SECONDS : FAILURE_TTL_SECONDS
      );
    }

    const result = await resolveRoute(env, flight);
    const ttl = result.success ? SUCCESS_TTL_SECONDS : FAILURE_TTL_SECONDS;
    const status = result.success ? 200 : 404;

    const response = jsonResponse(request, result, status, ttl);

    ctx.waitUntil(
      cache.put(
        cacheKey,
        new Response(JSON.stringify(result), {
          status,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": `public, max-age=${ttl}`
          }
        })
      )
    );

    return response;
  }
};
