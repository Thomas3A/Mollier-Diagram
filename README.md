# Psychrometric Chart Simulator

An interactive, browser-based psychrometric chart for HVAC process analysis. Define an
air state, chain processes (heating, cooling, humidification, mixing, …) and read the
resulting states, loads and water flows — all plotted live on a temperature / humidity chart.

No build step, no server. Pure HTML + JavaScript (D3.js for the chart, Tailwind for styling).

## Live demo

**https://thomas3a.github.io/Mollier-Diagram/**

## Running locally

Just open `index.html` in any modern browser. Everything runs client-side.

## Features

- **Initial state** from dry-bulb plus any of: RH, wet-bulb, dew point, humidity ratio, enthalpy.
- **Altitude → pressure** correction (barometric formula).
- **Processes**
  - Heating — to temperature, by ΔT, by power (kW), to enthalpy
  - Cooling — to temperature, by ΔT, by power (kW), cool & dehumidify (to T, RH)
  - Humidification — adiabatic (constant h), steam, to RH, by Δx, by water flow
  - Dehumidification — to RH, by Δx, by water removal
  - Mixing of two air streams
  - Custom point
- **Chart** — temperature (y) vs. absolute humidity (x, top axis), RH curves, constant-enthalpy
  reference lines, gridlines and a comfort zone, with numbered state points and process arrows.
- **Tables** — full properties per state and per-process ΔT / Δx / Δh, sensible/latent/total
  loads (kW) and water flow (kg/h).
- **Save / Load** (browser localStorage) and **Export JSON**.

Steps store their parameters, so editing or removing a step recomputes the whole chain consistently.

## Files

| File         | Purpose                                            |
|--------------|----------------------------------------------------|
| `index.html` | Layout and styling                                 |
| `psychro.js` | Psychrometric calculation engine (ASHRAE relations)|
| `app.js`     | UI logic, process handling, D3 chart rendering     |

## GitHub Pages

The site is served by GitHub Pages from the root of the `main` branch (static files plus a
`.nojekyll` marker). Every push or merge to `main` redeploys it automatically; the
*pages build and deployment* run under **Actions** shows the status.

## Notes

Results follow standard ASHRAE psychrometric relations and are intended for engineering
reference and education. Verify critical designs against validated software.
