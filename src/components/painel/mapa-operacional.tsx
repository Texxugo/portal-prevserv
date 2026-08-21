"use client"

import { useEffect, useRef } from "react"
import L from "leaflet"

import "leaflet/dist/leaflet.css"

import { espalharCoincidentes } from "@/lib/geo/endereco"
import type { ColaboradorPainel, PostoPainel } from "@/lib/painel/dados"
import {
  iconeColaboradorHtml,
  iconePostoHtml,
} from "@/components/painel/marcadores"

// Leaflet direto, sem react-leaflet: os marcadores aqui são divIcon com HTML
// próprio e mudam de estado a cada clique, o que em react-leaflet viraria
// remontagem da árvore inteira a cada seleção.
//
// Este componente NUNCA é renderizado no servidor (o pai o importa com
// ssr: false) — o Leaflet toca em `window` já no import.

// Centro de partida quando nada está geocodificado ainda: região de Americana/
// Nova Odessa, onde estão os postos.
const CENTRO_PADRAO: [number, number] = [-22.74, -47.33]

type Props = {
  postos: PostoPainel[]
  colaboradores: ColaboradorPainel[]
  postoSelecionado: string | null
  colaboradorSelecionado: string | null
  onSelecionarPosto: (id: string | null) => void
  onSelecionarColaborador: (id: string | null) => void
}

type ComCoordenada<T> = T & { lat: number; lng: number }

function comCoordenada<T extends { lat: number | null; lng: number | null }>(
  itens: T[]
): ComCoordenada<T>[] {
  return itens.filter(
    (i): i is ComCoordenada<T> => i.lat !== null && i.lng !== null
  )
}

export default function MapaOperacional({
  postos,
  colaboradores,
  postoSelecionado,
  colaboradorSelecionado,
  onSelecionarPosto,
  onSelecionarColaborador,
}: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapa = useRef<L.Map | null>(null)
  const camadaPostos = useRef<L.LayerGroup | null>(null)
  const camadaPessoas = useRef<L.LayerGroup | null>(null)
  const jaEnquadrou = useRef(false)

  // As funções de seleção mudam de identidade a cada render do pai; guardá-las
  // numa ref evita religar todos os marcadores só por causa disso. A escrita
  // acontece depois do commit — ref não se toca durante o render.
  const acoes = useRef({ onSelecionarPosto, onSelecionarColaborador })
  useEffect(() => {
    acoes.current = { onSelecionarPosto, onSelecionarColaborador }
  })

  useEffect(() => {
    if (!container.current || mapa.current) return

    const m = L.map(container.current, {
      center: CENTRO_PADRAO,
      zoom: 12,
      zoomControl: true,
      attributionControl: true,
    })

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m)

    // Clicar no mapa vazio limpa a seleção — é o gesto que todo mundo tenta.
    m.on("click", () => {
      acoes.current.onSelecionarPosto(null)
      acoes.current.onSelecionarColaborador(null)
    })

    camadaPostos.current = L.layerGroup().addTo(m)
    camadaPessoas.current = L.layerGroup().addTo(m)
    mapa.current = m

    return () => {
      m.remove()
      mapa.current = null
      camadaPostos.current = null
      camadaPessoas.current = null
    }
  }, [])

  // Postos
  useEffect(() => {
    const camada = camadaPostos.current
    if (!camada) return
    camada.clearLayers()

    for (const p of comCoordenada(postos)) {
      const abertas = p.vagas.filter((v) => v.status === "ABERTA")
      const marcador = L.marker([p.lat, p.lng], {
        title: p.nome,
        zIndexOffset: abertas.length > 0 ? 1000 : 500,
        icon: L.divIcon({
          className: "painel-marcador",
          html: iconePostoHtml({
            comBaixa: abertas.length > 0,
            quantidade: abertas.length,
            selecionado: p.id === postoSelecionado,
          }),
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        }),
      })
      marcador.on("click", (e) => {
        L.DomEvent.stopPropagation(e)
        acoes.current.onSelecionarPosto(p.id)
      })
      marcador.bindTooltip(
        `<strong>${p.nome}</strong>${
          abertas.length ? `<br>${abertas.length} baixa(s) em aberto` : ""
        }`,
        { direction: "top", offset: [0, -16] }
      )
      camada.addLayer(marcador)
    }
  }, [postos, postoSelecionado])

  // Colaboradores
  useEffect(() => {
    const camada = camadaPessoas.current
    if (!camada) return
    camada.clearLayers()

    for (const c of espalharCoincidentes(comCoordenada(colaboradores))) {
      const selecionado = c.id === colaboradorSelecionado
      const marcador = L.marker([c.lat, c.lng], {
        title: c.nome,
        zIndexOffset: selecionado ? 900 : 0,
        icon: L.divIcon({
          className: "painel-marcador",
          html: iconeColaboradorHtml({
            sexo: c.sexo,
            santo: c.santo,
            situacao: c.situacao,
            selecionado,
          }),
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      })
      marcador.on("click", (e) => {
        L.DomEvent.stopPropagation(e)
        acoes.current.onSelecionarColaborador(c.id)
      })
      marcador.bindTooltip(
        `<strong>${c.nome}</strong>${c.santo ? "<br>Registro Santo" : ""}`,
        { direction: "top", offset: [0, -14] }
      )
      camada.addLayer(marcador)
    }
  }, [colaboradores, colaboradorSelecionado])

  // Enquadramento inicial: uma vez só. Reenquadrar a cada filtro faria o mapa
  // pular embaixo da mão de quem está navegando.
  useEffect(() => {
    const m = mapa.current
    if (!m || jaEnquadrou.current) return

    const pontos = [
      ...comCoordenada(postos).map((p) => [p.lat, p.lng] as [number, number]),
      ...comCoordenada(colaboradores).map((c) => [c.lat, c.lng] as [number, number]),
    ]
    if (pontos.length === 0) return

    jaEnquadrou.current = true
    m.fitBounds(L.latLngBounds(pontos), { padding: [48, 48], maxZoom: 15 })
  }, [postos, colaboradores])

  // Seleção pela lista lateral tem de mover o mapa — senão o clique parece não
  // ter feito nada quando o alfinete está fora da vista.
  useEffect(() => {
    const m = mapa.current
    if (!m || !postoSelecionado) return
    const p = postos.find((x) => x.id === postoSelecionado)
    if (p?.lat != null && p.lng != null) {
      m.flyTo([p.lat, p.lng], Math.max(m.getZoom(), 14), { duration: 0.6 })
    }
  }, [postoSelecionado, postos])

  useEffect(() => {
    const m = mapa.current
    if (!m || !colaboradorSelecionado) return
    const c = colaboradores.find((x) => x.id === colaboradorSelecionado)
    if (c?.lat != null && c.lng != null) {
      m.flyTo([c.lat, c.lng], Math.max(m.getZoom(), 14), { duration: 0.6 })
    }
  }, [colaboradorSelecionado, colaboradores])

  return <div ref={container} className="size-full" />
}
