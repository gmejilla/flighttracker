const ALLOWED_ORIGINS = new Set([
  "https://gmejilla.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000"
]);

const SUCCESS_TTL_SECONDS = 900;
const FAILURE_TTL_SECONDS = 60;
const UPSTREAM_TIMEOUT_MS = 8000;

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
    ...corsHeaders(request),
    "Cache-Control": cacheSeconds > 0
      ? `public, max-age=${cacheSeconds}`
      : "no-store"
  };

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

function withLegacyRouteShape(result) {
  if (!result?.success) return result;

  return {
    ...result,
    route: {
      origin: result.origin,
      destination: result.destination,
      airline: result.airline ? { name: result.airline } : null,
      airline_name: result.airline,
      callsign_icao: result.callsign,
      callsign_iata: null
    }
  };
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

  const flight = exact || rows[0];

  const originIata = cleanCode(flight?.dep_iata);
  const originIcao = cleanCode(flight?.dep_icao);
  const destinationIata = cleanCode(flight?.arr_iata);
  const destinationIcao = cleanCode(flight?.arr_icao);

  if (!(originIata || originIcao) || !(destinationIata || destinationIcao)) {
    return null;
  }

  let confidence = exact ? 95 : 82;
  if (flight?.hex) confidence += 2;
  if (flight?.reg_number) confidence += 2;

  return withLegacyRouteShape({
    success: true,
    provider: "airlabs",
    providerReason: exact
      ? "AirLabs returned an exact callsign match."
      : "AirLabs returned a usable route from its first matching result.",
    callsign: normalizeFlight(
      firstNonEmpty(flight?.flight_icao, flight?.flight_iata, requestedFlight)
    ),
    origin: {
      iata: originIata || null,
      icao: originIcao || null,
      name: firstNonEmpty(flight?.dep_name, flight?.dep_airport, null)
    },
    destination: {
      iata: destinationIata || null,
      icao: destinationIcao || null,
      name: firstNonEmpty(flight?.arr_name, flight?.arr_airport, null)
    },
    registration: firstNonEmpty(flight?.reg_number, null),
    hex: cleanCode(firstNonEmpty(flight?.hex, "")) || null,
    aircraft: firstNonEmpty(flight?.aircraft_icao, flight?.aircraft_model, null),
    airline: firstNonEmpty(
      flight?.airline_name,
      flight?.airline_icao,
      flight?.airline_iata,
      null
    ),
    status: firstNonEmpty(flight?.status, null),
    confidence: Math.min(confidence, 99),
    cached: false
  });
}

function parseAdsbDb(payload, requestedFlight, fallbackReason) {
  const route =
    payload?.response?.flightroute ||
    payload?.flightroute ||
    payload?.route ||
    null;

  if (!route) return null;

  const origin = route?.origin || route?.departure || {};
  const destination = route?.destination || route?.arrival || {};

  const originIata = cleanCode(
    firstNonEmpty(origin?.iata_code, origin?.iata, origin?.code_iata, "")
  );
  const originIcao = cleanCode(
    firstNonEmpty(origin?.icao_code, origin?.icao, origin?.code_icao, "")
  );
  const destinationIata = cleanCode(
    firstNonEmpty(destination?.iata_code, destination?.iata, destination?.code_iata, "")
  );
  const destinationIcao = cleanCode(
    firstNonEmpty(destination?.icao_code, destination?.icao, destination?.code_icao, "")
  );

  if (!(originIata || originIcao) || !(destinationIata || destinationIcao)) {
    return null;
  }

  return withLegacyRouteShape({
    success: true,
    provider: "adsbdb",
    providerReason: `ADSBDB fallback used because ${fallbackReason}`,
    callsign: requestedFlight,
    origin: {
      iata: originIata || null,
      icao: originIcao || null,
      name: firstNonEmpty(origin?.name, origin?.municipality, null)
    },
    destination: {
      iata: destinationIata || null,
      icao: destinationIcao || null,
      name: firstNonEmpty(destination?.name, destination?.municipality, null)
    },
    registration: null,
    hex: null,
    aircraft: null,
    airline: null,
    status: null,
    confidence: 70,
    cached: false
  });
}

async function fetchJson(url, timeoutMs = UPSTREAM_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" }
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`timed out after ${timeoutMs} ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveFromAirLabs(env, flight) {
  if (!env.AIRLABS_API_KEY) {
    throw new Error("AIRLABS_API_KEY is not configured");
  }

  const endpoint =
    "https://airlabs.co/api/v9/flight" +
    `?api_key=${encodeURIComponent(env.AIRLABS_API_KEY)}` +
    `&flight_icao=${encodeURIComponent(flight)}`;

  const payload = await fetchJson(endpoint);
  return parseAirLabs(payload, flight);
}

async function resolveFromAdsbDb(flight, fallbackReason) {
  const endpoint =
    `https://api.adsbdb.com/v0/callsign/${encodeURIComponent(flight)}`;

  const payload = await fetchJson(endpoint);
  return parseAdsbDb(payload, flight, fallbackReason);
}

async function resolveRoute(env, flight) {
  let airLabsReason = "AirLabs returned no usable route.";

  try {
    const airLabs = await resolveFromAirLabs(env, flight);
    if (airLabs) {
      console.log(JSON.stringify({
        event: "route_lookup",
        callsign: flight,
        provider: "airlabs",
        outcome: "success"
      }));
      return airLabs;
    }
  } catch (error) {
    airLabsReason = `AirLabs failed: ${error.message}.`;
    console.warn(JSON.stringify({
      event: "route_lookup",
      callsign: flight,
      provider: "airlabs",
      outcome: "fallback",
      reason: error.message
    }));
  }

  try {
    const adsbDb = await resolveFromAdsbDb(flight, airLabsReason);
    if (adsbDb) {
      console.log(JSON.stringify({
        event: "route_lookup",
        callsign: flight,
        provider: "adsbdb",
        outcome: "success",
        fallbackReason: airLabsReason
      }));
      return adsbDb;
    }
  } catch (error) {
    console.error(JSON.stringify({
      event: "route_lookup",
      callsign: flight,
      provider: "adsbdb",
      outcome: "failure",
      reason: error.message,
      fallbackReason: airLabsReason
    }));

    return {
      success: false,
      provider: null,
      providerReason: `${airLabsReason} ADSBDB also failed: ${error.message}.`,
      callsign: flight,
      route: null,
      confidence: 0,
      cached: false,
      error: "ROUTE UNAVAILABLE"
    };
  }

  return {
    success: false,
    provider: null,
    providerReason: `${airLabsReason} ADSBDB returned no usable route.`,
    callsign: flight,
    route: null,
    confidence: 0,
    cached: false,
    error: "ROUTE UNAVAILABLE"
  };
}

function flightFromRequestUrl(url) {
  const queryFlight = normalizeFlight(url.searchParams.get("flight"));
  if (queryFlight) return queryFlight;

  // Compatibility with the existing FlightWall frontend:
  // /v0/callsign/UAL678 or /callsign/UAL678
  const match = url.pathname.match(/\/(?:v0\/)?callsign\/([A-Za-z0-9]{2,10})\/?$/);
  return normalizeFlight(match?.[1]);
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
        version: "1.2.0",
        airlabsConfigured: Boolean(env.AIRLABS_API_KEY),
        successCacheSeconds: SUCCESS_TTL_SECONDS,
        failureCacheSeconds: FAILURE_TTL_SECONDS
      });
    }

    const flight = flightFromRequestUrl(url);

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
    const ttl = result.success
      ? SUCCESS_TTL_SECONDS
      : FAILURE_TTL_SECONDS;
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
