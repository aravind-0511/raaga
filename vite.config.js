import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Served from https://<user>.github.io/raaga/ on GitHub Pages, so assets and
// the service worker live under /raaga/. Override with BASE_PATH=/ for root
// hosting (Netlify, a custom domain, local `vite preview`).
const base = process.env.BASE_PATH || '/raaga/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Raaga',
        short_name: 'Raaga',
        description: 'Your music, your vibe — a local-first player with an Indian/Tamil catalog.',
        theme_color: '#0b0a12',
        background_color: '#0b0a12',
        display: 'standalone',
        orientation: 'portrait',
        scope: base,
        start_url: base,
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: base + 'index.html',
        // don't try to cache the streaming CDN or catalog API
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /saavncdn\.com|jiosavan|saavn/.test(url.host),
            handler: 'NetworkFirst',
            options: { cacheName: 'catalog', expiration: { maxEntries: 60, maxAgeSeconds: 86400 } },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5174,
    strictPort: true,
  },
})
