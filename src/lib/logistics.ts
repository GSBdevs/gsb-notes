import type { City, RouteSlot } from '@/types'

/** Cidades (quadros) da Logística, na ordem de exibição (doc 21). */
export const CITIES: City[] = ['serra', 'vitoria', 'vv_cariacica']

export const CITY_LABEL: Record<City, string> = {
  serra: 'Serra',
  vitoria: 'Vitória',
  vv_cariacica: 'Vila Velha/Cariacica/Viana',
}

/** Nome do desfecho ✗ dentro da Logística (nas Tarefas continua "Não feito"). */
export const ROUTE_FAILED_LABEL = 'Não Feito / Retorno'

export const SLOT_LABEL: Record<RouteSlot, string> = {
  rota: 'Rota do dia',
  pre_rota: 'Pré-Rota',
  concluida: 'Concluída',
}
