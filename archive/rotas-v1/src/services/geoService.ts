/**
 * Geografia do módulo Rotas (doc 19 §4). Toda chamada a serviço EXTERNO de mapa passa por aqui —
 * a UI nunca faz fetch direto. Todos gratuitos e sem chave:
 *   - ViaCEP     → CEP → rua/bairro/cidade/UF
 *   - Nominatim  → endereço → lat/lon (política: ≤ 1 req/s, sem autocomplete por tecla — só ao pedir)
 *   - OSRM       → traçado por ruas + duração/distância por trecho (servidor público "demo", sem SLA)
 * Os links "abrir no Maps" delegam a navegação ao app do aparelho (Google Maps / Waze).
 */

export interface LatLon {
  lat: number
  lon: number
}

export interface CepResult {
  street: string
  district: string
  city: string
  uf: string
}

/** Um trecho da rota (de uma parada à seguinte). */
export interface RouteLeg {
  /** Segundos de deslocamento. */
  duration: number
  /** Metros. */
  distance: number
}

export interface RouteResult {
  /** Polilinha [lat, lon][] para desenhar no mapa. */
  path: [number, number][]
  legs: RouteLeg[]
  /** false = OSRM indisponível → linha reta entre as paradas (sem tempos). */
  routed: boolean
}

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const OSRM = 'https://router.project-osrm.org/route/v1/driving'

/** Busca o endereço de um CEP. Null se o CEP não existir. */
export async function lookupCep(cep: string): Promise<CepResult | null> {
  const digits = cep.replace(/\D/g, '')
  if (digits.length !== 8) return null
  const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
  if (!res.ok) return null
  const j = (await res.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string }
  if (j.erro) return null
  return { street: j.logradouro ?? '', district: j.bairro ?? '', city: j.localidade ?? '', uf: j.uf ?? '' }
}

// Nominatim: no máximo 1 requisição por segundo (fila simples).
let lastGeocode = 0
async function throttle() {
  const wait = lastGeocode + 1100 - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastGeocode = Date.now()
}

/** Endereço → coordenadas (Brasil). Null se não achar. */
export async function geocode(address: string): Promise<LatLon | null> {
  const q = address.trim()
  if (!q) return null
  await throttle()
  const url = `${NOMINATIM}?format=jsonv2&limit=1&countrycodes=br&accept-language=pt-BR&q=${encodeURIComponent(q)}`
  const res = await fetch(url)
  if (!res.ok) return null
  const list = (await res.json()) as { lat: string; lon: string }[]
  if (!list.length) return null
  return { lat: Number(list[0].lat), lon: Number(list[0].lon) }
}

/** Traçado por ruas entre os pontos (na ordem). Com < 2 pontos, não há rota. */
export async function route(points: LatLon[]): Promise<RouteResult> {
  const straight: RouteResult = { path: points.map((p) => [p.lat, p.lon]), legs: [], routed: false }
  if (points.length < 2) return straight
  try {
    const coords = points.map((p) => `${p.lon},${p.lat}`).join(';')
    const res = await fetch(`${OSRM}/${coords}?overview=full&geometries=geojson`)
    if (!res.ok) return straight
    const j = (await res.json()) as {
      code: string
      routes?: { geometry: { coordinates: [number, number][] }; legs: RouteLeg[] }[]
    }
    const r = j.code === 'Ok' ? j.routes?.[0] : undefined
    if (!r) return straight
    return {
      path: r.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
      legs: r.legs.map((l) => ({ duration: l.duration, distance: l.distance })),
      routed: true,
    }
  } catch {
    return straight
  }
}

const fmt = (p: LatLon) => `${p.lat},${p.lon}`

/** Google Maps: navegar até UMA parada (origem = localização atual do aparelho). */
export function mapsUrlTo(p: LatLon): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${fmt(p)}&travelmode=driving`
}

/** Waze: navegar até UMA parada. */
export function wazeUrlTo(p: LatLon): string {
  return `https://waze.com/ul?ll=${fmt(p)}&navigate=yes`
}

/**
 * Google Maps com a rota inteira (origem opcional = base; senão, localização atual). O link aceita
 * no máximo ~9 waypoints — acima disso, o resto fica para um segundo link (devolvemos vários).
 */
export function mapsUrlsForRoute(stops: LatLon[], origin?: LatLon | null): string[] {
  if (!stops.length) return []
  const MAX_WAYPOINTS = 9
  const urls: string[] = []
  let from: LatLon | null = origin ?? null
  let rest = stops.slice()
  while (rest.length) {
    const chunk = rest.slice(0, MAX_WAYPOINTS + 1)
    rest = rest.slice(chunk.length)
    const dest = chunk[chunk.length - 1]
    const waypoints = chunk.slice(0, -1)
    let url = `https://www.google.com/maps/dir/?api=1&destination=${fmt(dest)}&travelmode=driving`
    if (from) url += `&origin=${fmt(from)}`
    if (waypoints.length) url += `&waypoints=${encodeURIComponent(waypoints.map(fmt).join('|'))}`
    urls.push(url)
    from = dest
  }
  return urls
}
