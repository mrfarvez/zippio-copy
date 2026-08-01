# Zippio — frontend (React)

KPI performance system frontend. Five weighted KPIs roll into one score, a level
(A–E), and bankable points. Designed to stay pixel-identical to the approved
static mockup (`frontend/src/styles/zippio.css` = the original design system).

## Stack

- React 19 + Vite 8 (JavaScript)
- react-router-dom 7 (SPA routing + role guards)
- chart.js 4 (Line / Bar / Doughnut)
- All data from `src/data/mock.js` — deterministic, calibrated demo data

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173  (Vite dev server)
npm run build      # production bundle -> dist/
npm run preview    # http://localhost:4173  (serve the built bundle)
npm run lint       # oxlint
```

## Demo accounts

All passwords are `demo1234`.

| Role        | Email                |
|-------------|----------------------|
| Employee    | farvez@zippio.io     |
| Manager     | tahmid@zippio.io     |
| HR          | sadia@zippio.io      |
| Admin       | admin@zippio.io      |

## Deploy

```bash
npx vercel login   # once
npx vercel --prod  # from frontend/
```

Live: https://frontend-tau-two-57.vercel.app (`vercel.json` rewrites all routes
to `index.html` for SPA support).

## Backend swap

The `src/api/` layer is the seam for the future Laravel 12 + MySQL backend.
Every function in `src/api/index.js` currently resolves mock data; replace each
body with a real call (e.g. `list: () => get('/employees')`) when the API
exists. Set `VITE_API_URL` in a `.env` to point at the backend. JWT is sent as a
Bearer token by `src/api/client.js`.

## Smoke test

`node smoke-ssr.mjs` server-renders every route (via Vite SSR + `renderToString`)
to catch render-time errors without a browser.
