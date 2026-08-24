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
      includeAssets: ['hand-in-rock.png', 'pwa-192.png', 'pwa-512.png', 'pwa-maskable-512.png'],
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
        // Chrome only builds a real standalone WebAPK when it finds square
        // 192px + 512px icons. Without them it silently downgrades "Install"
        // to a plain home-screen bookmark that opens in a browser tab — and
        // a background tab gets throttled/discarded by Android, which is what
        // was randomly killing playback. The separate maskable copy keeps the
        // hand inside the safe zone so OS shape masks can't crop it.
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
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
