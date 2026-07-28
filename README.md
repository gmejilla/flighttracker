# FlightWall v3.0.0 — Local Airline Logo Pack

This build contains 959 local PNG airline logos under `logos/`, keyed by ICAO code. It does not fetch airline logos from an external service.

Open `logo-gallery.html` to review the installed library. `logo-runtime-test.html` is included as an on-device diagnostic page.

# FLIGHT TRACKER — v3.0.0

## Airline logo display repair

The SVG resolver now uses the source project's documented repository path:
`assets/<airline-slug>/icon.svg`, with `logo.svg` as the second choice.

A local canvas fallback is drawn immediately while the external SVG loads and remains visible when a carrier has no matching SVG. This prevents the airline-logo area from appearing blank because of network latency, unavailable artwork, browser restrictions, or an unmatched live callsign.

# FLIGHT TRACKER — v3.0.0

## Authentic SVG airline library

FlightWall now resolves live callsigns against a curated library of **97 active airlines and regional operators**. Matching assets are loaded as SVGs from the pinned Soaring Symbols 1.10.1 package rather than approximated LED-dot recreations.

Open `logo-gallery.html` to inspect and filter every mapped carrier by airline name, IATA code, or ICAO code.

The resolver checks explicit IATA/ICAO operator metadata first, then the three-letter ICAO callsign prefix, then the two-letter IATA prefix, and finally the airline name. If no verified asset exists, FlightWall retains its text/callsign fallback.

# FLIGHT TRACKER — v3.0.0

## Successful connection but blank-board repair

A live-only rendering regression has been corrected. Public ADS-B records often arrive without a populated airline name. The minimal Classic and Compact layouts attempted to resolve that empty value through a helper that did not exist, causing the canvas animation loop to terminate immediately after the first successful live response.

v3.0.0 adds a safe airline/operator resolver, sends all public records through the application's canonical normalization model, clamps the selected aircraft index, and protects the animation loop from terminating if an individual record contains unexpected data.

# FLIGHT TRACKER — v3.0.0

## Live data fetch repair

The browser now tries three public ADS-B providers in sequence:

1. ADSB.fi
2. Airplanes.live
3. ADSB.lol

If one provider is blocked by CORS, unavailable, rate-limited, or returns no aircraft, FlightWall automatically tries the next provider. A configured Cloudflare Worker remains the final live-data fallback in `AUTO` mode.

The generic `Failed to fetch` message has been replaced by provider-specific diagnostics. This makes it clear whether a request timed out, was blocked by the browser, returned a server error, or returned no aircraft for the selected area.

For the most reliable production deployment, configure `API_BASE_URL` to your deployed Cloudflare Worker. Static GitHub Pages cannot guarantee access to third-party APIs because those providers control browser CORS policy.

# FLIGHT TRACKER — v3.0.0

## Origin and destination routes

The Classic and Compact displays now show a prominent route such as:

```text
PHL → MCO
```

Routes are enriched from the live callsign using the optional ADSBDB route service. Route results are cached in memory to reduce repeated API requests.

Because origin and destination are not transmitted in ordinary ADS-B position messages, route resolution is best-effort. Private, military, general-aviation, repositioning, malformed, or unmatched callsigns may display:

```text
ROUTE UNAVAILABLE
```

No route is invented when the lookup cannot be verified.

# FLIGHT TRACKER — v3.0.0

## Minimal live layout

The primary Classic and Compact displays have been redesigned around the most useful real ADS-B fields:

- Airline or operator
- Callsign / flight number
- Aircraft type
- Altitude
- Ground speed
- Track heading
- Vertical rate
- Distance and bearing
- Data age

Weather, schedule, gate, boarding, arrival-estimate, and large secondary information blocks were removed from the primary display to improve hierarchy and readability.

The design is inspired by the restrained, metric-focused approach used by modern physical LED aircraft trackers, while retaining FlightWall's existing renderer, themes, airline marks, and live-data pipeline.

# FLIGHT TRACKER — v3.0.0

## Live aircraft data

The site now uses **ADSB.lol directly by default**. A Cloudflare Worker is no longer required for basic live nearby-aircraft tracking.

Default configuration:

```js
LIVE_DATA_MODE: "AUTO",
ADSBLOL_API_URL: "https://api.adsb.lol",
API_BASE_URL: ""
```

`AUTO` tries ADSB.lol first. If a Worker URL is configured, it is used as a fallback.

Available modes:

- `AUTO`
- `ADSBLOL`
- `WORKER`
- `DEMO`

The browser must be online and the public provider must be reachable. If no aircraft are returned or the provider is unavailable, FlightWall falls back to the built-in demo aircraft.

