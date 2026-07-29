# FlightWall route update v1.2.0

Upload these replacement files to the same paths in the GitHub repository.

## Replaced files

- `config.js`
- `worker/src/index.js`
- `worker/package.json`
- `worker/wrangler.jsonc`
- `worker/README.md`

## Changes

- AirLabs remains the primary route provider.
- ADSBDB remains the fallback.
- Every successful response includes `providerReason`.
- Worker logs explain AirLabs success, fallback, timeout, HTTP error, or unusable data.
- Successful lookups cache for 15 minutes.
- Failed lookups cache for 60 seconds.
- The Worker now accepts both:
  - `/?flight=UAL678`
  - `/v0/callsign/UAL678`
- Responses include both the normalized top-level fields and a legacy `route` object, allowing the existing `app.js` route parser to work without modification.
- `config.js` routes callsign enrichment through the Cloudflare Worker.

## Cloudflare secret

Keep the existing secret named:

`AIRLABS_API_KEY`

Do not put its value in GitHub.

## Cloudflare Git deployment

- Root directory: `worker`
- Build command: leave blank or use `npm install`
- Deploy command: `npx wrangler deploy`

## Tests

Health:

`https://flightwall-api.gmejilla.workers.dev/health`

Route:

`https://flightwall-api.gmejilla.workers.dev/?flight=UAL678`

Frontend-compatible route:

`https://flightwall-api.gmejilla.workers.dev/v0/callsign/UAL678`
