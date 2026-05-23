# Amari Jewels

Amari Jewels is a Next.js MVP for jewelry management across customers, suppliers, stock, design masters, settings, and future sales workflows.

## Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## PWA Notes

- The web app manifest lives at `public/manifest.json`.
- The production service worker lives at `public/sw.js` and is registered by `src/components/pwa/PwaRegister.tsx`.
- The static offline fallback is `public/offline.html`; an app route is also available at `/offline`.
- Service worker registration is intentionally production-only to avoid stale development caches.

## PWA Smoke Test

Build and serve the production app, then inspect installability in the browser:

```bash
npm run build
npm run start
```

Open [http://localhost:3000](http://localhost:3000), confirm the manifest loads, install prompt is available, and navigation shows the offline fallback when the network is disabled.

## Root Layout Integration

`src/app/layout.tsx` imports and renders `<PwaRegister />` once inside the root `<body>`. Keep that integration when the authenticated app shell replaces the starter page.
