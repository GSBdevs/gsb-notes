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
      // Registro é manual (main.tsx): só na web. No app desktop (Tauri) o SW é DESLIGADO —
      // senão o WebView2 cacheia o frontend e serve versão velha após o update do binário.
      injectRegister: false,
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
  build: {
    rollupOptions: {
      output: {
        // Separa as libs grandes em chunks próprios: cacheáveis entre deploys (mudam pouco)
        // e o bundle inicial deixa de estourar o aviso de 500 kB. As telas de rota são
        // carregadas sob demanda via React.lazy (ver App.tsx).
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('framer-motion')) return 'vendor-motion'
          if (id.includes('@supabase')) return 'vendor-supabase'
          if (id.includes('@tanstack')) return 'vendor-query'
          if (id.includes('react-router') || id.includes('/history/')) return 'vendor-router'
          if (id.includes('lucide-react')) return 'vendor-icons'
          // Editor de blocos (BlockNote/Mantine/ProseMirror) — pesado e usado SÓ na aba Blocos.
          // Isola num chunk próprio p/ carregar sob demanda (não pode cair no 'vendor' eager).
          if (
            id.includes('@blocknote') ||
            id.includes('@mantine') ||
            id.includes('prosemirror') ||
            id.includes('@tiptap') ||
            id.includes('/yjs/') ||
            id.includes('y-prosemirror') ||
            id.includes('y-protocols')
          )
            return 'vendor-editor'
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/'))
            return 'vendor-react'
          // Demais deps: deixa o Rollup auto-dividir — assim as usadas só pela aba Blocos (lazy)
          // não são forçadas num 'vendor' eager. (Antes o catch-all inchava o bundle inicial.)
          return undefined
        },
      },
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
