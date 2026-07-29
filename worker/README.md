# FlightWall API Worker v3.1.0

Cloudflare Worker used by the FlightWall GitHub Pages frontend.

Endpoints: `/health`, `/flights`, `/route?flight=UAL678`, `/v0/callsign/UAL678`, `/weather`, and `/airport`.

The only required secret is `AIRLABS_API_KEY`. Never commit its value.

Cloudflare Git build settings: root directory `worker`; deploy command `npx wrangler deploy`.
