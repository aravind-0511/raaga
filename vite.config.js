import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Root-hosted by default (Vercel, Netlify, Cloudflare Pages, a custom domain).
// For a GitHub Pages project site, build with BASE_PATH=/raaga/ so assets and
// the service worker resolve under the repo subpath.
const base = process.env.BASE_PATH || '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Riff',
        short_name: 'Riff',
        description: 'Your music, your vibe — a local-first player with an Indian/Tamil catalog.',
        theme_color: '#0a0a0b',
        background_color: '#0a0a0b',
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
