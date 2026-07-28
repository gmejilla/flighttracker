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
