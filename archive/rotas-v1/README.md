# Arquivo — formato "Rotas" v1 (doc 19)

Arquivado em 29/10/2026 a pedido do dono: a aba virou **Logística** (doc 21, rotas por cidade).

Conteúdo: tela `RoutesScreen`, editor de chamado (`CallEditor`), mapa (`RouteMap`, Leaflet + OSM +
OSRM), `useServiceCalls`, `geoService` (ViaCEP/Nominatim/OSRM) e `lib/routes.ts`. Fica FORA do build
(`tsconfig` só inclui `src/`).

**O que continua no app (não arquivado):** a camada de dados — `kind 'call'`, `ServiceCall` em
`src/types.ts` e os métodos `listServiceCalls/saveServiceCall/reorderRoute` do `notesService`. No banco,
`service_calls` (migração 0035) está intacta, com os dados.

**Para restaurar:** mover os arquivos de volta para os mesmos caminhos em `src/`, reinstalar
`leaflet@1.9.4 react-leaflet@4.2.1 @types/leaflet` e religar a rota/nav em `App.tsx`/`AppShell.tsx`.
As classes CSS `.routes-map-h` e `.map-tiles-dark` continuam em `src/styles/index.css`.
