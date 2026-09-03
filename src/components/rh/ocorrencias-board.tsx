"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { justificarOcorrencias } from "@/lib/actions/fechamento"
import {
  JUSTIFICATIVA_CATEGORIAS,
  OCORRENCIA_LABEL,
  type OcorrenciaTipo,
} from "@/lib/espelho/detectar-fechamento"
import { cn } from "@/lib/utils"
import { ButtonLink } from "@/components/button-link"
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

// Uma ocorrência de qualquer colaborador da competência. `dataISO` é a chave de
// agrupamento; `data` é o que se lê na tela.
export type OcorrenciaCompetenciaRow = {
  id: string
  fechamentoId: string
  dataISO: string
  data: string
  tipo: string
  marcacoes: string
  categoria: string | null
  resolvido: boolean
  employeeName: string
  departmentName: string | null
  fechamentoEncerrado: boolean
}

const TIPO_CLASS: Record<string, string> = {
  FALTA: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  IMPAR: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  ATRASO: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  SAIDA_ANTECIPADA: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  HORA_EXTRA: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  INTERVALO: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
}

const CAT_ITEMS = Object.fromEntries(JUSTIFICATIVA_CATEGORIAS.map((c) => [c, c]))
// Abaixo disso não vale sugerir: tratar 3 linhas na mão é mais rápido que ler
// uma sugestão.
const MIN_GRUPO = 5
// Julho/2026 tem 1682 ocorrências: desenhar todas deixa cada clique com vários
// segundos de atraso. O filtro continua valendo sobre o conjunto inteiro — o
// que se limita é só quantas linhas vão para a tela de uma vez.
const LIMITE_RENDER = 300

function tipoLabel(t: string) {
  return OCORRENCIA_LABEL[t as OcorrenciaTipo] ?? t
}

