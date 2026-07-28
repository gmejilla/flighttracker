window.FLIGHTWALL_CONFIG = Object.freeze({
  // Live data mode:
  // "AUTO"     = try multiple public live providers, then the Worker.
  // "PUBLIC"   = use public providers only.
  // "WORKER"   = use only the configured Cloudflare Worker.
  // "DEMO"     = never request live aircraft data.
  LIVE_DATA_MODE: "AUTO",

  // Optional Cloudflare Worker URL.
  // Example: "https://flightwall-api.your-subdomain.workers.dev"
  API_BASE_URL: "",

  // Public ADSB.lol endpoint. No API key is embedded in the website.
  ADSBLOL_API_URL: "https://api.adsb.lol",
  ADSBFI_API_URL: "https://opendata.adsb.fi/api",
  AIRPLANESLIVE_API_URL: "https://api.airplanes.live",

  // Optional route enrichment by callsign.
  // This adds best-effort origin and destination airport codes such as PHL → MCO.
  ROUTE_LOOKUP_ENABLED: true,
  ROUTE_API_URL: "https://api.adsbdb.com/v0/callsign",
  ROUTE_LOOKUP_TIMEOUT_MS: 7000,
  ROUTE_CACHE_MINUTES: 360,

  DEFAULT_LATITUDE: 39.9348,
  DEFAULT_LONGITUDE: -75.0307,
  DEFAULT_RADIUS_MILES: 35,
  DEFAULT_MAX_AIRCRAFT: 16,

  REFRESH_SECONDS: 20,
  REQUEST_TIMEOUT_MS: 12000,

  WEATHER_REFRESH_MINUTES: 15,
  WEATHER_API_URL: "https://api.open-meteo.com/v1/forecast"
});
