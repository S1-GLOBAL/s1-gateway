import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // A new worker waits for the user to choose Reload — never swaps
      // under an open tab (ADR 0010).
      registerType: 'prompt',
      // Registered by useRegisterSW in <UpdatePrompt />.
      injectRegister: false,
      // The kill switch: build with PWA_SELF_DESTROY=true to ship a worker
      // that unregisters itself and clears its caches.
      selfDestroying: process.env.PWA_SELF_DESTROY === 'true',
      // globPatterns already precaches every icon; listing them twice is noise.
      includeManifestIcons: false,
      manifest: {
        name: 'S1 Gateway',
        short_name: 'S1 Gateway',
        description: "Source One Global's internal staff hub",
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0b0c0b',
        theme_color: '#0b0c0b',
        icons: [
          { src: 'brand/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'brand/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'brand/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'brand/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The app shell only. API responses are never cached (ADR 0010).
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // The icon source is for `npm run pwa:icons`, not for the app.
        globIgnores: [
          'brand/app-icon.png',
          // Geist Mono ships every script; staff text is Latin. The other
          // subsets still load on demand, they are just not precached.
          '**/geist-mono-{cyrillic,cyrillic-ext,latin-ext,vietnamese,symbols2}-*.woff2',
        ],
        navigateFallback: '/index.html',
        // An API request must never be answered with the cached HTML shell.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
      },
      // No worker in development, so `npm run dev:web` never serves a stale cache.
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // One origin in development: the browser talks to Vite, Vite to the API.
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
