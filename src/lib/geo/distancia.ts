import type { Coordenada } from "@/lib/geo/endereco"

// Distância em LINHA RETA. Não é a distância de trajeto — o painel usa isso só
// para ordenar quem está mais perto do posto, e um serviço de rota cobraria por
// chamada sem mudar a ordem na prática.

const RAIO_TERRA_KM = 6371

const rad = (g: number) => (g * Math.PI) / 180

export function distanciaKm(a: Coordenada, b: Coordenada): number {
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * RAIO_TERRA_KM * Math.asin(Math.sqrt(s))
}

export function formatDistancia(km: number | null | undefined): string {
  if (km === null || km === undefined || !Number.isFinite(km)) return "—"
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 10) return `${km.toFixed(1).replace(".", ",")} km`
  return `${Math.round(km)} km`
}
