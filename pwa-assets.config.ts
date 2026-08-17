import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Gera os ícones PNG do PWA (192/512 + maskable + apple-touch) a partir do favicon.svg.
// Rodar: `npx pwa-assets-generator` — os PNGs vão para public/ e são referenciados no manifest.
export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/favicon.svg'],
})
