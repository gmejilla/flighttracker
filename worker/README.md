# FlightWall Worker v3.3.0

Cloudflare Worker backend for FlightWall.

## Data providers

- Live aircraft: ADSB.fi → Airplanes.live → ADSB.lol
- Routes: AirLabs → ADSBDB
- Airport metadata and runways: bundled OurAirports data
- Aviation weather: AviationWeather.gov METAR/TAF

## Endpoints

- `/health`
- `/flights?lat=39.9&lon=-75.0&radius=35&max=16`
- `/route?flight=UAL678`
- `/v0/callsign/UAL678`
- `/airport?code=PHL`
- `/weather?airport=PHL&units=imperial`
- `/weather?lat=39.9&lon=-75.0&units=imperial`

Keep the Cloudflare secret named `AIRLABS_API_KEY`.
