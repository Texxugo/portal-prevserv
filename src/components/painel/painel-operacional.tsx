"use client"

import { useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  Building2,
  Loader2,
  MapPinOff,
  Plus,
  Search,
  Users,
} from "lucide-react"

import { distanciaKm } from "@/lib/geo/distancia"
import type { ConvitePainel, PainelDados, VagaPainel } from "@/lib/painel/dados"
import {
  podeSerConvocado,
  SITUACAO_PRIORIDADE,
  type Situacao,
} from "@/lib/painel/situacao"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { IconeColaborador, IconePosto } from "@/components/painel/marcadores"
import {
  PainelColaboradores,
  type ColaboradorComDistancia,
} from "@/components/painel/painel-colaboradores"
import { CartaoVaga, Sugestoes } from "@/components/painel/painel-vagas"
import { NovaBaixaDialog } from "@/components/painel/nova-baixa-dialog"
import { cn } from "@/lib/utils"

// O Leaflet toca em `window` no import, então o mapa só existe no cliente.
const MapaOperacional = dynamic(
  () => import("@/components/painel/mapa-operacional"),
  {
    ssr: false,
    loading: () => (
      <div className="flex size-full items-center justify-center bg-muted/40">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    ),
  }
)

const RAIOS = [
  { valor: "0", label: "Qualquer distância" },
  { valor: "5", label: "Até 5 km" },
  { valor: "10", label: "Até 10 km" },
  { valor: "20", label: "Até 20 km" },
  { valor: "50", label: "Até 50 km" },
]

// Base UI Select: `items` mapeia valor → rótulo exibido no trigger. Sem isso o
// gatilho mostra o valor cru ("0" em vez de "Qualquer distância").
const RAIO_ITEMS = Object.fromEntries(RAIOS.map((r) => [r.valor, r.label]))

function normalizar(v: string): string {
  return v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

function Legenda() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <IconePosto comBaixa={false} quantidade={0} /> Posto
      </span>
      <span className="flex items-center gap-1.5">
        <IconePosto comBaixa quantidade={2} /> Posto com baixa
      </span>
      <span className="flex items-center gap-1.5">
        <IconeColaborador sexo="M" santo={false} situacao="FOLGA" tamanho={22} />
        Masculino
      </span>
      <span className="flex items-center gap-1.5">
        <IconeColaborador sexo="F" santo={false} situacao="FOLGA" tamanho={22} />
        Feminino
      </span>
      <span className="flex items-center gap-1.5">
        <IconeColaborador sexo="M" santo situacao="FOLGA" tamanho={22} />
        <IconeColaborador sexo="F" santo situacao="FOLGA" tamanho={22} />
        Registro na Santo (anel dourado)
      </span>
      <span className="flex items-center gap-1.5">
        <IconeColaborador sexo="M" santo={false} situacao="NO_POSTO" tamanho={22} />
        Esmaecido = já em serviço ou afastado
      </span>
    </div>
  )
}

