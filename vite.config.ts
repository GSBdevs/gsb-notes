import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // SW próprio (injectManifest) para o handler de Web Push, além do precache do Workbox.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: '/',
        name: 'SB Notas',
        short_name: 'SB Notas',
        description: 'Lembretes chamativos, customizáveis e compartilhados em tempo real.',
        lang: 'pt-BR',
        dir: 'ltr',
        theme_color: '#0A0A0B',
        background_color: '#0A0A0B',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        categories: ['productivity', 'utilities'],
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Atalho do ícone instalado (long-press no Android / clique-direito no desktop).
        shortcuts: [
          {
            name: 'Novo lembrete',
            short_name: 'Novo',
            description: 'Criar um lembrete rapidamente',
            url: '/?compose=new',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Evita que o Vite limpe o terminal e apague erros do cargo.
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    // O cargo escreve em src-tauri/target durante o build; o watcher do Vite
    // não deve observar essa pasta (arquivos travados → EBUSY → crash do Node).
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
})