## Data limitations

Live ADS-B data supplies aircraft position, altitude, speed, heading, vertical rate, callsign, squawk, and sometimes aircraft type or registration/operator information.

It does not reliably provide scheduled origin, destination, gate, terminal, boarding status, or airline timetable data. Those fields remain unavailable unless a separate commercial flight-enrichment provider is added.

# FLIGHT TRACKER — GitHub Pages Edition v1.6.1

This package contains:

- A static GitHub Pages website
- Built-in demo aircraft data
- A configurable live-data API URL
- A true 5×7 bitmap LED font renderer
- A four-row departure-board layout
- Airline-sensitive display accents
- Installable Progressive Web App support
- Offline application shell caching
- Automatic night brightness
- Screen wake lock and keyboard controls
- Animated radar sweep
- Live local weather through Open-Meteo
- Sunrise/sunset-aware automatic brightness
- Optional startup geolocation
- Local airport-style clock
- A Cloudflare Worker that proxies OpenSky position data
- No .NET runtime
- No local server requirement for the published website

## 1. Test the static website

Open `index.html` directly in a browser. It will run in **DEMO** mode.

Some browser privacy settings may limit geolocation when a page is opened as a local file. Geolocation will work after the site is published through HTTPS on GitHub Pages.

## 2. Publish the website on GitHub Pages

1. Create a new GitHub repository.
2. Upload these files to the repository root:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `config.js`
   - `.nojekyll`
3. Commit the files to the `main` branch.
4. Open the repository's **Settings**.
5. Select **Pages**.
6. Under **Build and deployment**, choose **Deploy from a branch**.
7. Choose the `main` branch and `/ (root)`.
8. Save.

The address will normally be:

`https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`

All website asset paths are relative, so repository-subdirectory hosting is supported.

## 3. Demo-only deployment

Nothing else is required.

Leave this line blank in `config.js`:

```js
API_BASE_URL: ""
```

The display will use the built-in sample aircraft.

## 4. Deploy the live-data Cloudflare Worker

The files in `worker/` are not uploaded to GitHub Pages as part of the website. They are deployed separately to Cloudflare Workers.

### Dashboard method

1. Create or sign in to a Cloudflare account.
2. Open **Workers & Pages**.
3. Create a Worker.
4. Replace its starter code with the contents of `worker/worker.js`.
5. Deploy it.
6. Under the Worker's settings, add:
   - Variable `ALLOWED_ORIGIN`
   - Value `https://YOUR-USERNAME.github.io`
7. Optional OpenSky authentication secrets:
   - `OPENSKY_CLIENT_ID`
   - `OPENSKY_CLIENT_SECRET`
8. Copy the deployed Worker URL.

Anonymous OpenSky requests are supported by the Worker, but authenticated access may have better request limits.

### Wrangler method

Wrangler requires Node.js and is optional. It is only needed when deploying the Worker from a terminal.

```bash
cd worker
npx wrangler deploy
```

Add secrets:

```bash
npx wrangler secret put OPENSKY_CLIENT_ID
npx wrangler secret put OPENSKY_CLIENT_SECRET
```

## 5. Connect the GitHub Pages website to the Worker

Edit `config.js`:

```js
API_BASE_URL: "https://flightwall-api.YOUR-SUBDOMAIN.workers.dev"
```

Commit and push the change.

The website will begin requesting:

```text
GET /flights?lat=39.9348&lon=-75.0307&radius=35&max=16
```

When the Worker is available, the website status shows `LIVE`. If the request fails, the site automatically uses demo data and displays an error notice.

## 6. OpenSky data limitations

OpenSky state vectors provide live aircraft telemetry such as:

- Callsign
- Position
- Altitude
- Ground speed
- Heading
- Vertical rate
- Squawk
- Registration country
- On-ground status

They do not reliably include:

- Origin airport
- Destination airport
- Gate
- Schedule
- Delay
- Aircraft model

Those fields display placeholders for live OpenSky aircraft. A later flight-enrichment provider can populate them.

## 7. Custom domain

GitHub Pages supports custom domains. When using one, update:

- The Worker variable `ALLOWED_ORIGIN`
- Any domain restrictions you add later
- The GitHub Pages custom-domain configuration

## Security

Never put OpenSky client secrets or paid flight-provider API keys in `config.js`, `app.js`, or any GitHub Pages file. GitHub Pages files are public. Store secrets only in the Cloudflare Worker configuration.


## Dot-matrix airline marks
Built-in LED-dot logo marks are matched by airline code, flight-number prefix, or airline name. Unknown airlines use the existing text fallback.


## v1.6.1 logo refinement

