# FlightWall Cloudflare Worker

Secure route service for:

- `https://gmejilla.github.io/flighttracker/`

Worker endpoint:

- `https://flightwall-api.gmejilla.workers.dev/`

## Features

- AirLabs as the primary route provider
- ADSBDB fallback when AirLabs has no usable route
- Normalized JSON response
- 15-minute cache for successful routes
- 60-second cache for failed lookups
- CORS restricted to the FlightWall GitHub Pages origin
- Request validation and upstream timeouts
- `/health` endpoint
- No API key stored in GitHub

## Repository structure

```text
worker/
├── src/
│   └── index.js
├── package.json
├── wrangler.jsonc
└── README.md
```

## Cloudflare Git deployment settings

When connecting the GitHub repository in Cloudflare, configure:

- Root directory: `worker`
- Build command: `npm install`
- Deploy command: `npx wrangler deploy`

If Cloudflare installs dependencies automatically, the build command can be left blank.

## Add the AirLabs secret

Keep the existing Cloudflare secret named:

```text
AIRLABS_API_KEY
```

Do not put the API key in GitHub, `wrangler.jsonc`, or JavaScript.

From a local terminal, the secret can also be set with:

```bash
cd worker
npm install
npx wrangler secret put AIRLABS_API_KEY
```

## Test

Health check:

```text
https://flightwall-api.gmejilla.workers.dev/health
```

Route lookup:

```text
https://flightwall-api.gmejilla.workers.dev/?flight=UAL678
```

Successful response shape:

```json
{
  "success": true,
  "provider": "airlabs",
  "callsign": "UAL678",
  "origin": {
    "iata": "IAH",
    "icao": "KIAH",
    "name": null
  },
  "destination": {
    "iata": "LGA",
    "icao": "KLGA",
    "name": null
  },
  "registration": "N12345",
  "hex": "A12345",
  "aircraft": "B738",
  "airline": "United Airlines",
  "status": "en-route",
  "confidence": 99,
  "cached": false
}
```

When neither provider returns a usable route:

```json
{
  "success": false,
  "provider": null,
  "callsign": "UAL678",
  "route": null,
  "confidence": 0,
  "error": "ROUTE UNAVAILABLE"
}
```

## Frontend request

```javascript
const response = await fetch(
  `https://flightwall-api.gmejilla.workers.dev/?flight=${encodeURIComponent(callsign)}`
);

const route = await response.json();
```
