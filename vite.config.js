import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt', not 'autoUpdate': a fix round after Friday's test must
      // actually reach phones that installed earlier that day, which means
      // the app has to visibly ask before taking over — a silently
      // auto-activated new SW can leave stale content queued behind a tab
      // the user never refreshes (Implementation Plan step 16).
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // The Mixpanel SDK is dynamically import()'d only once a real
        // analytics token exists (see src/lib/analytics.js) specifically so
        // it never costs the offline shell anything when analytics is off —
        // precaching it here at install time would silently undo that.
        // Normal browser HTTP caching still applies whenever it does load.
        globIgnores: ['**/mixpanel*.js'],
      },
      manifest: {
        name: 'Vote Sahayak',
        short_name: 'Vote Sahayak',
        description: 'Voter ID help, in plain words.',
        theme_color: '#4A2E8C',
        background_color: '#F7F2E7',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
