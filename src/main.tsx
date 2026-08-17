import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import App from './App'
import './styles/index.css'

const WEEK = 1000 * 60 * 60 * 24 * 7

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      // gcTime longo é pré-requisito da persistência: dados removidos do cache não são persistidos.
      gcTime: WEEK,
    },
    // networkMode 'online' (padrão): offline, as mutações PAUSAM (com o update otimista aplicado)
    // e resumem sozinhas ao reconectar — a "fila de sincronização" em sessão.
  },
})

// Persiste o cache em localStorage: leitura offline + partida instantânea (mostra os dados antes
// mesmo da rede responder). `buster` invalida o cache salvo quando o formato mudar.
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'sb-notas.query-cache.v1',
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: WEEK, buster: 'v1' }}
    >
      <App />
    </PersistQueryClientProvider>
  </StrictMode>,
)
