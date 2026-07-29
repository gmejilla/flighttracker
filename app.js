(() => {
  "use strict";

  const CONFIG = window.FLIGHTWALL_CONFIG || {};
  const STORAGE_KEY = "flightwall-github-pages-v3.1.0";

  const demoFlights = [
    { id:"a11aa1", icao24:"a11aa1", callsign:"AAL1724", flightNumber:"AA 1724", airline:"AMERICAN", origin:"PHL", destination:"MCO", aircraft:"BOEING 737-800", country:"United States", latitude:39.91, longitude:-75.08, altitudeFt:12450, speedMph:338, heading:214, distanceMi:6.2, bearing:"SW", verticalRateFpm:1200, status:"CLIMBING", squawk:"1432", onGround:false },
    { id:"a22bb2", icao24:"a22bb2", callsign:"UAL2119", flightNumber:"UA 2119", airline:"UNITED", origin:"EWR", destination:"IAD", aircraft:"AIRBUS A320", country:"United States", latitude:40.03, longitude:-74.92, altitudeFt:23100, speedMph:421, heading:239, distanceMi:9.8, bearing:"W", verticalRateFpm:-850, status:"DESCENDING", squawk:"2741", onGround:false },
    { id:"a33cc3", icao24:"a33cc3", callsign:"DAL891", flightNumber:"DL 891", airline:"DELTA", origin:"BOS", destination:"ATL", aircraft:"AIRBUS A321", country:"United States", latitude:39.81, longitude:-74.88, altitudeFt:34750, speedMph:486, heading:211, distanceMi:13.4, bearing:"SE", verticalRateFpm:0, status:"LEVEL", squawk:"6214", onGround:false },
    { id:"a44dd4", icao24:"a44dd4", callsign:"SWA447", flightNumber:"WN 447", airline:"SOUTHWEST", origin:"BWI", destination:"MDW", aircraft:"BOEING 737 MAX 8", country:"United States", latitude:40.10, longitude:-75.21, altitudeFt:18100, speedMph:389, heading:302, distanceMi:17.9, bearing:"NW", verticalRateFpm:950, status:"CLIMBING", squawk:"5321", onGround:false },
    { id:"a55ee5", icao24:"a55ee5", callsign:"JBU623", flightNumber:"B6 623", airline:"JETBLUE", origin:"JFK", destination:"FLL", aircraft:"AIRBUS A220-300", country:"United States", latitude:39.76, longitude:-74.76, altitudeFt:28900, speedMph:455, heading:198, distanceMi:21.6, bearing:"E", verticalRateFpm:0, status:"LEVEL", squawk:"4170", onGround:false }
  ];

  const themes = {
    cyan: { primary:"#f5fbff", secondary:"#4ed8ff", accent:"#ffd452", muted:"#7591a2", grid:"rgba(255,255,255,.045)", radar:"#165064" },
    amber: { primary:"#ffe6a2", secondary:"#ffb832", accent:"#fff2c0", muted:"#9d8051", grid:"rgba(255,188,61,.045)", radar:"#6b4613" },
    mono: { primary:"#f4f4f4", secondary:"#d6d6d6", accent:"#ffffff", muted:"#777", grid:"rgba(255,255,255,.04)", radar:"#4a4a4a" }
  };

  const airlinePrefixes = {
    AAL:"AMERICAN", UAL:"UNITED", DAL:"DELTA", SWA:"SOUTHWEST", JBU:"JETBLUE",
    FFT:"FRONTIER", NKS:"SPIRIT", ASA:"ALASKA", SKW:"SKYWEST", RPA:"REPUBLIC",
    ENY:"ENVOY", PDT:"PIEDMONT", UPS:"UPS", FDX:"FEDEX", ACA:"AIR CANADA",
    BAW:"BRITISH AIRWAYS", DLH:"LUFTHANSA", AFR:"AIR FRANCE", KLM:"KLM"
  };

  const elements = Object.fromEntries([
    "providerPill","aircraftCount","updatedAt","localClock","displayBezel","ledCanvas","displayMessage",
    "previousButton","pauseButton","nextButton","fullscreenButton","wakeLockButton","telemetryCard",
    "selectedFlight","selectedIcao","selectedCountry","selectedSquawk","selectedPosition",
    "refreshButton","searchInput","favoritesOnlyButton","flightList","weatherRefreshButton","weatherTemperature","weatherCondition","weatherWind","weatherVisibility","weatherSunrise","weatherSunset","layoutSelect",
    "themeSelect","unitsSelect","rotationSelect","brightnessRange","brightnessOutput",
    "dotRange","dotOutput","autoBrightnessInput","zipCodeInput","zipCodeButton","zipCodeStatus","latitudeInput","longitudeInput","radiusInput","maximumInput",
    "commercialOnlyInput","autoLocateInput","showWeatherInput","radarContactsRange","radarContactsOutput","trailLengthRange","trailLengthOutput","headingVectorsInput","radarLabelsInput","locationButton","applyTrackingButton","fidsPageSecondsSelect","fidsSortSelect","fidsAirlineFilterInput","fidsShowAircraftInput","connectionDescription"
  ].map(id => [id, document.getElementById(id)]));

  const ctx = elements.ledCanvas.getContext("2d");
  let flights = [];
  let currentIndex = 0;
  let previousIndex = 0;
  let paused = false;
  let favoritesOnly = false;
  let rotationTimer = 0;
  let refreshTimer = 0;
  let transitionStarted = performance.now();
  let lastProvider = "DEMO";
  let lastLiveSource = "";
  const routeCache = new Map();
  let routeEnrichmentGeneration = 0;
  let isLoading = false;
  let wakeLock = null;
  let radarSweepAngle = 0;
  let weather = null;
  let weatherTimer = 0;
  const airportWeather = new Map();
  const airportWeatherRequests = new Map();
  const AIRPORT_WEATHER_TTL_MS = 10 * 60 * 1000;
  let clockTimer = 0;
  let radarHitTargets = [];
  let radarView = {
    zoom: 1,
    panX: 0,
    panY: 0,
    dragging: false,
    moved: false,
    dragStartX: 0,
    dragStartY: 0,
    panStartX: 0,
    panStartY: 0
  };
  const radarHistory = new Map();
  const interpolationState = new Map();
  const INTERPOLATION_WINDOW_MS = 12000;

  const defaults = {
    zipCode: "",
    latitude: Number(CONFIG.DEFAULT_LATITUDE ?? 39.9348),
    longitude: Number(CONFIG.DEFAULT_LONGITUDE ?? -75.0307),
    radius: Number(CONFIG.DEFAULT_RADIUS_MILES ?? 35),
    maximum: Number(CONFIG.DEFAULT_MAX_AIRCRAFT ?? 16),
    layout: "classic",
    theme: "cyan",
    units: "imperial",
    rotation: 6,
    brightness: 88,
    autoBrightness: true,
    dotSize: 4,
    commercialOnly: false,
    autoLocate: false,
    showWeather: true,
    radarContacts: 12,
    trailLength: 5,
    headingVectors: true,
    radarLabels: true,
    fidsPageSeconds: 10,
    fidsSort: "time",
    fidsAirlineFilter: "",
    fidsShowAircraft: false,
    favorites: []
  };

  let settings = loadSettings();

  function loadSettings() {
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
    } catch {
      return { ...defaults };
    }
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  function populateControls() {
    elements.zipCodeInput.value = settings.zipCode || "";
    elements.latitudeInput.value = settings.latitude;
    elements.longitudeInput.value = settings.longitude;
    elements.radiusInput.value = settings.radius;
    elements.maximumInput.value = settings.maximum;
    elements.layoutSelect.value = settings.layout;
    elements.themeSelect.value = settings.theme;
    elements.unitsSelect.value = settings.units;
    elements.rotationSelect.value = String(settings.rotation);
    elements.brightnessRange.value = settings.brightness;
    elements.autoBrightnessInput.checked = Boolean(settings.autoBrightness);
    elements.dotRange.value = settings.dotSize;
    elements.commercialOnlyInput.checked = settings.commercialOnly;
    elements.autoLocateInput.checked = Boolean(settings.autoLocate);
    elements.showWeatherInput.checked = Boolean(settings.showWeather);
    elements.radarContactsRange.value = settings.radarContacts;
    elements.trailLengthRange.value = settings.trailLength;
    elements.headingVectorsInput.checked = Boolean(settings.headingVectors);
    elements.radarLabelsInput.checked = Boolean(settings.radarLabels);
    elements.fidsPageSecondsSelect.value = String(settings.fidsPageSeconds || 10);
    elements.fidsSortSelect.value = settings.fidsSort || "time";
    elements.fidsAirlineFilterInput.value = settings.fidsAirlineFilter || "";
    elements.fidsShowAircraftInput.checked = Boolean(settings.fidsShowAircraft);
    updateOutputs();
  }

  function updateOutputs() {
    elements.brightnessOutput.textContent = `${settings.brightness}%`;
    elements.dotOutput.textContent = `${settings.dotSize}px`;
    elements.radarContactsOutput.textContent = settings.radarContacts;
    elements.trailLengthOutput.textContent = settings.trailLength;
  }

  function setProvider(provider, errorMessage = "") {
    lastProvider = provider;
    elements.providerPill.classList.remove("live", "error");
    elements.providerPill.textContent = provider;

    if (provider === "LIVE") elements.providerPill.classList.add("live");
    if (provider === "ERROR") elements.providerPill.classList.add("error");

    elements.displayMessage.classList.toggle("hidden", !errorMessage);
    elements.displayMessage.textContent = errorMessage;

    const mode = String(CONFIG.LIVE_DATA_MODE || "AUTO").toUpperCase();
    const workerConfigured = Boolean(String(CONFIG.API_BASE_URL || "").trim());
    if (provider === "LIVE") {
      elements.connectionDescription.textContent =
        lastLiveSource === "ADSB.LOL"
          ? "Live nearby aircraft are being returned directly by ADSB.lol."
          : "Live nearby aircraft are being returned by the configured API Worker.";
    } else if (mode === "DEMO") {
      elements.connectionDescription.textContent = "Demo mode is selected in config.js.";
    } else if (!workerConfigured) {
      elements.connectionDescription.textContent =
        "Live ADS-B data could not be reached, so the display switched to local demo data.";
    } else {
      elements.connectionDescription.textContent =
        "The live data providers were unavailable, so the display switched to local demo data.";
    }
  }

  const airportLocations = Object.freeze({
    ATL:[33.6407,-84.4277], BOS:[42.3656,-71.0096], BWI:[39.1754,-76.6684],
    CLT:[35.2140,-80.9431], DCA:[38.8512,-77.0402], DEN:[39.8561,-104.6737],
    DFW:[32.8998,-97.0403], DTW:[42.2162,-83.3554], EWR:[40.6895,-74.1745],
    FLL:[26.0742,-80.1506], IAD:[38.9531,-77.4565], IAH:[29.9902,-95.3368],
    JFK:[40.6413,-73.7781], LAS:[36.0840,-115.1537], LAX:[33.9416,-118.4085],
    MCO:[28.4312,-81.3081], MDW:[41.7868,-87.7522], MIA:[25.7959,-80.2870],
    MSP:[44.8848,-93.2223], ORD:[41.9742,-87.9073], PHL:[39.8744,-75.2424],
    PHX:[33.4342,-112.0116], SAN:[32.7338,-117.1933], SEA:[47.4502,-122.3088],
    SFO:[37.6213,-122.3790], SLC:[40.7899,-111.9791], TPA:[27.9755,-82.5332]
  });

  function aviationCategory(visibilityMeters, cloudCover) {
    const visibilityMiles = Number(visibilityMeters) / 1609.344;
    const cover = Number(cloudCover);
    if (visibilityMiles < 1) return "LIFR";
    if (visibilityMiles < 3) return "IFR";
    if (visibilityMiles <= 5 || cover >= 95) return "MVFR";
    return "VFR";
  }

  function aviationCategoryColor(category, palette) {
    if (category === "LIFR") return "#d76cff";
    if (category === "IFR") return "#ff4f5f";
    if (category === "MVFR") return "#4f9dff";
    if (category === "VFR") return "#53e682";
    return palette.muted;
  }

  function airportWeatherRecord(code) {
    return airportWeather.get(String(code || "").toUpperCase())?.data || null;
  }

  async function fetchAirportWeather(code) {
    const airportCode = String(code || "").toUpperCase();
    const coordinates = airportLocations[airportCode];
    const endpoint = String(CONFIG.WEATHER_API_URL || "").trim();
    if (!airportCode || !coordinates || !endpoint) return null;

    const cached = airportWeather.get(airportCode);
    if (cached && Date.now() - cached.fetchedAt < AIRPORT_WEATHER_TTL_MS) return cached.data;
    if (airportWeatherRequests.has(airportCode)) return airportWeatherRequests.get(airportCode);

    const request = (async () => {
      const url = new URL(endpoint);
      url.searchParams.set("latitude", String(coordinates[0]));
      url.searchParams.set("longitude", String(coordinates[1]));
      url.searchParams.set("current", "temperature_2m,dew_point_2m,weather_code,wind_speed_10m,wind_direction_10m,visibility,cloud_cover");
      url.searchParams.set("daily", "sunrise,sunset");
      url.searchParams.set("temperature_unit", settings.units === "metric" ? "celsius" : "fahrenheit");
      url.searchParams.set("wind_speed_unit", settings.units === "metric" ? "kmh" : "mph");
      url.searchParams.set("timezone", "auto");
      url.searchParams.set("forecast_days", "1");

      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Airport weather HTTP ${response.status}`);
      const payload = await response.json();
      const data = {
        airport: airportCode,
        temperature: Number(payload.current?.temperature_2m),
        dewPoint: Number(payload.current?.dew_point_2m),
        temperatureUnit: payload.current_units?.temperature_2m || (settings.units === "metric" ? "°C" : "°F"),
        condition: weatherCodeLabel(payload.current?.weather_code),
        wind: Number(payload.current?.wind_speed_10m),
        windDirection: Number(payload.current?.wind_direction_10m),
        windUnit: payload.current_units?.wind_speed_10m || (settings.units === "metric" ? "km/h" : "mph"),
        visibilityMeters: Number(payload.current?.visibility),
        cloudCover: Number(payload.current?.cloud_cover),
        sunrise: payload.daily?.sunrise?.[0] || "",
        sunset: payload.daily?.sunset?.[0] || ""
      };
      data.category = aviationCategory(data.visibilityMeters, data.cloudCover);
      airportWeather.set(airportCode, { data, fetchedAt: Date.now() });
      return data;
    })().catch(() => null).finally(() => airportWeatherRequests.delete(airportCode));

    airportWeatherRequests.set(airportCode, request);
    return request;
  }

  function ensureSelectedRouteWeather() {
    const flight = flights[currentIndex];
    if (!flight) return;
    fetchAirportWeather(flight.origin);
    fetchAirportWeather(flight.destination);
  }

  function selectedRouteWeather(flight) {
    const destinationTurn = Math.floor(Date.now() / 8000) % 2 === 1;
    const preferredCode = destinationTurn ? flight.destination : flight.origin;
    const alternateCode = destinationTurn ? flight.origin : flight.destination;
    const preferred = airportWeatherRecord(preferredCode);
    const alternate = airportWeatherRecord(alternateCode);
    return {
      role: destinationTurn ? "DEST" : "ORIGIN",
      code: preferred ? preferredCode : alternate ? alternateCode : preferredCode,
      data: preferred || alternate || null
    };
  }

  function weatherCodeLabel(code) {
    const labels = {
      0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
      45: "Fog", 48: "Depositing rime fog",
      51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
      61: "Light rain", 63: "Rain", 65: "Heavy rain",
      71: "Light snow", 73: "Snow", 75: "Heavy snow",
      80: "Rain showers", 81: "Rain showers", 82: "Heavy showers",
      95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Severe thunderstorm"
    };
    return labels[Number(code)] || "Current conditions";
  }

  function formatWeatherTime(value) {
    if (!value) return "---";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "---";
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  async function fetchWeather() {
    const endpoint = String(CONFIG.WEATHER_API_URL || "").trim();
    if (!endpoint) return;

    elements.weatherRefreshButton.textContent = "…";
    elements.weatherTemperature.closest(".weather-card")?.classList.add("weather-loading");

    const url = new URL(endpoint);
    url.searchParams.set("latitude", String(settings.latitude));
    url.searchParams.set("longitude", String(settings.longitude));
    url.searchParams.set("current", "temperature_2m,weather_code,wind_speed_10m,visibility");
    url.searchParams.set("daily", "sunrise,sunset");
    url.searchParams.set("temperature_unit", settings.units === "metric" ? "celsius" : "fahrenheit");
    url.searchParams.set("wind_speed_unit", settings.units === "metric" ? "kmh" : "mph");
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("forecast_days", "1");

    try {
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Weather HTTP ${response.status}`);
      const payload = await response.json();

      weather = {
        temperature: Number(payload.current?.temperature_2m),
        temperatureUnit: payload.current_units?.temperature_2m || (settings.units === "metric" ? "°C" : "°F"),
        condition: weatherCodeLabel(payload.current?.weather_code),
        wind: Number(payload.current?.wind_speed_10m),
        windUnit: payload.current_units?.wind_speed_10m || (settings.units === "metric" ? "km/h" : "mph"),
        visibilityMeters: Number(payload.current?.visibility),
        sunrise: payload.daily?.sunrise?.[0] || "",
        sunset: payload.daily?.sunset?.[0] || ""
      };

      renderWeatherPanel();
    } catch (error) {
      elements.weatherCondition.textContent = `Unavailable: ${error.message}`;
    } finally {
      elements.weatherRefreshButton.textContent = "↻";
      elements.weatherTemperature.closest(".weather-card")?.classList.remove("weather-loading");
    }
  }

  function renderWeatherPanel() {
    if (!weather) return;
    const visibility = settings.units === "metric"
      ? `${(weather.visibilityMeters / 1000).toFixed(1)} km`
      : `${(weather.visibilityMeters / 1609.344).toFixed(1)} mi`;

    elements.weatherTemperature.textContent =
      `${Math.round(weather.temperature)}${weather.temperatureUnit.replace("°", "°")}`;
    elements.weatherCondition.textContent = weather.condition;
    elements.weatherWind.textContent = `${Math.round(weather.wind)} ${weather.windUnit}`;
    elements.weatherVisibility.textContent = visibility;
    elements.weatherSunrise.textContent = formatWeatherTime(weather.sunrise);
    elements.weatherSunset.textContent = formatWeatherTime(weather.sunset);
  }

  function updateClock() {
    elements.localClock.textContent = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function isNightByWeather() {
    if (!weather?.sunrise || !weather?.sunset) return null;
    const now = Date.now();
    const sunrise = new Date(weather.sunrise).getTime();
    const sunset = new Date(weather.sunset).getTime();
    if (!Number.isFinite(sunrise) || !Number.isFinite(sunset)) return null;
    return now < sunrise || now >= sunset;
  }

  function radiusNauticalMiles() {
    return Math.max(1, Math.min(250, Number(settings.radius || 35) / 1.15078));
  }

  function publicProviderEndpoints() {
    const lat = encodeURIComponent(settings.latitude);
    const lon = encodeURIComponent(settings.longitude);
    const radius = encodeURIComponent(radiusNauticalMiles().toFixed(1));

    return [
      {
        name: "ADSB.FI",
        url: `${String(CONFIG.ADSBFI_API_URL || "https://opendata.adsb.fi/api").replace(/\/+$/, "")}/v3/lat/${lat}/lon/${lon}/dist/${radius}`
      },
      {
        name: "AIRPLANES.LIVE",
        url: `${String(CONFIG.AIRPLANESLIVE_API_URL || "https://api.airplanes.live").replace(/\/+$/, "")}/v2/point/${lat}/${lon}/${radius}`
      },
      {
        name: "ADSB.LOL",
        url: `${String(CONFIG.ADSBLOL_API_URL || "https://api.adsb.lol").replace(/\/+$/, "")}/v2/lat/${lat}/lon/${lon}/dist/${radius}`
      }
    ];
  }

  function normalizePublicAircraft(raw) {
    if (!raw || typeof raw !== "object") return null;

    const latitude = finite(raw.lat, NaN);
    const longitude = finite(raw.lon, NaN);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    const callsign = String(raw.flight || raw.callsign || "").trim().toUpperCase();
    const altitudeValue = raw.alt_baro === "ground"
      ? 0
      : finite(raw.alt_geom, finite(raw.alt_baro, 0));
    const speedKnots = finite(raw.gs, 0);
    const verticalRate = finite(raw.geom_rate, finite(raw.baro_rate, 0));
    const distanceMi = haversineMiles(
      Number(settings.latitude),
      Number(settings.longitude),
      latitude,
      longitude
    );
    const bearingDegrees = initialBearing(
      Number(settings.latitude),
      Number(settings.longitude),
      latitude,
      longitude
    );
    const onGround = raw.alt_baro === "ground" || Boolean(raw.ground);

    return {
      id: String(raw.hex || raw.icao || callsign || crypto.randomUUID()).replace(/^~/, ""),
      icao24: String(raw.hex || raw.icao || "---").replace(/^~/, "").toUpperCase(),
      callsign,
      flightNumber: callsign,
      registration: String(raw.r || raw.registration || "").trim().toUpperCase(),
      airline: "",
      origin: "---",
      destination: "---",
      aircraft: raw.t || raw.desc || raw.type || "AIRCRAFT TYPE UNKNOWN",
      country: raw.ownOp || raw.r || "Unknown",
      latitude,
      longitude,
      altitudeFt: Math.round(altitudeValue),
      speedMph: Math.round(speedKnots * 1.15078),
      heading: finite(raw.track, finite(raw.true_heading, finite(raw.mag_heading, 0))),
      distanceMi: Math.round(distanceMi * 10) / 10,
      bearingDegrees,
      bearing: cardinal(bearingDegrees),
      verticalRateFpm: Math.round(verticalRate),
      status: onGround ? "ON GROUND" :
        verticalRate > 250 ? "CLIMBING" :
        verticalRate < -250 ? "DESCENDING" : "LEVEL",
      squawk: raw.squawk || "---",
      onGround,
      lastContact: Date.now() - Math.max(0, finite(raw.seen, 0)) * 1000
    };
  }

  function friendlyFetchError(error, providerName) {
    if (error?.name === "AbortError") {
      return `${providerName} timed out`;
    }

    const message = String(error?.message || error || "").trim();
    if (/failed to fetch|networkerror|load failed/i.test(message)) {
      return `${providerName} was blocked or unreachable from this browser`;
    }

    return `${providerName}: ${message || "request failed"}`;
  }

  async function requestJson(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Number(CONFIG.REQUEST_TIMEOUT_MS || 12000)
    );

    try {
      const response = await fetch(url, {
        method: "GET",
        mode: "cors",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        headers: { "Accept": "application/json", ...(options.headers || {}) },
        signal: controller.signal,
        cache: options.bypassCache ? "no-store" : "default"
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.toLowerCase().includes("json")) {
        throw new Error("provider did not return JSON");
      }

      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async function fetchFromPublicProviders({ bypassCache = false } = {}) {
    const errors = [];

    for (const provider of publicProviderEndpoints()) {
      try {
        const payload = await requestJson(provider.url, { bypassCache });
        const records =
          Array.isArray(payload?.ac) ? payload.ac :
          Array.isArray(payload?.aircraft) ? payload.aircraft :
          [];

        const normalized = records
          .map(normalizePublicAircraft)
          .filter(Boolean)
          .map(normalizeFlight)
          .filter(flight =>
            Number.isFinite(flight.latitude) &&
            Number.isFinite(flight.longitude) &&
            Number.isFinite(flight.distanceMi)
          )
          .filter(flight => flight.distanceMi <= Number(settings.radius || 35))
          .sort((a, b) => a.distanceMi - b.distanceMi)
          .slice(0, Number(settings.maximum || 16));

        if (!normalized.length) {
          throw new Error("no aircraft returned for this area");
        }

        return { records: normalized, source: provider.name };
      } catch (error) {
        errors.push(friendlyFetchError(error, provider.name));
      }
    }

    throw new Error(errors.join(" · "));
  }


  async function fetchFromWorker({ bypassCache = false } = {}) {
    const baseUrl = String(CONFIG.API_BASE_URL || "").trim().replace(/\/+$/, "");
    if (!baseUrl) throw new Error("Worker URL is not configured");

    const query = new URLSearchParams({
      lat: String(settings.latitude),
      lon: String(settings.longitude),
      radius: String(settings.radius),
      max: String(settings.maximum)
    });
    if (bypassCache) query.set("refresh", "1");

    const payload = await requestJson(`${baseUrl}/flights?${query}`, { bypassCache });
    const records = Array.isArray(payload) ? payload : payload.flights;
    if (!Array.isArray(records)) throw new Error("Worker response did not contain a flights array");

    const normalized = records.map(normalizeFlight).filter(Boolean).slice(0, settings.maximum);
    if (!normalized.length) throw new Error("Worker returned no aircraft for this area");
    return normalized;
  }

  function airportDisplayCode(airport) {
    if (!airport || typeof airport !== "object") return "";
    return String(
      airport.iata_code ||
      airport.iata ||
      airport.icao_code ||
      airport.icao ||
      ""
    ).trim().toUpperCase();
  }

  function parseRoutePayload(payload) {
    const response = payload?.response ?? payload;
    const route =
      response?.flightroute ||
      response?.flight_route ||
      response?.route ||
      payload?.flightroute ||
      payload?.flight_route ||
      payload?.route ||
      null;

    if (!route || typeof route !== "object") return null;

    const origin = airportDisplayCode(
      route.origin ||
      route.departure ||
      route.from ||
      route.origin_airport
    );
    const destination = airportDisplayCode(
      route.destination ||
      route.arrival ||
      route.to ||
      route.destination_airport
    );

    if (!origin || !destination || origin === destination) return null;

    return {
      origin,
      destination,
      airline: String(
        route.airline?.name ||
        route.airline_name ||
        ""
      ).trim(),
      callsignIata: String(route.callsign_iata || "").trim().toUpperCase(),
      callsignIcao: String(route.callsign_icao || "").trim().toUpperCase()
    };
  }

  function routeCacheKey(callsign, flight = null) {
    const normalizedCallsign = String(callsign || "").replace(/\s+/g, "").trim().toUpperCase();
    if (!normalizedCallsign) return "";

    const utcDate = new Date().toISOString().slice(0, 10);
    const icao24 = String(flight?.icao24 || "").replace(/^~/, "").trim().toUpperCase();
    const registration = String(flight?.registration || "").trim().toUpperCase();
    return [normalizedCallsign, utcDate, icao24, registration].filter(Boolean).join("|");
  }

  function readCachedRoute(callsign) {
    const key = routeCacheKey(callsign);
    if (!key) return undefined;

    const cached = routeCache.get(key);
    if (!cached) return undefined;

    const ttl = Math.max(1, Number(CONFIG.ROUTE_CACHE_MINUTES || 15)) * 60 * 1000;
    if (Date.now() - cached.savedAt > ttl) {
      routeCache.delete(key);
      return undefined;
    }

    return cached.route;
  }

  function saveCachedRoute(callsign, route) {
    const key = routeCacheKey(callsign);
    if (!key) return;
    routeCache.set(key, { route, savedAt: Date.now() });
  }

  async function fetchRouteForCallsign(callsign, flight = null) {
    const lookupCallsign = String(callsign || "").replace(/\s+/g, "").trim().toUpperCase();
    const key = routeCacheKey(lookupCallsign, flight);
    if (!lookupCallsign || lookupCallsign.length < 3 || !key) return null;

    const cached = readCachedRoute(key);
    if (cached !== undefined) return cached;

    const base = String(CONFIG.ROUTE_API_URL || "https://api.adsbdb.com/v0/callsign")
      .trim()
      .replace(/\/+$/, "");

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Math.max(1500, Number(CONFIG.ROUTE_LOOKUP_TIMEOUT_MS || 7000))
    );

    try {
      const response = await fetch(`${base}/${encodeURIComponent(lookupCallsign)}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
        cache: "no-store"
      });

      if (!response.ok) {
        saveCachedRoute(key, null);
        return null;
      }

      const payload = await response.json();
      const route = parseRoutePayload(payload);
      saveCachedRoute(key, route);
      return route;
    } catch {
      // Route enrichment is optional; live telemetry remains usable without it.
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  function angleDifference(a, b) {
    const first = Number(a);
    const second = Number(b);
    if (!Number.isFinite(first) || !Number.isFinite(second)) return 0;
    return Math.abs(((first - second + 540) % 360) - 180);
  }

  function degreesToRadians(value) {
    return Number(value) * Math.PI / 180;
  }

  function crossTrackDistanceMiles(origin, destination, point) {
    const earthRadiusMiles = 3958.7613;
    const distance13 = haversineMiles(origin[0], origin[1], point[0], point[1]) / earthRadiusMiles;
    const bearing13 = degreesToRadians(initialBearing(origin[0], origin[1], point[0], point[1]));
    const bearing12 = degreesToRadians(initialBearing(origin[0], origin[1], destination[0], destination[1]));
    const sine = Math.sin(distance13) * Math.sin(bearing13 - bearing12);
    return Math.abs(Math.asin(Math.max(-1, Math.min(1, sine))) * earthRadiusMiles);
  }

  function routeConfidence(route, flight) {
    const originCoordinates = airportLocations[String(route.origin || "").toUpperCase()];
    const destinationCoordinates = airportLocations[String(route.destination || "").toUpperCase()];
    const aircraftLatitude = Number(flight.latitude);
    const aircraftLongitude = Number(flight.longitude);

    if (!originCoordinates || !destinationCoordinates ||
        !Number.isFinite(aircraftLatitude) || !Number.isFinite(aircraftLongitude)) {
      return { accepted:false, score:0, reason:"unverifiable-airport" };
    }

    const aircraftCoordinates = [aircraftLatitude, aircraftLongitude];
    const routeDistance = haversineMiles(originCoordinates[0], originCoordinates[1], destinationCoordinates[0], destinationCoordinates[1]);
    const distanceFromOrigin = haversineMiles(originCoordinates[0], originCoordinates[1], aircraftCoordinates[0], aircraftCoordinates[1]);
    const distanceToDestination = haversineMiles(aircraftCoordinates[0], aircraftCoordinates[1], destinationCoordinates[0], destinationCoordinates[1]);

    if (!Number.isFinite(routeDistance) || routeDistance < 25) {
      return { accepted:false, score:0, reason:"invalid-route" };
    }

    let score = 20;
    const pathRatio = (distanceFromOrigin + distanceToDestination) / routeDistance;
    const crossTrack = crossTrackDistanceMiles(originCoordinates, destinationCoordinates, aircraftCoordinates);

    if (pathRatio <= 1.18) score += 25;
    else if (pathRatio <= 1.30) score += 10;
    else return { accepted:false, score, reason:"path-detour" };

    const allowedCrossTrack = Math.max(35, Math.min(85, routeDistance * 0.10));
    if (crossTrack <= allowedCrossTrack * 0.55) score += 25;
    else if (crossTrack <= allowedCrossTrack) score += 10;
    else return { accepted:false, score, reason:"off-route" };

    if (!flight.onGround && distanceToDestination > 55 && distanceFromOrigin > 35) {
      const destinationBearing = initialBearing(aircraftCoordinates[0], aircraftCoordinates[1], destinationCoordinates[0], destinationCoordinates[1]);
      const difference = angleDifference(flight.heading, destinationBearing);
      if (difference <= 45) score += 25;
      else if (difference <= 70) score += 10;
      else return { accepted:false, score, reason:"wrong-heading" };
    } else {
      score += 15;
    }

    // An aircraft should normally be no farther from both endpoints than a modest
    // extension of the published route. This rejects recycled callsigns after a
    // schedule or aircraft assignment change.
    if (distanceFromOrigin > routeDistance * 1.20 && distanceToDestination > routeDistance * 1.20) {
      return { accepted:false, score, reason:"outside-route-span" };
    }

    return { accepted:score >= 65, score, reason:score >= 65 ? "verified" : "low-confidence" };
  }

  function routeIsPlausibleForFlight(route, flight) {
    return routeConfidence(route, flight).accepted;
  }

  async function enrichFlightRoutes(records) {
    if (!CONFIG.ROUTE_LOOKUP_ENABLED || !Array.isArray(records) || !records.length) return;

    const generation = ++routeEnrichmentGeneration;
    const candidates = records.filter(flight =>
      routeCacheKey(flight.callsign || flight.flightNumber, flight)
    );

    let cursor = 0;
    const workerCount = Math.min(4, candidates.length);

    async function lookupWorker() {
      while (cursor < candidates.length) {
        const index = cursor++;
        const flight = candidates[index];
        const route = await fetchRouteForCallsign(flight.callsign || flight.flightNumber, flight);

        if (generation !== routeEnrichmentGeneration) return;

        const confidence = route ? routeConfidence(route, flight) : { accepted:false, score:0, reason:"no-route" };

        if (route && confidence.accepted) {
          flight.origin = route.origin;
          flight.destination = route.destination;
          flight.routeAvailable = true;
          flight.routeConfidence = confidence.score;
          flight.routeValidation = confidence.reason;
          flight.routeVerified = Boolean(
            airportLocations[String(route.origin || "").toUpperCase()] &&
            airportLocations[String(route.destination || "").toUpperCase()]
          );

          if ((!flight.airline || flight.airline === "Unknown") && route.airline) {
            flight.airline = route.airline;
          }

          if (route.callsignIata && route.callsignIata !== flight.flightNumber) {
            flight.displayFlightNumber = route.callsignIata;
          }
        } else {
          flight.origin = "---";
          flight.destination = "---";
          flight.routeAvailable = false;
          flight.routeVerified = false;
          flight.routeConfidence = confidence.score;
          flight.routeValidation = confidence.reason;
        }

        updateUi();
      }
    }

    await Promise.all(Array.from({ length: workerCount }, lookupWorker));
  }

  function routeDisplay(flight) {
    const origin = String(flight.origin || "").trim().toUpperCase();
    const destination = String(flight.destination || "").trim().toUpperCase();

    const validOrigin = origin && origin !== "---" && origin !== "UNKNOWN";
    const validDestination = destination && destination !== "---" && destination !== "UNKNOWN";

    return validOrigin && validDestination
      ? `${origin} → ${destination}`
      : "ROUTE UNAVAILABLE";
  }

  async function fetchFlights({ bypassCache = false } = {}) {
    if (isLoading) return;
    isLoading = true;
    elements.refreshButton.textContent = "…";

    const mode = String(CONFIG.LIVE_DATA_MODE || "AUTO").trim().toUpperCase();
    if (mode === "DEMO") {
      useDemoFlights();
      isLoading = false;
      elements.refreshButton.textContent = "↻";
      return;
    }

    const selectedId = flights[currentIndex]?.id || flights[currentIndex]?.icao24 || "";
    const attempts = [];

    if (mode === "AUTO" || mode === "PUBLIC" || mode === "ADSBLOL") {
      attempts.push({
        source: "PUBLIC",
        load: async () => {
          const result = await fetchFromPublicProviders({ bypassCache });
          return result;
        }
      });
    }

    if ((mode === "AUTO" || mode === "WORKER") && String(CONFIG.API_BASE_URL || "").trim()) {
      attempts.push({
        source: "WORKER",
        load: async () => ({
          records: await fetchFromWorker({ bypassCache }),
          source: "WORKER"
        })
      });
    }

    let lastError = new Error("No live data provider is enabled");

    try {
      for (const attempt of attempts) {
        try {
          const result = await attempt.load();
          const records = Array.isArray(result) ? result : result.records;
          flights = records;
          registerInterpolationTargets(flights);

          const preservedIndex = selectedId
            ? flights.findIndex(flight => flight.id === selectedId || flight.icao24 === selectedId)
            : -1;

          currentIndex = preservedIndex >= 0
            ? preservedIndex
            : Math.max(0, Math.min(currentIndex, flights.length - 1));
          previousIndex = Math.max(0, Math.min(currentIndex, flights.length - 1));
          transitionStarted = performance.now() - 1000;
          lastLiveSource = result?.source || attempt.source;
          setProvider("LIVE");
          updateUi();
          void enrichFlightRoutes(flights);
          return;
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError;
    } catch (error) {
      lastLiveSource = "";
      useDemoFlights(`Live data unavailable: ${error.message || "all providers failed"}`);
    } finally {
      elements.refreshButton.textContent = "↻";
      isLoading = false;
    }
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

  function shortestAngleDelta(from, to) {
    return ((Number(to || 0) - Number(from || 0) + 540) % 360) - 180;
  }

  function interpolateNumber(from, to, progress) {
    const start = Number(from);
    const end = Number(to);
    if (!Number.isFinite(start)) return Number.isFinite(end) ? end : 0;
    if (!Number.isFinite(end)) return start;
    return start + (end - start) * progress;
  }

  function interpolateAngle(from, to, progress) {
    const start = Number(from || 0);
    return (start + shortestAngleDelta(start, to) * progress + 360) % 360;
  }

  function flightSnapshot(flight) {
    return {
      latitude: Number(flight.latitude || 0),
      longitude: Number(flight.longitude || 0),
      altitudeFt: Number(flight.altitudeFt || 0),
      speedMph: Number(flight.speedMph || 0),
      heading: Number(flight.heading || 0),
      distanceMi: Number(flight.distanceMi || 0),
      verticalRateFpm: Number(flight.verticalRateFpm || 0)
    };
  }

  function interpolatedSnapshot(state, now = performance.now()) {
    if (!state) return null;

    const raw = state.duration > 0
      ? (now - state.startedAt) / state.duration
      : 1;
    const progress = Math.max(0, Math.min(1, raw));
    const eased = progress < .5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    return {
      latitude: interpolateNumber(state.from.latitude, state.to.latitude, eased),
      longitude: interpolateNumber(state.from.longitude, state.to.longitude, eased),
      altitudeFt: interpolateNumber(state.from.altitudeFt, state.to.altitudeFt, eased),
      speedMph: interpolateNumber(state.from.speedMph, state.to.speedMph, eased),
      heading: interpolateAngle(state.from.heading, state.to.heading, eased),
      distanceMi: interpolateNumber(state.from.distanceMi, state.to.distanceMi, eased),
      verticalRateFpm: interpolateNumber(state.from.verticalRateFpm, state.to.verticalRateFpm, eased)
    };
  }

  function registerInterpolationTargets(nextFlights) {
    const now = performance.now();
    const activeIds = new Set();

    nextFlights.forEach(flight => {
      const id = flight.id || flight.icao24;
      if (!id) return;

      activeIds.add(id);
      const target = flightSnapshot(flight);
      const existing = interpolationState.get(id);
      const current = existing ? interpolatedSnapshot(existing, now) : target;

      interpolationState.set(id, {
        from: current,
        to: target,
        startedAt: now,
        duration: INTERPOLATION_WINDOW_MS
      });
    });

    for (const id of interpolationState.keys()) {
      if (!activeIds.has(id)) interpolationState.delete(id);
    }
  }

  function interpolatedFlight(flight, now = performance.now()) {
    if (!flight) return flight;
    const id = flight.id || flight.icao24;
    const snapshot = id ? interpolatedSnapshot(interpolationState.get(id), now) : null;
    return snapshot ? { ...flight, ...snapshot } : flight;
  }

  function inferFlightPhase(flight) {
    const altitude = Number(flight.altitudeFt || 0);
    const speed = Number(flight.speedMph || 0);
    const vertical = Number(flight.verticalRateFpm || 0);
    const distance = Number(flight.distanceMi || 0);
    const onGround = Boolean(flight.onGround);
    const explicit = String(flight.rawStatus || flight.status || "").toUpperCase();

    if (explicit.includes("CANCEL")) return "CANCELLED";
    if (explicit.includes("DIVERT")) return "DIVERTED";
    if (explicit.includes("DELAY")) return "DELAYED";

    if (onGround || altitude < 200) {
      if (speed >= 35) return "TAXIING";
      if (distance > 0 && distance <= 3) return "AT GATE";
      return speed > 5 ? "TAXIING" : "ON GROUND";
    }

    if (altitude < 3000) {
      if (vertical > 600) return "TAKEOFF";
      if (vertical < -650) return distance <= 10 ? "FINAL APPROACH" : "APPROACHING";
      return "LOW ALTITUDE";
    }

    if (vertical > 900) return "CLIMBING";
    if (vertical < -900) return distance <= 35 ? "APPROACHING" : "DESCENDING";
    if (altitude >= 24000 && Math.abs(vertical) < 500) return "CRUISING";
    if (Math.abs(vertical) < 350) return "EN ROUTE";

    return vertical > 0 ? "CLIMBING" : "DESCENDING";
  }

  function operationalStatus(flight, arrival = false) {
    const phase = inferFlightPhase(flight);

    if (["CANCELLED", "DIVERTED", "DELAYED"].includes(phase)) return phase;
    if (phase === "AT GATE" || phase === "ON GROUND") return arrival ? "ARRIVED" : "BOARDING";
    if (phase === "TAXIING") return arrival ? "TAXI TO GATE" : "TAXIING";
    if (phase === "TAKEOFF") return "DEPARTED";
    if (phase === "FINAL APPROACH") return arrival ? "LANDING" : "FINAL APPROACH";
    if (phase === "APPROACHING") return arrival ? "LANDING" : "APPROACHING";
    if (phase === "DESCENDING") return arrival ? "EN ROUTE" : "DESCENDING";
    if (phase === "CLIMBING") return arrival ? "EN ROUTE" : "DEPARTED";
    if (phase === "CRUISING" || phase === "EN ROUTE") return arrival ? "EN ROUTE" : "ON TIME";
    return phase;
  }

  function normalizedTimestamp(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return Date.now();
    return number < 1e12 ? number * 1000 : number;
  }

  function estimateFlightTiming(flight) {
    const distance = Math.max(0, Number(flight.distanceMi || 0));
    const speed = Math.max(0, Number(flight.speedMph || 0));
    const phase = inferFlightPhase(flight);

    if (["AT GATE", "ON GROUND", "LANDED", "ARRIVED"].includes(phase)) {
      return {
        eta: "ARRIVED",
        remaining: "0 MIN",
        remainingMinutes: 0
      };
    }

    if (!distance || speed < 40) {
      return {
        eta: "--",
        remaining: "--",
        remainingMinutes: null
      };
    }

    // Use a conservative effective speed so low-speed approach data does not
    // create implausibly long ETAs, while still responding to live velocity.
    const effectiveSpeed = Math.max(
      phase === "FINAL APPROACH" || phase === "APPROACHING" ? 140 : 180,
      speed
    );

    const hours = Math.min(24, distance / effectiveSpeed);
    const remainingMinutes = Math.max(1, Math.round(hours * 60));
    const etaDate = new Date(Date.now() + remainingMinutes * 60000);

    const remaining = remainingMinutes >= 60
      ? `${Math.floor(remainingMinutes / 60)}H ${remainingMinutes % 60}M`
      : `${remainingMinutes} MIN`;

    return {
      eta: etaDate.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
      }).replace(" ", ""),
      remaining,
      remainingMinutes
    };
  }

  function formatDataAge(lastContact) {
    const ageSeconds = Math.max(
      0,
      Math.round((Date.now() - normalizedTimestamp(lastContact)) / 1000)
    );

    if (ageSeconds < 60) return `${ageSeconds}S`;
    if (ageSeconds < 3600) return `${Math.floor(ageSeconds / 60)}M`;
    return `${Math.floor(ageSeconds / 3600)}H`;
  }

  function dataAgeColor(lastContact, palette) {
    const ageSeconds = Math.max(
      0,
      (Date.now() - normalizedTimestamp(lastContact)) / 1000
    );

    if (ageSeconds > 120) return "#ff4f5f";
    if (ageSeconds > 45) return "#ffd43b";
    return palette.secondary;
  }

  function normalizeFlight(raw) {
    const callsign = String(raw.callsign || raw.flightNumber || "").trim().toUpperCase();
    const prefix = callsign.slice(0, 3);
    const airline = raw.airline || airlinePrefixes[prefix] || "AIRCRAFT";
    const altitudeFt = finite(raw.altitudeFt, finite(raw.altitude, 0));
    const verticalRateFpm = finite(raw.verticalRateFpm, finite(raw.verticalRate, 0));

    return {
      id: String(raw.id || raw.icao24 || callsign || crypto.randomUUID()),
      icao24: String(raw.icao24 || raw.id || "---").toUpperCase(),
      callsign,
      flightNumber: displayValue(raw.flightNumber || formatFlightNumber(callsign), "UNKNOWN"),
      airline: displayValue(airline, "AIRCRAFT"),
      origin: displayValue(raw.origin, "---").toUpperCase(),
      destination: displayValue(raw.destination, "---").toUpperCase(),
      aircraft: raw.aircraft || "AIRCRAFT TYPE UNKNOWN",
      country: raw.country || "Unknown",
      latitude: finite(raw.latitude, 0),
      longitude: finite(raw.longitude, 0),
      altitudeFt,
      speedMph: finite(raw.speedMph, finite(raw.speed, 0)),
      heading: finite(raw.heading, 0),
      distanceMi: finite(raw.distanceMi, finite(raw.distance, 0)),
      bearing: raw.bearing || cardinal(finite(raw.bearingDegrees, 0)),
      verticalRateFpm,
      rawStatus: raw.status || "",
      status: raw.status || statusFromRate(verticalRateFpm, raw.onGround),
      squawk: raw.squawk || "---",
      lastContact: normalizedTimestamp(raw.lastContact || raw.lastSeen || raw.timestamp),
      onGround: Boolean(raw.onGround)
    };
  }

  function finite(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function formatFlightNumber(callsign) {
    if (!callsign) return "UNKNOWN";
    const match = callsign.match(/^([A-Z]{2,3})(\d.*)$/);
    return match ? `${match[1]} ${match[2]}` : callsign;
  }

  function statusFromRate(rate, onGround) {
    if (onGround) return "ON GROUND";
    if (rate > 250) return "CLIMBING";
    if (rate < -250) return "DESCENDING";
    return "LEVEL";
  }

  function cardinal(degrees) {
    const names = ["N","NE","E","SE","S","SW","W","NW"];
    return names[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
  }

  function useDemoFlights(message = "") {
    flights = demoFlights.map(flight => ({ ...flight }));
    registerInterpolationTargets(flights);
    currentIndex = Math.max(0, Math.min(currentIndex, flights.length - 1));
    previousIndex = currentIndex;
    setProvider(message ? "ERROR" : "DEMO", message);
    updateUi();
  }

  function filteredFlights() {
    const term = elements.searchInput.value.trim().toLowerCase();
    return flights.filter(flight => {
      if (settings.commercialOnly && !/[A-Z]{2,3}\d/.test(flight.callsign)) return false;
      if (favoritesOnly && !settings.favorites.includes(flight.id)) return false;
      if (!term) return true;
      return [flight.callsign, flight.flightNumber, flight.airline, flight.icao24]
        .some(value => String(value || "").toLowerCase().includes(term));
    });
  }

  function updateUi() {
    elements.aircraftCount.textContent = flights.length;
    ensureSelectedRouteWeather();
    elements.updatedAt.textContent = new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", second:"2-digit" });
    renderFlightList();
    updateTelemetry();
  }

  function renderFlightList() {
    const visible = filteredFlights();
    if (!visible.length) {
      elements.flightList.innerHTML = '<div class="empty-list">No aircraft match the current filters.</div>';
      return;
    }

    const current = flights[currentIndex];
    elements.flightList.innerHTML = visible.map(flight => {
      const index = flights.findIndex(item => item.id === flight.id);
      const favorite = settings.favorites.includes(flight.id);
      return `
        <article class="flight-card ${flight.id === current?.id ? "active" : ""}" data-index="${index}">
          <div class="flight-number">${escapeHtml(flight.flightNumber)}</div>
          <div>
            <span class="distance">${flight.distanceMi.toFixed(1)} MI</span>
            <button class="favorite-button ${favorite ? "favorite" : ""}" type="button" data-favorite="${escapeHtml(flight.id)}" aria-label="Toggle favorite">${favorite ? "★" : "☆"}</button>
          </div>
          <div class="route">${escapeHtml(flight.origin)} → ${escapeHtml(flight.destination)}</div>
          <div class="meta">${escapeHtml(flight.airline)} · ${escapeHtml(flight.status)} · ${Math.round(flight.altitudeFt).toLocaleString()} FT</div>
        </article>`;
    }).join("");

    elements.flightList.querySelectorAll(".flight-card").forEach(card => {
      card.addEventListener("click", event => {
        if (event.target.closest("[data-favorite]")) return;
        selectFlight(Number(card.dataset.index), true);
      });
    });

    elements.flightList.querySelectorAll("[data-favorite]").forEach(button => {
      button.addEventListener("click", event => {
        event.stopPropagation();
        toggleFavorite(button.dataset.favorite);
      });
    });
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
    })[char]);
  }

  function toggleFavorite(id) {
    settings.favorites = settings.favorites.includes(id)
      ? settings.favorites.filter(value => value !== id)
      : [...settings.favorites, id];
    saveSettings();
    renderFlightList();
  }

  function updateTelemetry() {
    const flight = flights[currentIndex];
    if (!flight) return;
    elements.selectedFlight.textContent = flight.flightNumber;
    elements.selectedIcao.textContent = flight.icao24;
    elements.selectedCountry.textContent = flight.country;
    elements.selectedSquawk.textContent = flight.squawk;
    elements.selectedPosition.textContent = `${flight.latitude.toFixed(3)}, ${flight.longitude.toFixed(3)}`;
  }

  function selectFlight(index, restart = false) {
    if (!flights.length) return;
    previousIndex = currentIndex;
    currentIndex = (index + flights.length) % flights.length;
    transitionStarted = performance.now();
    renderFlightList();
    updateTelemetry();
    ensureSelectedRouteWeather();
    if (restart) scheduleRotation();
  }

  function scheduleRotation() {
    clearInterval(rotationTimer);
    if (paused) return;
    rotationTimer = setInterval(() => selectFlight(currentIndex + 1), settings.rotation * 1000);
  }

  function scheduleRefresh() {
    clearInterval(refreshTimer);
    refreshTimer = setInterval(fetchFlights, Number(CONFIG.REFRESH_SECONDS || 20) * 1000);
  }

  function readTrackingSettings() {
    settings.zipCode = String(elements.zipCodeInput.value || "").trim();
    settings.latitude = finite(elements.latitudeInput.value, defaults.latitude);
    settings.longitude = finite(elements.longitudeInput.value, defaults.longitude);
    settings.radius = Math.min(250, Math.max(1, finite(elements.radiusInput.value, defaults.radius)));
    settings.maximum = Math.min(50, Math.max(1, Math.round(finite(elements.maximumInput.value, defaults.maximum))));
    settings.commercialOnly = elements.commercialOnlyInput.checked;
    settings.autoLocate = elements.autoLocateInput.checked;
    settings.showWeather = elements.showWeatherInput.checked;
    settings.radarContacts = Number(elements.radarContactsRange.value);
    settings.trailLength = Number(elements.trailLengthRange.value);
    settings.headingVectors = elements.headingVectorsInput.checked;
    settings.radarLabels = elements.radarLabelsInput.checked;
    saveSettings();
  }

  function setZipCodeStatus(message, state = "") {
    elements.zipCodeStatus.textContent = message;
    elements.zipCodeStatus.classList.toggle("success", state === "success");
    elements.zipCodeStatus.classList.toggle("error", state === "error");
  }

  async function applyZipCode({ refresh = true } = {}) {
    const rawZip = String(elements.zipCodeInput.value || "").trim();
    if (!/^\d{5}(?:-\d{4})?$/.test(rawZip)) {
      setZipCodeStatus("Enter a valid 5-digit U.S. ZIP code.", "error");
      elements.zipCodeInput.focus();
      return false;
    }
    const zip = rawZip.slice(0, 5);
    const originalText = elements.zipCodeButton.textContent;
    elements.zipCodeButton.disabled = true;
    elements.zipCodeButton.textContent = "Locating…";
    setZipCodeStatus(`Looking up ZIP code ${zip}…`);
    try {
      const response = await fetch(`https://api.zippopotam.us/us/${encodeURIComponent(zip)}`, { headers:{"Accept":"application/json"} });
      if (!response.ok) throw new Error(response.status === 404 ? "ZIP code not found." : "ZIP lookup unavailable.");
      const payload = await response.json();
      const place = payload?.places?.[0];
      const latitude = Number(place?.latitude);
      const longitude = Number(place?.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error("ZIP lookup returned an invalid location.");
      elements.zipCodeInput.value = zip;
      elements.latitudeInput.value = latitude.toFixed(5);
      elements.longitudeInput.value = longitude.toFixed(5);
      settings.zipCode = zip;
      settings.latitude = latitude;
      settings.longitude = longitude;
      saveSettings();
      const placeName = [place["place name"], place["state abbreviation"]].filter(Boolean).join(", ");
      setZipCodeStatus(`${zip}${placeName ? ` · ${placeName}` : ""} selected.`, "success");
      if (refresh) {
        readTrackingSettings();
        await Promise.allSettled([fetchFlights({ bypassCache:true }), fetchWeather()]);
      }
      return true;
    } catch (error) {
      setZipCodeStatus(error?.message || "Unable to look up that ZIP code.", "error");
      return false;
    } finally {
      elements.zipCodeButton.disabled = false;
      elements.zipCodeButton.textContent = originalText;
    }
  }

  function applyDisplaySettings() {
    settings.layout = elements.layoutSelect.value;
    settings.theme = elements.themeSelect.value;
    settings.units = elements.unitsSelect.value;
    settings.rotation = Number(elements.rotationSelect.value);
    settings.brightness = Number(elements.brightnessRange.value);
    settings.autoBrightness = elements.autoBrightnessInput.checked;
    settings.showWeather = elements.showWeatherInput.checked;
    settings.radarContacts = Number(elements.radarContactsRange.value);
    settings.trailLength = Number(elements.trailLengthRange.value);
    settings.headingVectors = elements.headingVectorsInput.checked;
    settings.radarLabels = elements.radarLabelsInput.checked;
    settings.dotSize = Number(elements.dotRange.value);
    saveSettings();
    updateOutputs();
    transitionStarted = performance.now();
    scheduleRotation();
  }

  function unitValues(flight) {
    if (settings.units === "metric") {
      return {
        altitude: `${Math.round(flight.altitudeFt * .3048).toLocaleString()} M`,
        speed: `${Math.round(flight.speedMph * 1.60934)} KM/H`,
        distance: `${(flight.distanceMi * 1.60934).toFixed(1)} KM`
      };
    }
    return {
      altitude: `${Math.round(flight.altitudeFt).toLocaleString()} FT`,
      speed: `${Math.round(flight.speedMph)} MPH`,
      distance: `${flight.distanceMi.toFixed(1)} MI`
    };
  }

  function resizeCanvas() {
    const rect = elements.displayBezel.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    elements.ledCanvas.width = Math.max(1, Math.round(rect.width * dpr));
    elements.ledCanvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawDotGrid(width, height, palette) {
    const step = Math.max(6, settings.dotSize * 2.3);
    const radius = Math.max(1, settings.dotSize * .42);
    ctx.save();
    ctx.fillStyle = palette.grid;
    for (let y = step / 2; y < height; y += step) {
      for (let x = step / 2; x < width; x += step) {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function effectiveBrightness() {
    if (!settings.autoBrightness) return settings.brightness;
    const weatherNight = isNightByWeather();
    const hour = new Date().getHours();
    const night = weatherNight ?? (hour >= 21 || hour < 7);
    return night ? Math.min(settings.brightness, 48) : settings.brightness;
  }

  function drawLedText(text, x, y, size, color, align = "left", alpha = 1, weight = 800) {
    const dot = Math.max(1.05, size / 8.4);
    window.LEDFont.drawText(ctx, text, x, y, {
      dot,
      gap: .9,
      color,
      align,
      alpha: alpha * effectiveBrightness() / 100,
      glow: Math.max(2, dot * 2.4)
    });
  }

  function displayValue(value, fallback = "--") {
    const text = String(value ?? "").trim();
    return text && text !== "undefined" && text !== "null" ? text : fallback;
  }

  function fitLedSize(text, preferredSize, maxWidth, minimumSize = 8) {
    const value = displayValue(text);
    let size = Math.max(minimumSize, Number(preferredSize || minimumSize));
    const available = Math.max(1, Number(maxWidth || 1));

    while (size > minimumSize) {
      const dot = Math.max(.75, size / 8.4);
      const measured = window.LEDFont.measure(value, dot, .9);
      if (measured <= available) break;
      size -= Math.max(.5, size * .045);
    }

    return Math.max(minimumSize, size);
  }

  function drawLedTextFit(
    text,
    x,
    y,
    preferredSize,
    maxWidth,
    color,
    align = "left",
    alpha = 1,
    weight = 800,
    minimumSize = 8
  ) {
    const value = displayValue(text);
    const size = fitLedSize(value, preferredSize, maxWidth, minimumSize);
    drawLedText(value, x, y, size, color, align, alpha, weight);
    return size;
  }

  function drawAirlineLogo(flight, x, y, size, alpha = 1) {
    if (!window.AirlineLogos) return 0;
    try {
      return window.AirlineLogos.draw(ctx, flight, x, y, {
        dot: Math.max(1.2, size / 8.5),
        alpha,
        brightness: effectiveBrightness() / 100,
        glow: Math.max(2, size / 3.5)
      });
    } catch (error) {
      console.warn("Airline logo draw skipped:", error);
      return 0;
    }
  }

  function drawAirlineLogoFit(flight, x, y, width, height, alpha = 1) {
    if (!window.AirlineLogos?.drawFit) return null;
    try {
      return window.AirlineLogos.drawFit(
        ctx,
        flight,
        { x, y, width, height },
        {
          padding: Math.max(4, Math.min(width, height) * .025),
          alpha,
          brightness: effectiveBrightness() / 100
        }
      );
    } catch (error) {
      console.warn("Airline logo fit skipped:", error);
      return null;
    }
  }

  function airlineAccent(flight, palette) {
    if (settings.theme !== "cyan") return palette.secondary;
    const name = String(flight.airline || "").toUpperCase();
    if (name.includes("AMERICAN")) return "#7ed7ff";
    if (name.includes("DELTA")) return "#ff606e";
    if (name.includes("UNITED")) return "#54a9ff";
    if (name.includes("SOUTHWEST")) return "#ffd34f";
    if (name.includes("JETBLUE")) return "#4fb6ff";
    if (name.includes("FRONTIER")) return "#65e58c";
    if (name.includes("SPIRIT")) return "#ffe342";
    return palette.secondary;
  }

  function drawLedRule(x1, y1, x2, y2, color, alpha = 1, width = 1) {
    ctx.save();
    ctx.globalAlpha = alpha * effectiveBrightness() / 100;
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 4;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function airportCity(code) {
    const cities = {
      ATL: "Atlanta, GA", BOS: "Boston, MA", BWI: "Baltimore, MD",
      CLT: "Charlotte, NC", DCA: "Washington, DC", DEN: "Denver, CO",
      DFW: "Dallas, TX", DTW: "Detroit, MI", EWR: "Newark, NJ",
      FLL: "Fort Lauderdale, FL", IAD: "Washington, DC", IAH: "Houston, TX",
      JFK: "New York, NY", LAS: "Las Vegas, NV", LAX: "Los Angeles, CA",
      MCO: "Orlando, FL", MIA: "Miami, FL", MSP: "Minneapolis, MN",
      ORD: "Chicago, IL", PHL: "Philadelphia, PA", PHX: "Phoenix, AZ",
      SAN: "San Diego, CA", SEA: "Seattle, WA", SFO: "San Francisco, CA",
      SLC: "Salt Lake City, UT", TPA: "Tampa, FL"
    };
    return cities[String(code || "").toUpperCase()] || String(code || "");
  }

  function timeMinutesFromNow(minutes) {
    const date = new Date(Date.now() + minutes * 60000);
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    }).replace(" ", "");
  }

  function selectedFlightTimes(flight) {
    const hash = boardHash(flight.icao24 || flight.flightNumber);
    const departureOffset = 20 + (hash % 100);
    return {
      departure: timeMinutesFromNow(departureOffset),
      boarding: timeMinutesFromNow(Math.max(0, departureOffset - 40))
    };
  }

  function resolvedAirlineName(flight) {
    const explicit = String(flight?.airline || "").trim();
    if (explicit) return explicit;

    const callsign = String(
      flight?.callsign ||
      flight?.flightNumber ||
      ""
    ).replace(/\s+/g, "").trim().toUpperCase();

    const threeLetterPrefix = callsign.slice(0, 3);
    const twoLetterPrefix = callsign.slice(0, 2);

    return (
      airlinePrefixes[threeLetterPrefix] ||
      airlinePrefixes[twoLetterPrefix] ||
      String(flight?.country || "").trim() ||
      "AIRCRAFT"
    );
  }

  function drawClassic(flight, alpha, slideX, width, height, palette) {
    const pad = Math.max(22, width * .032);
    const right = width - pad;
    const values = unitValues(flight);
    const airline = displayValue(resolvedAirlineName(flight), "AIRCRAFT");
    const flightNumber = displayValue(flight.displayFlightNumber || flight.flightNumber || flight.callsign, "UNKNOWN");
    const aircraftType = displayValue(flight.aircraft, "TYPE UNKNOWN");
    const status = operationalStatus(flight);
    const statusColor = boardStatusColor(status, palette);
    const verticalRate = Number(flight.verticalRateFpm || 0);
    const verticalText = `${verticalRate >= 0 ? "+" : ""}${Math.round(verticalRate).toLocaleString()} FPM`;
    const headingText = `${Math.round(Number(flight.heading || 0))}° ${cardinal(Number(flight.heading || 0))}`;
    const logoWidth = width * .29;
    const contentX = logoWidth + width * .055;

    ctx.save();
    ctx.translate(slideX, 0);

    // Quiet logo field.
    const logoX = pad;
    const logoY = height * .09;
    const logoW = logoWidth - pad - width * .018;
    const logoH = height * .48;

    const logoDrawn = drawAirlineLogoFit(
      flight,
      logoX,
      logoY,
      logoW,
      logoH,
      alpha
    );

    if (!logoDrawn) {
      drawLedTextFit(
        String(flight.callsign || flight.icao24 || "AIR").slice(0, 4),
        logoX + logoW / 2,
        logoY + logoH * .34,
        Math.max(38, width * .058),
        logoW * .88,
        airlineAccent(flight, palette),
        "center",
        alpha,
        900,
        Math.max(18, width * .023)
      );
    }

    drawLedRule(
      logoWidth,
      height * .08,
      logoWidth,
      height * .70,
      palette.accent,
      alpha * .35,
      1
    );

    // Primary identity.
    drawLedTextFit(
      airline,
      contentX,
      height * .075,
      Math.max(18, width * .026),
      right - contentX,
      palette.secondary,
      "left",
      alpha,
      750,
      Math.max(10, width * .012)
    );

    drawLedTextFit(
      flightNumber,
      contentX,
      height * .17,
      Math.max(48, width * .076),
      right - contentX,
      palette.primary,
      "left",
      alpha,
      950,
      Math.max(26, width * .034)
    );

    drawLedTextFit(
      aircraftType,
      contentX,
      height * .34,
      Math.max(18, width * .026),
      right - contentX,
      palette.accent,
      "left",
      alpha,
      850,
      Math.max(10, width * .013)
    );

    drawLedTextFit(
      routeDisplay(flight),
      contentX,
      height * .435,
      Math.max(22, width * .032),
      right - contentX,
      flight.routeAvailable === false ? palette.muted : palette.primary,
      "left",
      alpha,
      900,
      Math.max(12, width * .016)
    );

    drawLedTextFit(
      status,
      contentX,
      height * .545,
      Math.max(12, width * .016),
      right - contentX,
      statusColor,
      "left",
      alpha,
      800,
      Math.max(8, width * .009)
    );

    drawLedText(
      `${values.distance} · ${flight.bearing || cardinal(flight.bearingDegrees || 0)}`,
      right,
      height * .565,
      Math.max(11, width * .014),
      palette.muted,
      "right",
      alpha,
      700
    );

    // Minimal live metrics.
    const metricsTop = height * .70;
    drawLedRule(
      pad,
      metricsTop,
      right,
      metricsTop,
      palette.accent,
      alpha * .52,
      1.25
    );

    const metrics = [
      { label: "ALT", value: values.altitude, color: palette.primary },
      { label: "SPD", value: values.speed, color: palette.primary },
      { label: "TRK", value: headingText, color: palette.primary },
      {
        label: "V/R",
        value: verticalText,
        color: verticalRate > 150
          ? "#53e682"
          : verticalRate < -150
            ? "#ffd43b"
            : palette.primary
      }
    ];

    metrics.forEach((metric, index) => {
      const x1 = pad + (right - pad) * index / metrics.length;
      const x2 = pad + (right - pad) * (index + 1) / metrics.length;
      const center = (x1 + x2) / 2;

      if (index > 0) {
        drawLedRule(
          x1,
          metricsTop + height * .035,
          x1,
          height * .91,
          palette.accent,
          alpha * .30,
          1
        );
      }

      drawLedText(
        metric.label,
        center,
        metricsTop + height * .035,
        Math.max(10, width * .011),
        palette.muted,
        "center",
        alpha,
        750
      );

      drawLedTextFit(
        metric.value,
        center,
        metricsTop + height * .115,
        Math.max(18, width * .024),
        (x2 - x1) * .84,
        metric.color,
        "center",
        alpha,
        900,
        Math.max(10, width * .011)
      );
    });

    // Small live-data footer.
    drawLedText(
      `${flight.icao24 || "---"} · DATA ${formatDataAge(flight.lastContact)}`,
      pad,
      height * .955,
      Math.max(7, width * .008),
      dataAgeColor(flight.lastContact, palette),
      "left",
      alpha * .82,
      650
    );

    drawLedText(
      lastLiveSource || lastProvider,
      right,
      height * .955,
      Math.max(7, width * .008),
      palette.muted,
      "right",
      alpha * .72,
      650
    );

    ctx.restore();
  }


  function drawCompact(flight, alpha, slideX, width, height, palette) {
    const pad = Math.max(20, width * .04);
    const right = width - pad;
    const values = unitValues(flight);
    const airline = displayValue(resolvedAirlineName(flight), "AIRCRAFT");
    const number = displayValue(flight.displayFlightNumber || flight.flightNumber || flight.callsign, "UNKNOWN");
    const aircraftType = displayValue(flight.aircraft, "TYPE UNKNOWN");
    const verticalRate = Number(flight.verticalRateFpm || 0);
    const verticalText = `${verticalRate >= 0 ? "+" : ""}${Math.round(verticalRate).toLocaleString()}`;

    ctx.save();
    ctx.translate(slideX, 0);

    drawLedTextFit(
      airline,
      pad,
      height * .08,
      Math.max(14, width * .021),
      width * .52,
      palette.secondary,
      "left",
      alpha,
      750,
      Math.max(9, width * .011)
    );

    drawLedTextFit(
      number,
      pad,
      height * .22,
      Math.max(42, width * .068),
      width * .58,
      palette.primary,
      "left",
      alpha,
      950,
      Math.max(22, width * .032)
    );

    drawLedTextFit(
      aircraftType,
      pad,
      height * .40,
      Math.max(15, width * .022),
      width * .61,
      palette.accent,
      "left",
      alpha,
      850,
      Math.max(9, width * .011)
    );

    drawLedTextFit(
      routeDisplay(flight),
      pad,
      height * .505,
      Math.max(17, width * .025),
      width * .61,
      flight.routeAvailable === false ? palette.muted : palette.primary,
      "left",
      alpha,
      900,
      Math.max(10, width * .012)
    );

    drawAirlineLogoFit(
      flight,
      width * .69,
      height * .10,
      width * .27,
      height * .42,
      alpha
    );

    drawLedRule(pad, height * .60, right, height * .60, palette.accent, alpha * .48, 1);

    const cells = [
      ["ALT", values.altitude],
      ["SPD", values.speed],
      ["TRK", `${Math.round(Number(flight.heading || 0))}°`],
      ["V/R", `${verticalText} FPM`]
    ];

    cells.forEach(([label, value], index) => {
      const x1 = pad + (right - pad) * index / cells.length;
      const x2 = pad + (right - pad) * (index + 1) / cells.length;
      const center = (x1 + x2) / 2;

      if (index) {
        drawLedRule(x1, height * .64, x1, height * .88, palette.accent, alpha * .28, 1);
      }

      drawLedText(label, center, height * .66, Math.max(9, width * .010), palette.muted, "center", alpha, 750);
      drawLedTextFit(
        value,
        center,
        height * .76,
        Math.max(16, width * .021),
        (x2 - x1) * .84,
        palette.primary,
        "center",
        alpha,
        900,
        Math.max(9, width * .010)
      );
    });

    drawLedText(
      `${values.distance} · ${flight.bearing || cardinal(flight.bearingDegrees || 0)} · DATA ${formatDataAge(flight.lastContact)}`,
      pad,
      height * .94,
      Math.max(7, width * .008),
      palette.muted,
      "left",
      alpha * .78,
      650
    );

    ctx.restore();
  }


  function drawRadarTimeline(flight, x1, x2, y, palette, alpha) {
    const timeline = radarTimeline(flight);
    const gap = (x2 - x1) / Math.max(1, timeline.steps.length - 1);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.strokeStyle = palette.muted;
    ctx.globalAlpha = alpha * .32;
    ctx.lineWidth = 2;
    ctx.stroke();

    timeline.steps.forEach((step, index) => {
      const x = x1 + gap * index;
      const complete = index <= timeline.activeIndex;
      const active = index === timeline.activeIndex;
      const color = active ? palette.accent : complete ? palette.secondary : palette.muted;

      ctx.beginPath();
      ctx.arc(x, y, active ? 5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha * (complete ? 1 : .38);
      ctx.fill();

      if (active) {
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.globalAlpha = alpha * .55;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }

      drawLedText(
        step,
        x,
        y + 14,
        Math.max(5.4, (x2 - x1) * .011),
        color,
        "center",
        alpha * (complete ? .9 : .4),
        active ? 800 : 600
      );
    });
    ctx.restore();
  }

  function radarContactPosition(item, centerX, centerY, radius) {
    const maxRange = Math.max(1, Number(settings.radius || 120));
    const distance = Math.min(maxRange, Math.max(0, Number(item.distance || 0)));
    const normalized = distance / maxRange;
    const bearing = (Number(item.bearing || 0) - 90) * Math.PI / 180;
    clampRadarView();
    const scaled = normalized * radarView.zoom;
    return {
      x: centerX + Math.cos(bearing) * radius * scaled + radarView.panX * radius,
      y: centerY + Math.sin(bearing) * radius * scaled + radarView.panY * radius
    };
  }

  function updateRadarHistory(items) {
    const now = Date.now();
    const keep = Math.max(0, Number(settings.trailLength || 0));

    for (const item of items) {
      const key = item.icao24 || item.flightNumber || item.callsign;
      if (!key) continue;
      const history = radarHistory.get(key) || [];
      const last = history[history.length - 1];
      if (!last || now - last.time > 4000) {
        history.push({
          distance: Number(item.distance || 0),
          bearing: Number(item.bearing || 0),
          time: now
        });
      }
      while (history.length > keep + 1) history.shift();
      radarHistory.set(key, history);
    }

    for (const [key, history] of radarHistory.entries()) {
      if (!history.length || now - history[history.length - 1].time > 180000) {
        radarHistory.delete(key);
      }
    }
  }

  function drawRadarTrail(item, centerX, centerY, radius, palette, alpha) {
    if (!settings.trailLength) return;
    const key = item.icao24 || item.flightNumber || item.callsign;
    const history = radarHistory.get(key);
    if (!history || history.length < 2) return;

    const maxRange = Math.max(1, Number(settings.radius || 120));
    ctx.save();
    ctx.strokeStyle = palette.secondary;
    ctx.lineWidth = 1.2;
    ctx.shadowColor = palette.secondary;
    ctx.shadowBlur = 4;
    ctx.beginPath();

    history.forEach((point, index) => {
      const normalized = Math.max(0, point.distance / maxRange) * radarView.zoom;
      const angle = (point.bearing - 90) * Math.PI / 180;
      const x = centerX + Math.cos(angle) * radius * normalized + radarView.panX * radius;
      const y = centerY + Math.sin(angle) * radius * normalized + radarView.panY * radius;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.globalAlpha = alpha * .46;
    ctx.stroke();
    ctx.restore();
  }

  function radarPhaseClass(item) {
    const phase = inferFlightPhase(item);
    if (["DESCENDING", "APPROACHING", "FINAL APPROACH"].includes(phase)) return "ARRIVAL";
    if (["TAKEOFF", "CLIMBING"].includes(phase)) return "DEPARTURE";
    if (["AT GATE", "ON GROUND", "TAXIING"].includes(phase)) return "GROUND";
    return "EN ROUTE";
  }

  function radarPhaseColor(item, palette, selected) {
    if (selected) return palette.accent;
    const phaseClass = radarPhaseClass(item);
    if (phaseClass === "ARRIVAL") return "#ffd43b";
    if (phaseClass === "DEPARTURE") return "#53e682";
    if (phaseClass === "GROUND") return palette.muted;
    return palette.secondary;
  }

  function drawRadarContact(item, centerX, centerY, radius, palette, alpha) {
    const position = radarContactPosition(item, centerX, centerY, radius);
    const selectedFlight = flights[currentIndex];
    const selected = Boolean(
      selectedFlight &&
      (selectedFlight.id || selectedFlight.icao24) === (item.id || item.icao24)
    );
    const contactColor = radarPhaseColor(item, palette, selected);
    const heading = (Number(item.heading || 0) - 90) * Math.PI / 180;
    const size = selected ? 5.2 : 3.8;

    drawRadarTrail(item, centerX, centerY, radius, palette, alpha);

    ctx.save();
    ctx.translate(position.x, position.y);
    ctx.rotate(heading);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = contactColor;
    ctx.shadowColor = contactColor;
    ctx.shadowBlur = selected ? 11 : 7;
    ctx.beginPath();
    ctx.moveTo(size * 1.8, 0);
    ctx.lineTo(-size, size);
    ctx.lineTo(-size * .4, 0);
    ctx.lineTo(-size, -size);
    ctx.closePath();
    ctx.fill();

    if (settings.headingVectors) {
      ctx.strokeStyle = contactColor;
      ctx.lineWidth = selected ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(size * 1.7, 0);
      ctx.lineTo(size * (selected ? 6 : 4.3), 0);
      ctx.stroke();
    }
    ctx.restore();

    if (selected) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(position.x, position.y, 12, 0, Math.PI * 2);
      ctx.strokeStyle = contactColor;
      ctx.globalAlpha = alpha * .72;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = contactColor;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.restore();
    }

    if (settings.radarLabels) {
      drawLedText(
        item.flightNumber || item.callsign || item.icao24 || "AIRCRAFT",
        position.x + 9,
        position.y - 13,
        selected ? 11 : 9,
        contactColor,
        "left",
        alpha * (selected ? 1 : .82),
        selected ? 900 : 700
      );
      drawLedText(
        `${Math.round(Number(item.altitudeFt || 0) / 100) * 100}FT ${radarPhaseClass(item)}`,
        position.x + 9,
        position.y + 1,
        selected ? 8.5 : 7.2,
        selected ? palette.primary : palette.muted,
        "left",
        alpha * (selected ? .92 : .68),
        selected ? 800 : 600
      );
    }

    radarHitTargets.push({
      x: position.x,
      y: position.y,
      radius: selected ? 16 : 12,
      flight: item
    });
  }

  function drawRadar(flight, alpha, slideX, width, height, palette) {
    const pad = Math.max(20, width * .03);
    const centerX = width * .46;
    const centerY = height * .54;
    const radius = Math.min(width * .29, height * .39);
    const radarNow = performance.now();
    const contacts = flights
      .slice(0, Math.max(4, Number(settings.radarContacts || 12)))
      .map(item => interpolatedFlight(item, radarNow));

    radarHitTargets = [];
    updateRadarHistory(contacts);

    ctx.save();
    ctx.translate(slideX, 0);

    drawLedText("RADAR", pad, height*.045, Math.max(16,width*.021), palette.accent, "left", alpha, 900);
    drawLedText(`${contacts.length} CONTACTS`, width-pad, height*.055, Math.max(11,width*.013), palette.muted, "right", alpha, 700);

    ctx.save();
    ctx.globalAlpha = alpha * .58;
    ctx.strokeStyle = palette.secondary;
    ctx.lineWidth = 1;
    ctx.shadowColor = palette.secondary;
    ctx.shadowBlur = 5;

    for (let ring = 1; ring <= 5; ring++) {
      const fraction = ring / 5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * fraction, 0, Math.PI * 2);
      ctx.stroke();

      const ringDistance = Math.round(Number(settings.radius || 120) * fraction / radarView.zoom);
      drawLedText(
        `${ringDistance}${settings.units === "metric" ? "KM" : "MI"}`,
        centerX + 5,
        centerY - radius * fraction + 4,
        Math.max(6.5, width * .0064),
        palette.muted,
        "left",
        alpha * .58,
        600
      );
    }

    for (let spoke = 0; spoke < 8; spoke++) {
      const angle = spoke * Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
      ctx.stroke();
    }

    const sweep = radarSweepAngle;
    const sweepGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    sweepGradient.addColorStop(0, "rgba(78,216,255,.28)");
    sweepGradient.addColorStop(1, "rgba(78,216,255,0)");
    ctx.fillStyle = sweepGradient;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, sweep - .33, sweep);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    contacts.forEach(item => drawRadarContact(item, centerX, centerY, radius, palette, alpha));

    const selected = interpolatedFlight(flights[currentIndex], radarNow) || flight;
    if (selected) {
      const values = unitValues(selected);
      const infoX = width * .80;
      drawLedText("SELECTED AIRCRAFT", infoX, height*.20, Math.max(8,width*.0085), palette.muted, "center", alpha, 700);
      drawLedText(selected.flightNumber || selected.callsign, infoX, height*.28, Math.max(16,width*.019), palette.accent, "center", alpha, 900);
      drawLedText(`${selected.origin} → ${selected.destination}`, infoX, height*.38, Math.max(11,width*.013), palette.primary, "center", alpha, 800);
      drawLedText(values.altitude, infoX, height*.49, Math.max(11,width*.013), palette.primary, "center", alpha, 800);
      drawLedText(values.speed, infoX, height*.59, Math.max(11,width*.013), palette.primary, "center", alpha, 800);
      drawLedText(`${Math.round(Number(selected.heading || 0))}°`, infoX, height*.69, Math.max(11,width*.013), palette.secondary, "center", alpha, 800);
      const selectedPhase = inferFlightPhase(selected);
      drawLedTextFit(
        selectedPhase,
        infoX,
        height*.77,
        Math.max(10,width*.0115),
        width*.25,
        radarPhaseColor(selected, palette, false),
        "center",
        alpha,
        900,
        Math.max(7,width*.0075)
      );
      drawRadarTimeline(
        selected,
        width * .66,
        width * .94,
        height * .835,
        palette,
        alpha
      );
    }

    drawLedText(
      `RANGE ${settings.radius} ${settings.units === "metric" ? "KM" : "MI"}  ZOOM ${radarView.zoom.toFixed(1)}X`,
      pad,
      height*.88,
      Math.max(10,width*.012),
      palette.muted,
      "left",
      alpha,
      700
    );
    drawLedText("ARRIVAL", width*.33, height*.88, Math.max(7,width*.0074), "#ffd43b", "center", alpha, 700);
    drawLedText("DEPARTURE", width*.43, height*.88, Math.max(7,width*.0074), "#53e682", "center", alpha, 700);
    drawLedText("EN ROUTE", width*.54, height*.88, Math.max(7,width*.0074), palette.secondary, "center", alpha, 700);
    drawLedText(
      "WHEEL ZOOM · DRAG PAN · DOUBLE-CLICK RESET",
      width-pad,
      height*.88,
      Math.max(8,width*.0091),
      palette.muted,
      "right",
      alpha,
      700
    );

    ctx.restore();
  }

  const fidsState = {
    departurePage: 0,
    arrivalPage: 0,
    departureChangedAt: performance.now(),
    arrivalChangedAt: performance.now()
  };

  function boardHash(value) {
    let hash = 2166136261;
    for (const character of String(value || "")) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash >>> 0);
  }

  function boardGate(flight) {
    if (flight.gate) return String(flight.gate).toUpperCase();
    const hash = boardHash(flight.icao24 || flight.flightNumber);
    const concourses = ["A", "B", "C", "D", "E", "F"];
    return `${concourses[hash % concourses.length]}${1 + (hash % 29)}`;
  }

  function boardTimeDate(flight, arrival = false) {
    const direct = arrival
      ? flight.estimatedArrival || flight.scheduledArrival || flight.arrivalTime
      : flight.estimatedDeparture || flight.scheduledDeparture || flight.departureTime;
    if (direct) {
      const stamp = normalizedTimestamp(direct);
      if (stamp) return new Date(stamp);
      const parsed = new Date(direct);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    const hash = boardHash(flight.flightNumber || flight.callsign);
    const offsetMinutes = arrival ? 10 + (hash % 95) : 15 + (hash % 120);
    return new Date(Date.now() + offsetMinutes * 60000);
  }

  function boardTime(flight, arrival = false) {
    return boardTimeDate(flight, arrival).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toUpperCase();
  }

  function boardStatus(flight, arrival = false) {
    return operationalStatus(flight, arrival);
  }

  function boardStatusColor(status, palette) {
    const value = String(status || "").toUpperCase();
    if (value.includes("CANCEL") || value.includes("DIVERT")) return "#ff4f5f";
    if (value.includes("DELAY") || value.includes("HOLD") || value.includes("GATE CLOSED")) return "#ffd43b";
    if (value.includes("BOARD") || value.includes("FINAL CALL") || value.includes("LAND") || value.includes("ARRIVED") || value.includes("AT GATE")) return "#53e682";
    return palette.secondary;
  }

  function boardStatusPriority(status) {
    const value = String(status || "").toUpperCase();
    if (value.includes("FINAL CALL")) return 0;
    if (value.includes("BOARD")) return 1;
    if (value.includes("GATE CLOSED")) return 2;
    if (value.includes("DELAY")) return 3;
    if (value.includes("CANCEL")) return 4;
    if (value.includes("DIVERT")) return 5;
    if (value.includes("LAND") || value.includes("ARRIVED")) return 6;
    return 10;
  }

  function boardRows(arrival) {
    const filter = String(settings.fidsAirlineFilter || "").trim().toUpperCase();
    const rows = flights.map((item, index) => ({
      item,
      index,
      airline: String(item.airline || airlinePrefixes[String(item.callsign || "").slice(0,3)] || "AIRLINE").toUpperCase(),
      flight: String(item.flightNumber || item.callsign || "---").toUpperCase(),
      city: String(arrival ? item.origin : item.destination || "---").toUpperCase(),
      gate: boardGate(item),
      timeDate: boardTimeDate(item, arrival),
      time: boardTime(item, arrival),
      status: boardStatus(item, arrival),
      aircraft: String(item.aircraft || "---").toUpperCase()
    })).filter(row => !filter || `${row.airline} ${row.flight}`.includes(filter));

    const sort = settings.fidsSort || "time";
    rows.sort((left, right) => {
      if (sort === "airline") return left.airline.localeCompare(right.airline) || left.timeDate - right.timeDate;
      if (sort === "gate") return left.gate.localeCompare(right.gate) || left.timeDate - right.timeDate;
      if (sort === "status") return boardStatusPriority(left.status) - boardStatusPriority(right.status) || left.timeDate - right.timeDate;
      return left.timeDate - right.timeDate;
    });
    return rows;
  }

  function boardMetrics(width, height) {
    const header = Math.max(105, height * .18);
    const footer = Math.max(34, height * .05);
    const rowHeight = Math.max(28, Math.min(49, height * .052));
    const rowsPerPage = Math.max(5, Math.floor((height - header - footer) / rowHeight) - 1);
    return { header, footer, rowHeight, rowsPerPage };
  }

  function boardPage(arrival, pageCount) {
    const key = arrival ? "arrivalPage" : "departurePage";
    const changedKey = arrival ? "arrivalChangedAt" : "departureChangedAt";
    if (pageCount <= 1) {
      fidsState[key] = 0;
      return 0;
    }
    const now = performance.now();
    const delay = Math.max(6, Number(settings.fidsPageSeconds || 10)) * 1000;
    if (now - fidsState[changedKey] >= delay) {
      fidsState[key] = (fidsState[key] + 1) % pageCount;
      fidsState[changedKey] = now;
    }
    if (fidsState[key] >= pageCount) fidsState[key] = 0;
    return fidsState[key];
  }

  function drawFidsBoard(arrival, alpha, slideX, width, height, palette) {
    radarHitTargets = [];
    const pad = Math.max(20, width * .028);
    const rows = boardRows(arrival);
    const metrics = boardMetrics(width, height);
    const pageCount = Math.max(1, Math.ceil(rows.length / metrics.rowsPerPage));
    const page = boardPage(arrival, pageCount);
    const visible = rows.slice(page * metrics.rowsPerPage, (page + 1) * metrics.rowsPerPage);
    const showAircraft = Boolean(settings.fidsShowAircraft);

    const columns = showAircraft
      ? { time:pad, flight:width*.15, airline:width*.28, city:width*.42, gate:width*.68, aircraft:width*.76, status:width-pad }
      : { time:pad, flight:width*.16, airline:width*.31, city:width*.47, gate:width*.75, status:width-pad };

    ctx.save();
    ctx.translate(slideX, 0);

    drawLedText(arrival ? "ARRIVALS" : "DEPARTURES", pad, height*.035, Math.max(15,width*.019), palette.accent, "left", alpha, 900);
    drawLedText(`${rows.length} ACTIVE FLIGHTS`, pad, height*.095, Math.max(8,width*.009), palette.muted, "left", alpha, 700);
    drawLedText(new Date().toLocaleTimeString([], {hour:"numeric",minute:"2-digit",second:"2-digit"}).toUpperCase(), width-pad, height*.04, Math.max(13,width*.016), palette.primary, "right", alpha, 900);
    drawLedText(`PAGE ${page+1} OF ${pageCount}`, width-pad, height*.095, Math.max(8,width*.009), palette.muted, "right", alpha, 700);
    drawLedRule(pad,height*.13,width-pad,height*.13,palette.secondary,alpha*.45,1.5);

    const headerY = metrics.header;
    const headerSize = Math.max(7,width*.008);
    drawLedText("TIME",columns.time,headerY,headerSize,palette.muted,"left",alpha,800);
    drawLedText("FLIGHT",columns.flight,headerY,headerSize,palette.muted,"left",alpha,800);
    drawLedText("AIRLINE",columns.airline,headerY,headerSize,palette.muted,"left",alpha,800);
    drawLedText(arrival?"FROM":"TO",columns.city,headerY,headerSize,palette.muted,"left",alpha,800);
    drawLedText("GATE",columns.gate,headerY,headerSize,palette.muted,"left",alpha,800);
    if (showAircraft) drawLedText("AIRCRAFT",columns.aircraft,headerY,headerSize,palette.muted,"left",alpha,800);
    drawLedText("STATUS",columns.status,headerY,headerSize,palette.muted,"right",alpha,800);

    visible.forEach((row, rowIndex) => {
      const y = headerY + metrics.rowHeight * (rowIndex + 1.15);
      const mainSize = Math.max(9, Math.min(17, metrics.rowHeight*.39));
      const smallSize = Math.max(6.5, mainSize*.72);
      if (rowIndex % 2) {
        ctx.save(); ctx.globalAlpha=alpha*.04; ctx.fillStyle=palette.secondary;
        ctx.fillRect(pad-5,y-metrics.rowHeight*.5,width-pad*2+10,metrics.rowHeight*.86); ctx.restore();
      }
      drawLedRule(pad,y+metrics.rowHeight*.36,width-pad,y+metrics.rowHeight*.36,palette.muted,alpha*.12,1);
      drawLedTextFit(row.time,columns.time,y,mainSize,width*.105,palette.primary,"left",alpha,850,smallSize);
      drawLedTextFit(row.flight,columns.flight,y,mainSize,width*.12,palette.accent,"left",alpha,900,smallSize);
      drawLedTextFit(row.airline,columns.airline,y,smallSize,width*.13,palette.secondary,"left",alpha,700,5.5);
      drawLedTextFit(row.city,columns.city,y,mainSize,width*(showAircraft?.22:.25),palette.primary,"left",alpha,850,smallSize);
      drawLedTextFit(row.gate,columns.gate,y,mainSize,width*.07,palette.primary,"left",alpha,900,smallSize);
      if (showAircraft) drawLedTextFit(row.aircraft,columns.aircraft,y,smallSize,width*.12,palette.muted,"left",alpha*.9,650,5.5);
      drawLedTextFit(row.status,columns.status,y,mainSize,width*.16,boardStatusColor(row.status,palette),"right",alpha,900,smallSize);
      radarHitTargets.push({flight:row.item,x:pad,y:y-metrics.rowHeight*.5,width:width-pad*2,height:metrics.rowHeight});
    });

    if (!visible.length) {
      drawLedText("NO MATCHING FLIGHTS",width*.5,height*.5,Math.max(14,width*.019),palette.muted,"center",alpha,850);
    }
    drawLedRule(pad,height-metrics.footer,width-pad,height-metrics.footer,palette.secondary,alpha*.25,1);
    drawLedText("SELECT A ROW FOR FLIGHT DETAILS",width-pad,height-metrics.footer*.38,headerSize,palette.muted,"right",alpha*.8,650);
    ctx.restore();
  }

  function drawDeparture(flight, alpha, slideX, width, height, palette) {
    drawFidsBoard(false, alpha, slideX, width, height, palette);
  }

  function drawArrival(flight, alpha, slideX, width, height, palette) {
    drawFidsBoard(true, alpha, slideX, width, height, palette);
  }

  function render(now) {
    radarSweepAngle = (now / 1400) % (Math.PI * 2);
    const width = elements.displayBezel.clientWidth;
    const height = elements.displayBezel.clientHeight;
    const palette = themes[settings.theme] || themes.cyan;
    ctx.clearRect(0,0,width,height);

    const gradient=ctx.createLinearGradient(0,0,0,height);
    gradient.addColorStop(0,"#050909"); gradient.addColorStop(1,"#010202");
    ctx.fillStyle=gradient; ctx.fillRect(0,0,width,height);
    drawDotGrid(width,height,palette);

    const flight=interpolatedFlight(flights[currentIndex], now);
    if (!flight) {
      drawLedText("NO AIRCRAFT",width/2,height*.42,Math.max(24,width*.045),palette.muted,"center",1,900);
      requestAnimationFrame(render);
      return;
    }

    const renderer=settings.layout==="compact"?drawCompact:settings.layout==="radar"?drawRadar:settings.layout==="departure"?drawDeparture:settings.layout==="arrival"?drawArrival:drawClassic;
    const elapsed=Math.min(1,(now-transitionStarted)/500);
    const ease=1-Math.pow(1-elapsed,3);
    const slide=width*.07;

    try {
      if(elapsed<1 && previousIndex!==currentIndex && flights[previousIndex]){
        renderer(interpolatedFlight(flights[previousIndex], now),1-ease,-slide*ease,width,height,palette);
        renderer(flight,ease,slide*(1-ease),width,height,palette);
      } else {
        renderer(flight,1,0,width,height,palette);
      }
    } catch (error) {
      console.error("FlightWall renderer error:", error, flight);
      drawLedText(
        displayValue(flight.flightNumber || flight.callsign, "LIVE AIRCRAFT"),
        width / 2,
        height * .37,
        Math.max(24, width * .045),
        palette.primary,
        "center",
        1,
        900
      );
      drawLedText(
        "DISPLAY DATA ERROR",
        width / 2,
        height * .55,
        Math.max(12, width * .018),
        palette.secondary,
        "center",
        1,
        750
      );
    }
    requestAnimationFrame(render);
  }

  elements.previousButton.addEventListener("click", () => selectFlight(currentIndex - 1, true));
  elements.nextButton.addEventListener("click", () => selectFlight(currentIndex + 1, true));
  elements.pauseButton.addEventListener("click", () => {
    paused = !paused;
    elements.pauseButton.textContent = paused ? "Resume rotation" : "Pause rotation";
    scheduleRotation();
  });

  elements.fullscreenButton.addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      document.body.classList.toggle("fullscreen-mode");
      resizeCanvas();
    }
  });

  document.addEventListener("fullscreenchange", () => {
    document.body.classList.toggle("fullscreen-mode", Boolean(document.fullscreenElement));
    elements.fullscreenButton.textContent = document.fullscreenElement ? "Exit fullscreen" : "Fullscreen";
    setTimeout(resizeCanvas,50);
  });

  elements.refreshButton.addEventListener("click", () => fetchFlights({ bypassCache:true }));
  elements.weatherRefreshButton.addEventListener("click", fetchWeather);
  elements.searchInput.addEventListener("input", renderFlightList);
  elements.favoritesOnlyButton.addEventListener("click", () => {
    favoritesOnly = !favoritesOnly;
    elements.favoritesOnlyButton.textContent = favoritesOnly ? "Favorites" : "All";
    renderFlightList();
  });

  [elements.layoutSelect,elements.themeSelect,elements.unitsSelect,elements.rotationSelect,
   elements.brightnessRange,elements.autoBrightnessInput,elements.dotRange,elements.radarContactsRange,elements.trailLengthRange,elements.headingVectorsInput,elements.radarLabelsInput].forEach(control => {
    control.addEventListener("input", applyDisplaySettings);
  });

  elements.fidsPageSecondsSelect.addEventListener("change", () => {
    settings.fidsPageSeconds = Number(elements.fidsPageSecondsSelect.value);
    fidsState.departureChangedAt = performance.now();
    fidsState.arrivalChangedAt = performance.now();
    saveSettings();
  });

  elements.fidsSortSelect.addEventListener("change", () => {
    settings.fidsSort = elements.fidsSortSelect.value;
    fidsState.departurePage = 0;
    fidsState.arrivalPage = 0;
    saveSettings();
  });

  elements.fidsAirlineFilterInput.addEventListener("input", () => {
    settings.fidsAirlineFilter = elements.fidsAirlineFilterInput.value.toUpperCase();
    fidsState.departurePage = 0;
    fidsState.arrivalPage = 0;
    saveSettings();
  });

  elements.fidsShowAircraftInput.addEventListener("change", () => {
    settings.fidsShowAircraft = elements.fidsShowAircraftInput.checked;
    saveSettings();
  });

  elements.applyTrackingButton.addEventListener("click", async () => {
    const zip = String(elements.zipCodeInput.value || "").trim();
    if (zip) {
      const applied = await applyZipCode({ refresh:false });
      if (!applied) return;
    }
    readTrackingSettings();
    fetchFlights({ bypassCache:true });
    fetchWeather();
  });

  elements.zipCodeButton.addEventListener("click", () => { applyZipCode(); });
  elements.zipCodeInput.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    applyZipCode();
  });
  elements.zipCodeInput.addEventListener("input", () => {
    setZipCodeStatus("Enter a U.S. ZIP code to set latitude and longitude.");
  });

  elements.locationButton.addEventListener("click", () => {
    if (!navigator.geolocation) {
      setProvider("ERROR", "This browser does not provide geolocation.");
      return;
    }
    navigator.geolocation.getCurrentPosition(position => {
      elements.zipCodeInput.value = "";
      setZipCodeStatus("Using this device location.", "success");
      elements.latitudeInput.value = position.coords.latitude.toFixed(5);
      elements.longitudeInput.value = position.coords.longitude.toFixed(5);
      readTrackingSettings();
      fetchFlights({ bypassCache:true });
      fetchWeather();
    }, error => {
      setProvider("ERROR", `Location unavailable: ${error.message}`);
    }, { enableHighAccuracy:false, timeout:10000, maximumAge:300000 });
  });

  async function toggleWakeLock() {
    if (!("wakeLock" in navigator)) {
      setProvider("ERROR", "Screen wake lock is not supported by this browser.");
      return;
    }
    try {
      if (wakeLock) {
        await wakeLock.release();
        wakeLock = null;
      } else {
        wakeLock = await navigator.wakeLock.request("screen");
        wakeLock.addEventListener("release", () => {
          wakeLock = null;
          elements.wakeLockButton.classList.remove("active");
          elements.wakeLockButton.textContent = "Keep screen awake";
        });
      }
      elements.wakeLockButton.classList.toggle("active", Boolean(wakeLock));
      elements.wakeLockButton.textContent = wakeLock ? "Screen awake" : "Keep screen awake";
    } catch (error) {
      setProvider("ERROR", `Wake lock unavailable: ${error.message}`);
    }
  }

  elements.wakeLockButton.addEventListener("click", toggleWakeLock);

  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible" && elements.wakeLockButton.classList.contains("active") && !wakeLock) {
      try {
        wakeLock = await navigator.wakeLock.request("screen");
      } catch {}
    }
  });

  elements.ledCanvas.addEventListener("wheel", event => {
    if (settings.layout !== "radar") return;
    event.preventDefault();

    const rect = elements.ledCanvas.getBoundingClientRect();
    const pointerX = (event.clientX - rect.left) / rect.width;
    const pointerY = (event.clientY - rect.top) / rect.height;
    const oldZoom = radarView.zoom;
    radarView.zoom *= event.deltaY < 0 ? 1.18 : 1 / 1.18;
    clampRadarView();

    if (radarView.zoom !== oldZoom) {
      const ratio = radarView.zoom / oldZoom;
      radarView.panX = (radarView.panX - (pointerX - .5)) * ratio + (pointerX - .5);
      radarView.panY = (radarView.panY - (pointerY - .5)) * ratio + (pointerY - .5);
      clampRadarView();
    }
  }, { passive:false });

  elements.ledCanvas.addEventListener("pointerdown", event => {
    if (settings.layout !== "radar") return;
    radarView.dragging = true;
    radarView.moved = false;
    radarView.dragStartX = event.clientX;
    radarView.dragStartY = event.clientY;
    radarView.panStartX = radarView.panX;
    radarView.panStartY = radarView.panY;
    elements.ledCanvas.setPointerCapture?.(event.pointerId);
  });

  elements.ledCanvas.addEventListener("pointermove", event => {
    if (settings.layout !== "radar" || !radarView.dragging) return;
    const rect = elements.ledCanvas.getBoundingClientRect();
    const dx = event.clientX - radarView.dragStartX;
    const dy = event.clientY - radarView.dragStartY;
    if (Math.hypot(dx, dy) > 5) radarView.moved = true;
    radarView.panX = radarView.panStartX + dx / rect.width;
    radarView.panY = radarView.panStartY + dy / rect.height;
    clampRadarView();
  });

  function endRadarPointer(event) {
    if (!radarView.dragging) return;
    radarView.dragging = false;
    elements.ledCanvas.releasePointerCapture?.(event.pointerId);
  }

  elements.ledCanvas.addEventListener("pointerup", endRadarPointer);
  elements.ledCanvas.addEventListener("pointercancel", endRadarPointer);
  elements.ledCanvas.addEventListener("dblclick", () => {
    if (settings.layout === "radar") resetRadarView();
  });

  elements.ledCanvas.addEventListener("click", event => {
    if (!["radar", "departure", "arrival"].includes(settings.layout) || !radarHitTargets.length) return;
    if (radarView.moved) {
      radarView.moved = false;
      return;
    }

    const rect = elements.ledCanvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * elements.displayBezel.clientWidth / rect.width;
    const y = (event.clientY - rect.top) * elements.displayBezel.clientHeight / rect.height;

    const target = radarHitTargets
      .map(hit => {
        const rectangular = Number.isFinite(hit.width) && Number.isFinite(hit.height);
        const inside = rectangular && x >= hit.x && x <= hit.x + hit.width && y >= hit.y && y <= hit.y + hit.height;
        const distance = rectangular ? (inside ? 0 : Infinity) : Math.hypot(hit.x - x, hit.y - y);
        return { hit, distance };
      })
      .filter(result => result.distance <= (result.hit.radius || 0) || result.distance === 0)
      .sort((a, b) => a.distance - b.distance)[0];

    if (!target) return;
    const index = flights.indexOf(target.hit.flight);
    if (index >= 0) selectFlight(index, true);
  });

  elements.layoutSelect.addEventListener("change", () => {
    elements.ledCanvas.classList.toggle("radar-interactive", elements.layoutSelect.value === "radar");
  });

  document.addEventListener("keydown", event => {
    if (event.target.matches("input, select, textarea")) return;
    if (event.key === "ArrowLeft") selectFlight(currentIndex - 1, true);
    if (event.key === "ArrowRight") selectFlight(currentIndex + 1, true);
    if (event.key === " ") {
      event.preventDefault();
      elements.pauseButton.click();
    }
    if (event.key.toLowerCase() === "f") elements.fullscreenButton.click();
    if (event.key.toLowerCase() === "r") fetchFlights({ bypassCache:true });
  });

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch(() => {});
    });
  }

  function startWeatherRefresh() {
    clearInterval(weatherTimer);
    const minutes = Math.max(5, Number(CONFIG.WEATHER_REFRESH_MINUTES || 15));
    weatherTimer = setInterval(fetchWeather, minutes * 60 * 1000);
  }

  function startClock() {
    updateClock();
    clearInterval(clockTimer);
    clockTimer = setInterval(updateClock, 1000);
  }

  function autoLocateOnStartup() {
    if (!settings.autoLocate || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(position => {
      settings.latitude = Number(position.coords.latitude.toFixed(5));
      settings.longitude = Number(position.coords.longitude.toFixed(5));
      saveSettings();
      populateControls();
      fetchFlights({ bypassCache: true });
      fetchWeather();
    }, () => {}, { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 });
  }

  window.addEventListener("resize", resizeCanvas);

  populateControls();
  elements.ledCanvas.classList.toggle("radar-interactive", settings.layout === "radar");
  resizeCanvas();
  scheduleRotation();
  scheduleRefresh();
  startWeatherRefresh();
  startClock();
  fetchFlights();
  fetchWeather();
  autoLocateOnStartup();
  requestAnimationFrame(render);
})();
