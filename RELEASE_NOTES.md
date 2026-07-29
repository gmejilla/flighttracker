## v3.3.0 — Aviation Airport Data Update

- Replaced generic Open-Meteo airport weather with AviationWeather.gov METAR and TAF data.
- Added VFR/MVFR/IFR/LIFR flight category, ceiling, visibility, wind, dew point, altimeter and raw METAR support.
- Replaced the three-airport compact database with a bundled OurAirports dataset covering scheduled-service, medium and large airports worldwide.
- Added runway, elevation, city, country and coordinate metadata to `/airport`.
- Weather requests remain proxied and cached through the Cloudflare Worker.
- Airport Operations Mode remains excluded.

# FlightWall v3.1.0 — Production API Architecture

- Routes all browser data traffic through the Cloudflare Worker.
- Adds `/flights` with ADSB.fi → Airplanes.live → ADSB.lol failover.
- Adds AirLabs → ADSBDB route enrichment with provider diagnostics.
- Adds cached `/weather` proxy and compact `/airport` endpoint.
- Adds edge caching, timeout handling, CORS, structured provider metadata, and per-IP rate limiting.
- Updates the frontend configuration and service-worker cache version.

# v3.0.5 Release Notes

- Added geometric validation for callsign-based origin and destination routes.
- Routes that conflict with the aircraft current position or direction now show as unavailable instead of displaying stale airport codes.
- Reduced route cache time from six hours to 15 minutes.
- Route lookups now bypass the browser HTTP cache.

# v3.0.3 Release Notes

- Added U.S. ZIP-code tracking under Tracking Settings.
- ZIP lookup fills latitude and longitude through the Zippopotam.us API.
- ZIP codes can be applied with Enter, **Use ZIP code**, or **Apply settings**.
- Device geolocation clears the ZIP field so exact coordinates take precedence.
- Updated the web label, storage key, and service-worker cache to v3.0.3.

# v3.0.0 Release Notes

- Fixed `CDN_ROOT is not defined`, which caused the DISPLAY DATA ERROR.
- Restored local-first and verified remote-fallback logo paths.
- Isolated logo rendering errors so a failed logo can no longer stop flight-data rendering.
- Updated the service-worker cache to force replacement of v3.0.0.

# v3.0.0 Release Notes

- Fixed missing Southwest and other airline symbols after the relative-path change.
- The logo loader now checks `./logos/<airline-slug>/icon.svg` first.
- When a bundled file is absent, it falls back to the verified Soaring Symbols asset URL.
- Updated the service-worker cache to force browsers to discard v3.0.0.

# v3.0.0 Release Notes

- Replaced generated placeholder symbols with authentic airline icon artwork from Soaring Symbols where available.
- Corrected the repository asset URL to the verified `refs/heads/main/assets/{slug}/icon.svg` structure.
- Retained immediate canvas fallback for airlines not included in the upstream catalog or when offline.
- Updated service-worker cache version so GitHub Pages installs the corrected files.
- Added trademark and upstream attribution notes.

## v3.2.0 — Flight Details Dashboard

- Replaced the compact selected-aircraft strip with a full flight dashboard.
- Added route overview and animated estimated route progress.
- Added live telemetry panels for altitude, speed, heading, and vertical rate.
- Added an adaptive flight-phase timeline.
- Added origin and destination weather summaries.
- Added aircraft, position, data-source, and update information panels.
- Added responsive layouts for desktop, tablet, and mobile.
- Airport Operations Mode remains deferred.