The built-in dot-matrix airline marks were redrawn to more closely match the compact physical LED-board proportions shown in the supplied reference image.


## v1.0 airport boards

Version 1.0 introduces separate Departures and Arrivals layouts with airline marks, route fields, estimated times, gates, color-coded status labels, and staggered row-change motion.


## v1.1 interactive radar
Radar mode now displays multiple aircraft contacts, heading vectors, configurable trails, labels, range rings, compass spokes, and click-to-select interaction.


## v1.6.1 flight-state orientation

The large aircraft graphic now uses a side-profile orientation driven by vertical rate:

- Climbing aircraft pitch nose-up
- Level aircraft remain horizontal
- Descending aircraft pitch nose-down

Radar contacts continue to use true compass heading.


## v1.6.1 recognizable aircraft silhouette

The flight-state aircraft was redrawn as a recognizable side-view passenger jet with a distinct nose, fuselage, wings, tail, cockpit, and engines.


## v1.6.1 wing-direction correction

The main wings now sweep backward toward the tail, matching the right-facing nose and cockpit.


## v1.6.1 aircraft placement refinement

The aircraft graphic now appears directly to the left of the adjacent flight information and is vertically aligned with that text group. The wings were also moved slightly forward toward the center of the fuselage.


## v1.6.1 LED aircraft sprite

The aircraft is now rendered entirely as illuminated LED dots instead of smooth vector paths. Separate level, climbing, and descending sprites preserve the flight-state orientation.


## v1.6.1 aircraft removal

The large aircraft graphic has been removed from all display layouts. Flight data remains aligned without the illustration.


## v1.6.1 selected-flight showcase

The primary board now follows a large-format airport display layout. The airline mark fills roughly the left third, while the right side presents the airline, flight number, status, route, and city names. Departure, gate, boarding, and status information are arranged in a structured bottom row.


## v1.6.1 telemetry and weather restoration

The large-logo showcase now retains live aircraft telemetry and local weather. Altitude, velocity, heading, vertical speed, and distance appear in a dedicated telemetry strip. Temperature, conditions, wind, and visibility appear beneath the airline mark.


## v1.6.1 full upper-left logo zone

The airline mark now occupies the entire upper-left region. Weather and telemetry are consolidated into the right-side information column, while the bottom schedule strip remains full width.


## v1.6.1 full-zone logo scaling

Airline marks now scale against both the available width and height of the complete upper-left panel. Each logo is centered and enlarged to the maximum size that preserves its aspect ratio.


## v1.6.1 runtime repair

Removed the unsafe logo-library measurement helper that caused the board to stop rendering. The upper-left logo now uses the existing stable renderer at a much larger height and is centered within the available panel.


## v1.6.1 logo boundary correction

Large airline marks are now width-limited to the left panel and rendered inside a hard canvas clipping region. Logos remain as large as possible while no longer crossing the vertical divider.


## v1.6.1 native logo fitting

The airline-logo renderer now provides real measurement and rectangle-fitting APIs. Each mark is sized from its true LED pattern or wordmark bounds, centered in the upper-left panel, and clipped to the panel boundary.


## v1.6.1 display stabilization

Long airline names, flight numbers, statuses, cities, weather descriptions, telemetry values, and bottom-strip fields now scale down to remain inside their assigned regions. Refreshes preserve the selected aircraft by identity and no longer restart the transition when the same aircraft remains available.


## v1.6.1 smooth live interpolation

Aircraft latitude, longitude, altitude, velocity, heading, vertical rate, and distance now move continuously between API refreshes. Heading interpolation uses the shortest turn across 0°/360°, and radar contacts use the same smoothed values as the selected-flight display.


## v1.6.1 intelligent flight phases

FlightWall now derives aircraft phases from altitude, speed, vertical rate, distance, ground state, and upstream operational status. Classic, compact, departure, and arrival views now use the same phase-aware status engine.


## v1.6.1 arrival estimates and data freshness

FlightWall now calculates an estimated arrival time and remaining flight time from live distance, velocity, and flight phase. The selected-flight board also displays the age of the most recent aircraft report with freshness-based coloring.


## v1.6.1 airport-aware aviation weather

Supported origin and destination airports now receive independent weather. The selected-flight weather row alternates every eight seconds and displays flight category, temperature, dew point, wind, visibility, sunrise, and sunset.


## v3.0.0 radar navigation and timeline

Radar supports wheel/trackpad zoom, pointer or touch panning, double-click reset, zoom-adjusted range labels, and a selected-flight phase timeline.


## v3.0.0 FIDS board
Departures and arrivals use the same populated `flights` array as the working Classic and Radar layouts. No replacement data model is used.
