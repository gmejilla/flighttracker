window.FLIGHTWALL_CONFIG = Object.freeze({
  LIVE_DATA_MODE: "WORKER",
  API_BASE_URL: "https://flightwall-api.gmejilla.workers.dev",

  // Retained only as documentation; the browser no longer calls these directly.
  ADSBLOL_API_URL: "",
  ADSBFI_API_URL: "",
  AIRPLANESLIVE_API_URL: "",

  ROUTE_LOOKUP_ENABLED: true,
  ROUTE_API_URL: "https://flightwall-api.gmejilla.workers.dev/v0/callsign",
  ROUTE_LOOKUP_TIMEOUT_MS: 8000,
  ROUTE_CACHE_MINUTES: 15,

  DEFAULT_LATITUDE: 39.9348,
  DEFAULT_LONGITUDE: -75.0307,
  DEFAULT_RADIUS_MILES: 35,
  DEFAULT_MAX_AIRCRAFT: 16,

  REFRESH_SECONDS: 20,
  REQUEST_TIMEOUT_MS: 12000,
  WEATHER_REFRESH_MINUTES: 15,
  WEATHER_API_URL: "https://flightwall-api.gmejilla.workers.dev/weather"
});