export function OcorrenciasBoard({
  rows,
  competencia,
  canEdit,
}: {
  rows: OcorrenciaCompetenciaRow[]
  competencia: string
  canEdit: boolean
}) {
  const router = useRouter()
  const [items, setItems] = useState(() => rows.map((r) => ({ ...r })))
  const [selecao, setSelecao] = useState<Set<string>>(new Set())
  const [filtroTipo, setFiltroTipo] = useState("")
  const [filtroData, setFiltroData] = useState("")
  const [filtroPosto, setFiltroPosto] = useState("")
  const [busca, setBusca] = useState("")
  const [soPendentes, setSoPendentes] = useState(true)
  const [cat, setCat] = useState("")
  const [obs, setObs] = useState("")
  const [pending, start] = useTransition()

  const pendentes = items.filter((i) => !i.resolvido).length

  const tipos = useMemo(
    () => [...new Set(items.map((i) => i.tipo))].sort(),
    [items]
  )
  const datas = useMemo(
    () => [...new Set(items.map((i) => i.dataISO))].sort(),
    [items]
  )
  const postos = useMemo(
    () =>
      [...new Set(items.map((i) => i.departmentName).filter((d): d is string => !!d))].sort(),
    [items]
  )

  const dataLabel = useMemo(
    () => new Map(items.map((i) => [i.dataISO, i.data])),
    [items]
  )

  const tipoItems = useMemo(
    () =>
      Object.fromEntries([
        ["", "Todos os tipos"],
        ...tipos.map((t) => [t, tipoLabel(t)] as const),
      ]),
    [tipos]
  )
  const dataItems = useMemo(
    () =>
      Object.fromEntries([
        ["", "Todas as datas"],
        ...datas.map((d) => [d, dataLabel.get(d) ?? d] as const),
      ]),
    [datas, dataLabel]
  )
  const postoItems = useMemo(
    () =>
      Object.fromEntries([
        ["", "Todos os postos"],
        ...postos.map((p) => [p, p] as const),
      ]),
    [postos]
  )

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return items.filter(
      (i) =>
        (!filtroTipo || i.tipo === filtroTipo) &&
        (!filtroData || i.dataISO === filtroData) &&
        (!filtroPosto || i.departmentName === filtroPosto) &&
        (!soPendentes || !i.resolvido) &&
        (!q || i.employeeName.toLowerCase().includes(q))
    )
  }, [items, filtroTipo, filtroData, filtroPosto, soPendentes, busca])

  // Sugestão: o maior bloco de mesma data + mesmo tipo ainda sem justificativa.
  // É o feriado que faltou para 50 pessoas — o caso que fazia abrir 50 espelhos.
  const sugestao = useMemo(() => {
    const grupos = new Map<string, OcorrenciaCompetenciaRow[]>()
    for (const i of items) {
      if (i.resolvido || i.fechamentoEncerrado) continue
      const k = `${i.dataISO}|${i.tipo}`
      const atual = grupos.get(k)
      if (atual) atual.push(i)
      else grupos.set(k, [i])
    }
    let melhor: { dataISO: string; tipo: string; linhas: OcorrenciaCompetenciaRow[] } | null =
      null
    for (const [k, linhas] of grupos) {
      if (linhas.length < MIN_GRUPO) continue
      if (!melhor || linhas.length > melhor.linhas.length) {
        const [dataISO, tipo] = k.split("|")
        melhor = { dataISO, tipo, linhas }
      }
    }
    return melhor
  }, [items])

  // Só estas vão para o DOM; a seleção e os contadores seguem olhando `visiveis`.
  const exibidas = useMemo(() => visiveis.slice(0, LIMITE_RENDER), [visiveis])
  const ocultas = visiveis.length - exibidas.length

  const idsVisiveis = useMemo(
    () => visiveis.filter((i) => !i.fechamentoEncerrado).map((i) => i.id),
    [visiveis]
  )
  const selecionados = idsVisiveis.filter((id) => selecao.has(id))
  const todosMarcados =
    idsVisiveis.length > 0 && selecionados.length === idsVisiveis.length

  function toggle(id: string) {
    setSelecao((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleTodos() {
    setSelecao((prev) => {
      const next = new Set(prev)
      if (todosMarcados) idsVisiveis.forEach((id) => next.delete(id))
      else idsVisiveis.forEach((id) => next.add(id))
      return next
    })
  }

  function aplicarSugestao() {
    if (!sugestao) return
    setFiltroData(sugestao.dataISO)
    setFiltroTipo(sugestao.tipo)
    setFiltroPosto("")
    setBusca("")
    setSoPendentes(true)
    setSelecao(new Set(sugestao.linhas.map((l) => l.id)))
  }

  function aplicar() {
    if (selecionados.length === 0 || !cat) return
    const ids = selecionados
    start(async () => {
      const r = await justificarOcorrencias(ids, cat || null, obs || null)
      if (!r.ok) {
        toast.error(r.error || "Não foi possível justificar.")
        return
      }
      const idSet = new Set(ids)
      setItems((prev) =>
        prev.map((i) =>
          idSet.has(i.id) && !i.fechamentoEncerrado
            ? { ...i, categoria: cat, resolvido: true }
            : i
        )
      )
      setSelecao(new Set())
      setCat("")
      setObs("")
      toast.success(
        r.ignorados
          ? `${r.count} justificada(s). ${r.ignorados} ignorada(s) por estarem em espelho encerrado.`
          : `${r.count} ocorrência(s) justificada(s).`
      )
      router.refresh()
    })
  }

  const limparFiltros = () => {
    setFiltroTipo("")
    setFiltroData("")
    setFiltroPosto("")
    setBusca("")
  }
  const filtrando = !!(filtroTipo || filtroData || filtroPosto || busca)

  if (items.length === 0) {
    return (
      <div className="rounded-xl bg-card p-8 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
        Nenhuma ocorrência nesta competência.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          <span className="font-medium">{items.length}</span> ocorrência(s) na
          competência ·{" "}
          <span className={cn(pendentes > 0 && "text-amber-700 dark:text-amber-400")}>
            {pendentes} a justificar
          </span>
        </p>
        <span className="text-sm text-muted-foreground">
          {visiveis.length} no filtro
        </span>
      </div>

      {canEdit && sugestao && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary/5 p-4 ring-1 ring-primary/30">
          <p className="flex items-center gap-2 text-sm">
            <Sparkles className="size-4 shrink-0 text-primary" />
            <span>
              <span className="font-medium">
                {dataLabel.get(sugestao.dataISO)} · {tipoLabel(sugestao.tipo)}
              </span>{" "}
              aparece em {sugestao.linhas.length} colaboradores sem justificativa.
            </span>
          </p>
          <Button variant="outline" size="sm" onClick={aplicarSugestao}>
            Tratar as {sugestao.linhas.length}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Select value={filtroTipo} items={tipoItems} onValueChange={(v) => setFiltroTipo(v || "")}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todos os tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos os tipos</SelectItem>
            {tipos.map((t) => (
              <SelectItem key={t} value={t}>
                {tipoLabel(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroData} items={dataItems} onValueChange={(v) => setFiltroData(v || "")}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Todas as datas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas as datas</SelectItem>
            {datas.map((d) => (
              <SelectItem key={d} value={d}>
                {dataLabel.get(d) ?? d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {postos.length > 0 && (
          <Select
            value={filtroPosto}
            items={postoItems}
            onValueChange={(v) => setFiltroPosto(v || "")}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todos os postos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos os postos</SelectItem>
              {postos.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar colaborador..."
          className="w-56"
        />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={soPendentes}
            onChange={(e) => setSoPendentes(e.target.checked)}
            className="size-4 accent-primary"
          />
          Só as não justificadas
        </label>
        {filtrando && (
          <button
            type="button"
            onClick={limparFiltros}
            className="text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {canEdit && selecionados.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 rounded-xl bg-primary/5 p-4 ring-1 ring-primary/30">
          <div className="space-y-1">
            <Label>{selecionados.length} selecionada(s) · categoria</Label>
            <Select value={cat} items={CAT_ITEMS} onValueChange={(v) => setCat(v || "")}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                {JUSTIFICATIVA_CATEGORIAS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-40 flex-1 space-y-1">
            <Label>Observação (opcional)</Label>
            <Input value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
          <Button onClick={aplicar} disabled={pending || !cat}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Justificar {selecionados.length}
          </Button>
          <Button variant="outline" onClick={() => setSelecao(new Set())}>
            Limpar
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        {canEdit && idsVisiveis.length > 0 && (
          <div className="flex items-center gap-3 border-b border-foreground/10 px-4 py-2.5">
            <input
              type="checkbox"
              checked={todosMarcados}
              onChange={toggleTodos}
              className="size-4 accent-primary"
              aria-label="Selecionar todas as visíveis"
            />
            <span className="text-sm text-muted-foreground">
              {todosMarcados
                ? "Limpar seleção"
                : `Selecionar as ${idsVisiveis.length} do filtro`}
            </span>
          </div>
        )}
        <ul className="divide-y divide-foreground/10">
          {exibidas.map((i) => (
            <li
              key={i.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5"
            >
              {canEdit && (
                <input
                  type="checkbox"
                  checked={selecao.has(i.id)}
                  onChange={() => toggle(i.id)}
                  disabled={i.fechamentoEncerrado}
                  className="size-4 shrink-0 accent-primary disabled:opacity-40"
                  aria-label={`Selecionar ${i.employeeName} em ${i.data}`}
                />
              )}
              <span className="w-20 shrink-0 text-sm font-medium">{i.data}</span>
              <span className="min-w-40 flex-1 truncate text-sm">
                {i.employeeName}
                {i.departmentName && (
                  <span className="text-muted-foreground"> · {i.departmentName}</span>
                )}
              </span>
              <Badge variant="secondary" className={cn(TIPO_CLASS[i.tipo])}>
                {tipoLabel(i.tipo)}
              </Badge>
              {i.marcacoes && (
                <span className="font-mono text-xs text-muted-foreground">
                  {i.marcacoes}
                </span>
              )}
              <span className="ml-auto flex items-center gap-2">
                {i.fechamentoEncerrado && (
                  <Badge variant="secondary" className="bg-foreground/10">
                    Encerrado
                  </Badge>
                )}
                {i.resolvido ? (
                  <span className="flex items-center gap-1 text-sm text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="size-3.5" />
                    {i.categoria}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Sem justificativa
                  </span>
                )}
                <ButtonLink
                  variant="outline"
                  size="sm"
                  href={`/rh/ponto/${i.fechamentoId}?comp=${competencia}`}
                >
                  Espelho
                </ButtonLink>
              </span>
            </li>
          ))}
        </ul>
        {visiveis.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma ocorrência neste recorte.
          </p>
        )}
        {ocultas > 0 && (
          <p className="border-t border-foreground/10 px-4 py-3 text-sm text-muted-foreground">
            Mostrando as {exibidas.length} primeiras de {visiveis.length}. Refine
            os filtros para ver o restante — a seleção acima continua valendo para
            as {visiveis.length} do filtro.
          </p>
        )}
      </div>
    </div>
  )
}