export function PainelOperacional({
  dados,
  podeEditar,
}: {
  dados: PainelDados
  podeEditar: boolean
}) {
  const router = useRouter()

  const [postoSel, setPostoSel] = useState<string | null>(null)
  const [colabSel, setColabSel] = useState<string | null>(null)
  const [vagaSel, setVagaSel] = useState<string | null>(null)
  const [novaBaixa, setNovaBaixa] = useState(false)

  const [busca, setBusca] = useState("")
  const [soSanto, setSoSanto] = useState(false)
  const [soDisponiveis, setSoDisponiveis] = useState(true)
  const [raio, setRaio] = useState("0")
  const [abaMobile, setAbaMobile] = useState<"mapa" | "lista">("mapa")

  const posto = dados.postos.find((p) => p.id === postoSel) ?? null

  // Todas as vagas do dia, em ordem: as do posto selecionado primeiro.
  const vagas = useMemo(() => {
    const todas = dados.postos.flatMap((p) => p.vagas)
    if (!postoSel) return todas
    return todas.filter((v) => v.departmentId === postoSel)
  }, [dados.postos, postoSel])

  const vagasAbertas = vagas.filter((v) => v.status === "ABERTA")

  // As sugestões acompanham o posto escolhido, igual às baixas: com um posto em
  // foco, ver ausência de outro posto na lateral só atrapalha.
  const sugestoes = postoSel
    ? dados.sugestoes.filter((s) => s.departmentId === postoSel)
    : dados.sugestoes

  // Uma baixa só: já é a escolhida. Obrigar um clique extra para chegar ao
  // botão de convocar não ajudaria ninguém.
  const vagaAtiva: VagaPainel | null =
    vagas.find((v) => v.id === vagaSel && v.status === "ABERTA") ??
    (vagasAbertas.length === 1 ? vagasAbertas[0] : null)

  const convitesPorEmployee = useMemo(() => {
    const mapa = new Map<string, ConvitePainel>()
    if (!vagaAtiva) return mapa
    // O mais recente por pessoa: os convites já vêm em ordem decrescente.
    for (const c of vagaAtiva.convites) {
      if (!mapa.has(c.employeeId)) mapa.set(c.employeeId, c)
    }
    return mapa
  }, [vagaAtiva])

  const colaboradores: ColaboradorComDistancia[] = useMemo(() => {
    const origem =
      posto?.lat != null && posto.lng != null
        ? { lat: posto.lat, lng: posto.lng }
        : null
    const termo = normalizar(busca.trim())
    const limite = Number(raio)

    const lista = dados.colaboradores
      .map((c) => ({
        ...c,
        distanciaKm:
          origem && c.lat !== null && c.lng !== null
            ? distanciaKm({ lat: c.lat, lng: c.lng }, origem)
            : null,
      }))
      .filter((c) => {
        if (termo && !normalizar(c.nome).includes(termo)) return false
        if (soSanto && !c.santo) return false
        if (soDisponiveis && !podeSerConvocado(c.situacao as Situacao)) return false
        // O raio só filtra quem tem distância conhecida: esconder quem está sem
        // endereço deixaria o cadastro incompleto invisível para sempre.
        if (limite > 0 && c.distanciaKm !== null && c.distanciaKm > limite) return false
        return true
      })

    // Com posto escolhido, quem está mais perto vem primeiro; sem posto, a
    // ordem é a situação (quem pode cobrir no topo) e depois o nome.
    return lista.sort((a, b) => {
      if (origem) {
        if (a.distanciaKm === null && b.distanciaKm === null) {
          return a.nome.localeCompare(b.nome, "pt-BR")
        }
        if (a.distanciaKm === null) return 1
        if (b.distanciaKm === null) return -1
        return a.distanciaKm - b.distanciaKm
      }
      const prioridade =
        SITUACAO_PRIORIDADE[a.situacao] - SITUACAO_PRIORIDADE[b.situacao]
      return prioridade !== 0 ? prioridade : a.nome.localeCompare(b.nome, "pt-BR")
    })
  }, [dados.colaboradores, posto, busca, soSanto, soDisponiveis, raio])

  const semLocalizacao = dados.colaboradores.filter((c) => c.lat === null).length
  const postosSemLocalizacao = dados.postos.filter((p) => p.lat === null).length
  const totalBaixas = dados.postos.reduce(
    (n, p) => n + p.vagas.filter((v) => v.status === "ABERTA").length,
    0
  )

  function trocarData(valor: string) {
    if (!valor) return
    setPostoSel(null)
    setVagaSel(null)
    router.push(`/operacional?data=${valor}`)
  }

  return (
    <div className="space-y-4">
      {/* ---------- Barra de controles ---------- */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="space-y-1.5">
          <Label htmlFor="data">Dia</Label>
          <Input
            id="data"
            type="date"
            value={dados.data}
            className="w-40"
            onChange={(e) => trocarData(e.target.value)}
          />
        </div>

        <div className="min-w-48 flex-1 space-y-1.5">
          <Label htmlFor="busca">Buscar colaborador</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="busca"
              value={busca}
              placeholder="Nome"
              className="pl-8"
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="raio">Distância do posto</Label>
          <Select
            name="raio"
            value={raio}
            onValueChange={(v) => setRaio(v ?? "0")}
            items={RAIO_ITEMS}
            disabled={!posto}
          >
            <SelectTrigger id="raio" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RAIOS.map((r) => (
                <SelectItem key={r.valor} value={r.valor}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={soDisponiveis ? "default" : "outline"}
            onClick={() => setSoDisponiveis((v) => !v)}
          >
            Só quem pode cobrir
          </Button>
          <Button
            type="button"
            size="sm"
            variant={soSanto ? "default" : "outline"}
            onClick={() => setSoSanto((v) => !v)}
          >
            Só registro Santo
          </Button>
        </div>

        {podeEditar && (
          <Button type="button" onClick={() => setNovaBaixa(true)}>
            <Plus className="size-4" />
            Marcar baixa
          </Button>
        )}
      </div>

      {/* ---------- Avisos de cadastro incompleto ---------- */}
      {(semLocalizacao > 0 || postosSemLocalizacao > 0) && (
        <p className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
          <MapPinOff className="size-3.5 shrink-0 text-amber-600" />
          <span>
            Fora do mapa por falta de endereço:{" "}
            {postosSemLocalizacao > 0 && (
              <strong>{postosSemLocalizacao} posto(s)</strong>
            )}
            {postosSemLocalizacao > 0 && semLocalizacao > 0 && " e "}
            {semLocalizacao > 0 && <strong>{semLocalizacao} colaborador(es)</strong>}.
            Complete o endereço em Departamentos e no cadastro de colaboradores.
          </span>
        </p>
      )}

      {/* ---------- Mapa + lista ---------- */}
      <div className="flex gap-2 lg:hidden">
        <Button
          type="button"
          size="sm"
          variant={abaMobile === "mapa" ? "default" : "outline"}
          onClick={() => setAbaMobile("mapa")}
        >
          Mapa
        </Button>
        <Button
          type="button"
          size="sm"
          variant={abaMobile === "lista" ? "default" : "outline"}
          onClick={() => setAbaMobile("lista")}
        >
          Lista ({colaboradores.length})
        </Button>
      </div>

      <div className="grid h-[calc(100svh-19rem)] min-h-[30rem] grid-cols-1 gap-4 lg:grid-cols-[1fr_24rem]">
        <div
          className={cn(
            "overflow-hidden rounded-xl ring-1 ring-foreground/10",
            abaMobile === "lista" && "hidden lg:block"
          )}
        >
          <MapaOperacional
            postos={dados.postos}
            colaboradores={colaboradores}
            postoSelecionado={postoSel}
            colaboradorSelecionado={colabSel}
            onSelecionarPosto={(id) => {
              setPostoSel(id)
              setVagaSel(null)
              if (id) setAbaMobile("lista")
            }}
            onSelecionarColaborador={(id) => {
              setColabSel(id)
              if (id) setAbaMobile("lista")
            }}
          />
        </div>

        <aside
          className={cn(
            "flex min-h-0 flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10",
            abaMobile === "mapa" && "hidden lg:flex"
          )}
        >
          <div className="space-y-2 border-b p-3">
            {posto ? (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-medium">
                      <Building2 className="size-4 shrink-0" />
                      <span className="truncate">{posto.nome}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {posto.endereco || "Sem endereço cadastrado"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setPostoSel(null)
                      setVagaSel(null)
                    }}
                  >
                    Limpar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Efetivo de hoje: {posto.efetivoDiurno} diurno ·{" "}
                  {posto.efetivoNoturno} noturno
                </p>
              </>
            ) : (
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <Users className="size-4" />
                Todos os postos
                {totalBaixas > 0 && (
                  <Badge variant="destructive" className="ml-1">
                    <AlertTriangle /> {totalBaixas} baixa(s)
                  </Badge>
                )}
              </p>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-3 p-3">
              {podeEditar && <Sugestoes sugestoes={sugestoes} data={dados.data} />}

              {vagas.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Baixas do dia
                  </p>
                  {vagas.map((v) => (
                    <CartaoVaga
                      key={v.id}
                      vaga={v}
                      mostrarPosto={!postoSel}
                      selecionada={v.id === vagaAtiva?.id}
                      onSelecionar={(id) => {
                        setVagaSel(id)
                        if (!postoSel) setPostoSel(v.departmentId)
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="border-t">
              <div className="flex items-center justify-between px-3 py-2">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Colaboradores ({colaboradores.length})
                </p>
                {vagaAtiva && (
                  <Badge variant="outline" className="text-[10px]">
                    convocando para a baixa selecionada
                  </Badge>
                )}
              </div>

              <PainelColaboradores
                colaboradores={colaboradores}
                convitesPorEmployee={convitesPorEmployee}
                vagaId={podeEditar ? (vagaAtiva?.id ?? null) : null}
                selecionado={colabSel}
                onSelecionar={setColabSel}
              />
            </div>
          </div>
        </aside>
      </div>

      <Legenda />

      <NovaBaixaDialog
        aberto={novaBaixa}
        onClose={() => setNovaBaixa(false)}
        postos={dados.postos.map((p) => ({ id: p.id, nome: p.nome }))}
        data={dados.data}
        postoPadrao={postoSel}
      />
    </div>
  )
}
