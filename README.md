# Foresight Analytics

A personal launch-monitor analytics tool for Foresight GCQuad MAX / FSX Play users. Drop in your session exports and get a proper analysis of strike location, flight characteristics, shape patterns and shot-by-shot consistency — with optimal-window benchmarks for every club in the bag.

Built because the data Foresight produces is world-class but the analysis layer most users see is thin.

![Status](https://img.shields.io/badge/status-v1.1-green) ![License](https://img.shields.io/badge/license-MIT-blue) ![Stack](https://img.shields.io/badge/stack-Vite%20%2B%20React-61dafb)

## What it does

- **Strike analysis** — per-club impact-location heatmaps with ball-speed-loss overlay, dispersion ellipses, speed-loss-by-zone tables. See exactly what your off-centre strikes cost.
- **Flight envelopes** — for every club, six gauges (launch angle, total spin, descent angle, peak height, angle of attack, smash factor) plotted against TrackMan / PGA Tour optimal windows.
- **Shape & delivery** — the 9-ball-flight matrix, face-and-path averages by club, Face-vs-Path scatter with the "straight ball" diagonal, and start-line-vs-curve scatter.
- **Per-session and aggregate analysis** — every shot you've ever logged, filterable by club, with auto-generated coaching insights.
- **Local-first** — your data lives in your browser's IndexedDB and never leaves your device. No accounts, no sync, no telemetry.
- **Unit toggle** — yards/mph and metres/km-h switchable instantly; data is stored in Foresight's native imperial units and converted on display.

## Quick start

Requires [Node.js](https://nodejs.org/) 20 or later.

```bash
git clone https://github.com/YOUR_USERNAME/foresight-analytics.git
cd foresight-analytics
npm install
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`). Drag your Foresight Excel export into the drop zone. Done.

## Other scripts

```bash
npm run build      # Production build to ./dist
npm run preview    # Locally preview the production build
npm run deploy     # Deploy ./dist to GitHub Pages (after setup)
```

## Project structure

```
foresight-analytics/
├── src/
│   ├── main.jsx              # Entry point
│   ├── App.jsx               # Top-level component, routing, state
│   ├── index.css             # Global styles + design tokens
│   ├── data/
│   │   └── benchmarks.js     # Per-club optimal windows
│   ├── lib/
│   │   ├── clubs.js          # Club naming, ordering, aliasing
│   │   ├── units.js          # Unit conversion (yds⇄m, mph⇄km/h)
│   │   ├── stats.js          # mean, stdev, summarize helpers
│   │   ├── shape.js          # 9-ball-flight classification
│   │   ├── storage.js        # IndexedDB persistence
│   │   └── parser.js         # Foresight Excel parsing
│   ├── components/
│   │   ├── TopBar.jsx
│   │   ├── FilterBar.jsx
│   │   ├── EmptyState.jsx
│   │   ├── ConfirmDialog.jsx
│   │   └── Insight.jsx
│   └── views/
│       ├── OverviewView.jsx
│       ├── StrikeView.jsx
│       ├── FlightView.jsx
│       ├── ShapeView.jsx
│       └── SessionsView.jsx
├── public/                   # Static assets
├── index.html                # HTML entry point
├── vite.config.js
├── package.json
└── README.md
```

## Data model

A "shot" is the unit of storage. Every shot includes 27 measured + derived fields, all stored in Foresight's native units (mph, yards, degrees, rpm, mm). UI components convert at display time via the `units` lib so values stay precise.

Shots are keyed by a dedup hash (timestamp + club + ball speed) so re-importing the same file is safe.

## Roadmap

**v1 (current)** — Overview, Strike, Flight, Shape, Sessions, full-bag benchmarks, unit toggle.

**v2** — Dispersion (2D landing patterns with ellipses + carry stdev over time), Trends (every metric plotted over time by club), Gapping (club distance gaps with target overlays).

**v3** — Personal benchmarks (compute optimal windows from your own best shots, not just tour averages), session-over-session diff view, exportable session reports.

**v4 (maybe)** — Multi-device sync via a real backend. Becomes relevant only if this grows into something other people use.

## Tech stack

- **[Vite](https://vitejs.dev)** for the dev server and production build
- **[React 18](https://react.dev)** with function components and hooks
- **[SheetJS](https://sheetjs.com)** (xlsx) for parsing Foresight Excel exports
- **IndexedDB** (native browser API) for persistent local storage
- **CSS variables** for theming — no CSS framework

No state library (just React's built-ins). No router (single-page tab nav). No backend.

## License

MIT. See [LICENSE](LICENSE).

## Acknowledgements

Optimal-window benchmarks compiled from publicly available TrackMan Optimization Database figures and PGA Tour ShotLink averages. This project is not affiliated with or endorsed by Foresight Sports.
