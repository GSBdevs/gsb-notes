import { useEffect, useMemo } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { useAppStore } from '@/store/useAppStore'
import { useRouteGeometry } from '@/hooks/useServiceCalls'
import type { LatLon } from '@/services/geoService'

/** Uma parada no mapa (número = posição na rota). */
export interface MapStop {
  id: string
  lat: number
  lon: number
  n: number
  title: string
  done: boolean
}

/** Rota de um técnico: paradas na ordem + cor do técnico. */
export interface MapRoute {
  key: string
  color: string
  stops: MapStop[]
}

/** Centro padrão sem nenhum ponto (Brasil). */
const BR_CENTER: [number, number] = [-15.78, -47.93]

/** Tiles CARTO (escuro/claro conforme o tema) — grátis com atribuição; ver doc 19 §7 D3. */
function useTiles() {
  const theme = useAppStore((s) => s.settings.theme)
  const light =
    theme === 'light' ||
    (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches)
  return {
    url: `https://{s}.basemaps.cartocdn.com/${light ? 'light_all' : 'dark_all'}/{z}/{x}/{y}{r}.png`,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  }
}

function pinIcon(n: number | string, color: string, opts: { selected?: boolean; done?: boolean } = {}) {
  const size = opts.selected ? 34 : 28
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;display:grid;place-items:center;
      background:${opts.done ? 'var(--bg-elevated-2)' : color};color:${opts.done ? 'var(--text-muted)' : '#0A0A0B'};
      font:700 ${opts.selected ? 14 : 12.5}px/1 Inter,system-ui,sans-serif;
      border:${opts.selected ? 3 : 2}px solid ${opts.selected ? 'var(--accent)' : 'rgba(10,10,11,.85)'};
      box-shadow:0 2px 8px rgba(0,0,0,.45)">${n}</div>`,
  })
}

const baseIcon = L.divIcon({
  className: '',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  html: `<div style="width:30px;height:30px;border-radius:8px;display:grid;place-items:center;background:#0A0A0B;
    color:var(--accent);font:800 13px/1 Inter,system-ui,sans-serif;border:2px solid var(--accent);
    box-shadow:0 2px 8px rgba(0,0,0,.45)">B</div>`,
})

/** Enquadra todos os pontos quando o conjunto muda (não a cada re-render). */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  const key = points.map((p) => p.join(',')).join(';')
  useEffect(() => {
    if (!points.length) return
    if (points.length === 1) map.setView(points[0], 15)
    else map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 16 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map])
  return null
}

/** O container pode mudar de tamanho (alternar lista/mapa no mobile) — o Leaflet precisa saber. */
function AutoResize() {
  const map = useMap()
  useEffect(() => {
    const el = map.getContainer()
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(el)
    return () => ro.disconnect()
  }, [map])
  return null
}

/** Traçado de UMA rota (OSRM; cai para linha reta se o servidor falhar). */
function RouteLine({ route, base }: { route: MapRoute; base: LatLon | null }) {
  const pending = route.stops.filter((s) => !s.done)
  const points: LatLon[] = [...(base ? [base] : []), ...pending.map((s) => ({ lat: s.lat, lon: s.lon }))]
  const { data } = useRouteGeometry(points)
  const path = data?.path ?? points.map((p) => [p.lat, p.lon] as [number, number])
  if (path.length < 2) return null
  return (
    <Polyline
      positions={path}
      pathOptions={{ color: route.color, weight: 4, opacity: 0.85, dashArray: data?.routed ? undefined : '6 8' }}
    />
  )
}

export function RouteMap({
  routes,
  base,
  selectedId,
  onSelect,
}: {
  routes: MapRoute[]
  base: (LatLon & { label: string }) | null
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const tiles = useTiles()
  const all = useMemo(() => {
    const pts: [number, number][] = routes.flatMap((r) => r.stops.map((s) => [s.lat, s.lon] as [number, number]))
    if (base) pts.push([base.lat, base.lon])
    return pts
  }, [routes, base])

  return (
    <MapContainer center={BR_CENTER} zoom={4} className="h-full w-full" style={{ background: 'var(--bg-base)' }}>
      <TileLayer url={tiles.url} attribution={tiles.attribution} subdomains="abcd" maxZoom={19} />
      <FitBounds points={all} />
      <AutoResize />
      {routes.map((r) => (
        <RouteLine key={r.key} route={r} base={base} />
      ))}
      {base && (
        <Marker position={[base.lat, base.lon]} icon={baseIcon}>
          <Tooltip direction="top" offset={[0, -14]}>
            Base — {base.label}
          </Tooltip>
        </Marker>
      )}
      {routes.flatMap((r) =>
        r.stops.map((s) => (
          <Marker
            key={s.id}
            position={[s.lat, s.lon]}
            icon={pinIcon(s.n, r.color, { selected: s.id === selectedId, done: s.done })}
            zIndexOffset={s.id === selectedId ? 1000 : 0}
            eventHandlers={{ click: () => onSelect(s.id) }}
          >
            <Tooltip direction="top" offset={[0, -14]}>
              {s.n}. {s.title}
            </Tooltip>
          </Marker>
        )),
      )}
    </MapContainer>
  )
}

function ClickToPlace({ onPick }: { onPick: (p: LatLon) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lon: e.latlng.lng }) })
  return null
}

/**
 * Mini-mapa do editor para conferir/ajustar a localização: arrastar o pin (ou clicar no mapa)
 * corrige um geocoding impreciso — o chamado passa a `geo_source = 'manual'`.
 */
export function PinPicker({
  value,
  fallbackCenter,
  onChange,
}: {
  value: LatLon | null
  fallbackCenter: LatLon | null
  onChange: (p: LatLon) => void
}) {
  const tiles = useTiles()
  const center: [number, number] = value
    ? [value.lat, value.lon]
    : fallbackCenter
      ? [fallbackCenter.lat, fallbackCenter.lon]
      : BR_CENTER
  return (
    <MapContainer
      center={center}
      zoom={value ? 16 : fallbackCenter ? 12 : 4}
      className="h-full w-full"
      style={{ background: 'var(--bg-base)' }}
    >
      <TileLayer url={tiles.url} attribution={tiles.attribution} subdomains="abcd" maxZoom={19} />
      <AutoResize />
      <ClickToPlace onPick={onChange} />
      {value && <Recenter p={value} />}
      {value && (
        <Marker
          position={[value.lat, value.lon]}
          icon={pinIcon('●', 'var(--accent)')}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const ll = (e.target as L.Marker).getLatLng()
              onChange({ lat: ll.lat, lon: ll.lng })
            },
          }}
        />
      )}
    </MapContainer>
  )
}

/** Acompanha o pin quando a localização muda por fora (ex.: "Localizar" no endereço). */
function Recenter({ p }: { p: LatLon }) {
  const map = useMap()
  useEffect(() => {
    if (!map.getBounds().contains([p.lat, p.lon])) map.setView([p.lat, p.lon], Math.max(map.getZoom(), 15))
  }, [p.lat, p.lon, map])
  return null
}
