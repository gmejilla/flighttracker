# FlightWall v3.1.0 deployment

1. Upload the contents of this folder to the root of `gmejilla/flighttracker`.
2. In Cloudflare, keep the Worker Git root directory set to `worker`.
3. Set the deploy command to `npx wrangler deploy`.
4. Confirm the encrypted secret is named `AIRLABS_API_KEY`.
5. Test `/health`, `/flights?lat=39.9348&lon=-75.0307&radius=35&max=16`, and `/v0/callsign/UAL678`.
6. GitHub Pages continues serving the repository root.
