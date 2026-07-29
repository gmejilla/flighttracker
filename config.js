window.FLIGHTWALL_CONFIG = Object.freeze({
  // Live aircraft telemetry remains on the public ADS-B providers.
  LIVE_DATA_MODE: "AUTO",

  // Optional Worker endpoint for nearby-aircraft telemetry.
  // This route-only Worker does not currently expose /flights.
  API_BASE_URL: "",

  ADSBLOL_API_URL: "https://api.adsb.lol",
  ADSBFI_API_URL: "https://opendata.adsb.fi/api",
  AIRPLANESLIVE_API_URL: "https://api.airplanes.live",

  // Route enrichment is now sent through the secure Cloudflare Worker.
  // The Worker accepts this legacy path shape so app.js needs no changes.
  ROUTE_LOOKUP_ENABLED: true,
  ROUTE_API_URL: "https://flightwall-api.gmejilla.workers.dev/v0/callsign",
  ROUTE_LOOKUP_TIMEOUT_MS: 7000,
  ROUTE_CACHE_MINUTES: 15,

  DEFAULT_LATITUDE: 39.9348,
  DEFAULT_LONGITUDE: -75.0307,
  DEFAULT_RADIUS_MILES: 35,
  DEFAULT_MAX_AIRCRAFT: 16,

  REFRESH_SECONDS: 20,
  REQUEST_TIMEOUT_MS: 12000,
  WEATHER_REFRESH_MINUTES: 15,
  WEATHER_API_URL: "https://api.open-meteo.com/v1/forecast"
});
