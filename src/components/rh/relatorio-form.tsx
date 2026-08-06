"use client"

import { useActionState, useEffect, useState } from "react"
import { useFormStatus } from "react-dom"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  kmAnteriorPorPlaca,
  saveRelatorioDiario,
} from "@/lib/actions/relatorios"
import type { FormState } from "@/lib/form"
import { formatKm, kmAteTroca, kmRodado, kmTotalTurno } from "@/lib/relatorio/calculo"
import { buildRelatorioDiarioMessage } from "@/lib/whatsapp/templates"
import { ButtonLink } from "@/components/button-link"
import { RelatorioFinalizarCard } from "@/components/rh/relatorio-finalizar-card"
import {
  RelatorioSecaoItens,
  novaKeyItem,
  type ItemSecao,
} from "@/components/rh/relatorio-secao-itens"
import { RelatorioWhatsappCard } from "@/components/rh/relatorio-whatsapp-card"
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
import { Textarea } from "@/components/ui/textarea"

// ---------- tipos do formulário (key só existe no React) ----------

type Veiculo = {
  key: number
  identificacao: string
  placa: string
  kmInicial: string
  kmFinal: string
  kmProximaTroca: string
}

type Encomenda = {
  key: number
  destinatario: string
  quadraLote: string
  codigos: string
}

type Vistoria = {
  key: number
  tipo: "OBRA" | "ESPACO"
  titulo: string
  quadraLote: string
  endereco: string
  proprietario: string
  responsavel: string
  situacao: "" | "ANDAMENTO" | "PARADA"
  apontamentos: string
  observacao: string
}

export type ModeloItem = { secao: string; label: string }

export type RelatorioValues = {
  id: string
  status: string
  codigo: string | null
  finalizadoAt: Date | null
  finalizadoPorNome: string | null
  enviadoAt: Date | null
  enviadoErro: string | null
  responsavel: string | null
  encomendasProxTurno: number | null
  horaEncerramento: string | null
  postoPassadoPara: string | null
  observacoes: string | null
  mensagem: string | null
  veiculos: {
    identificacao: string
    placa: string
    kmInicial: number | null
    kmFinal: number | null
    kmProximaTroca: number | null
  }[]
  encomendas: { destinatario: string; quadraLote: string | null; codigos: string }[]
  itens: {
    secao: string
    label: string
    valor: number | null
    status: string | null
    observacao: string | null
  }[]
  vistorias: {
    tipo: string
    titulo: string
    quadraLote: string | null
    endereco: string | null
    proprietario: string | null
    responsavel: string | null
    situacao: string | null
    apontamentos: string
    observacao: string | null
  }[]
}

const SITUACAO_ITEMS = {
  ANDAMENTO: "Obra em andamento",
  PARADA: "Obra paralisada",
}

let proximaKey = 1
const novaKey = () => proximaKey++

const numero = (v: number | null | undefined) =>
  v === null || v === undefined ? "" : String(v)

function Secao({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null
  return <p className="text-sm text-destructive">{messages[0]}</p>
}

function SubmitButton({ bloqueado }: { bloqueado: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending || bloqueado}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      Salvar relatório
    </Button>
  )
}

// Casa o que já foi gravado com a lista atual do posto (o modelo pode ter
// mudado desde o preenchimento) — o casamento é pelo rótulo.
function montarItens(
  modelo: ModeloItem[],
  secao: string,
  salvos: RelatorioValues["itens"] | undefined
): ItemSecao[] {
  return modelo
    .filter((m) => m.secao === secao)
    .map((m) => {
      const salvo = salvos?.find((i) => i.secao === secao && i.label === m.label)
      return {
        key: novaKeyItem(),
        label: m.label,
        valor: numero(salvo?.valor),
        status: (salvo?.status as ItemSecao["status"]) ?? "",
        observacao: salvo?.observacao ?? "",
      }
    })
}

// ---------- formulário ----------

export function RelatorioForm({
  departmentId,
  departmentName,
  date,
  periodo,
  modelo,
  relatorio,
  temGrupo,
}: {
  departmentId: string
  departmentName: string
  date: string
  periodo: string
  modelo: ModeloItem[]
  relatorio: RelatorioValues | null
  temGrupo: boolean
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    saveRelatorioDiario,
    undefined
  )
  const errors = state?.errors

  const finalizado = relatorio?.status === "FINALIZADO"

  const [responsavel, setResponsavel] = useState(relatorio?.responsavel ?? "")
  const [encomendasProxTurno, setEncomendasProxTurno] = useState(
    numero(relatorio?.encomendasProxTurno)
  )
  const [horaEncerramento, setHoraEncerramento] = useState(
    relatorio?.horaEncerramento ?? ""
  )
  const [postoPassadoPara, setPostoPassadoPara] = useState(
    relatorio?.postoPassadoPara ?? ""
  )
  const [observacoes, setObservacoes] = useState(relatorio?.observacoes ?? "")
  const [mensagem, setMensagem] = useState<string | null>(
    relatorio?.mensagem ?? null
  )

  const [veiculos, setVeiculos] = useState<Veiculo[]>(() =>
    (relatorio?.veiculos ?? []).map((v) => ({
      key: novaKey(),
      identificacao: v.identificacao,
      placa: v.placa,
      kmInicial: numero(v.kmInicial),
      kmFinal: numero(v.kmFinal),
      kmProximaTroca: numero(v.kmProximaTroca),
    }))
  )

  const [encomendas, setEncomendas] = useState<Encomenda[]>(() =>
    (relatorio?.encomendas ?? []).map((e) => ({
      key: novaKey(),
      destinatario: e.destinatario,
      quadraLote: e.quadraLote ?? "",
      codigos: e.codigos,
    }))
  )

  const [vistorias, setVistorias] = useState<Vistoria[]>(() =>
    (relatorio?.vistorias ?? []).map((v) => ({
      key: novaKey(),
      tipo: v.tipo === "OBRA" ? "OBRA" : "ESPACO",
      titulo: v.titulo,
      quadraLote: v.quadraLote ?? "",
      endereco: v.endereco ?? "",
      proprietario: v.proprietario ?? "",
      responsavel: v.responsavel ?? "",
      situacao: (v.situacao as Vistoria["situacao"]) ?? "",
      apontamentos: v.apontamentos,
      observacao: v.observacao ?? "",
    }))
  )

  const [estatisticas, setEstatisticas] = useState<ItemSecao[]>(() =>
    montarItens(modelo, "ESTATISTICA", relatorio?.itens)
  )
  const [portaria, setPortaria] = useState<ItemSecao[]>(() =>
    montarItens(modelo, "PORTARIA", relatorio?.itens)
  )

  useEffect(() => {
    if (state?.message) toast.success(state.message)
  }, [state])

  function patchVeiculo(key: number, patch: Partial<Veiculo>) {
    setVeiculos((prev) => prev.map((v) => (v.key === key ? { ...v, ...patch } : v)))
  }
  function patchEncomenda(key: number, patch: Partial<Encomenda>) {
    setEncomendas((prev) => prev.map((e) => (e.key === key ? { ...e, ...patch } : e)))
  }
  function patchVistoria(key: number, patch: Partial<Vistoria>) {
    setVistorias((prev) => prev.map((v) => (v.key === key ? { ...v, ...patch } : v)))
  }

  // Ao informar a placa, busca o último KM final da mesma VTR no posto e usa
  // como KM inicial deste turno — sem sobrescrever o que já foi digitado.
  async function puxarKmAnterior(veiculo: Veiculo) {
    if (finalizado || !veiculo.placa.trim()) return
    const anterior = await kmAnteriorPorPlaca(
      departmentId,
      veiculo.placa,
      date,
      periodo
    )
    if (anterior.kmFinal === null && anterior.kmProximaTroca === null) return

    const patch: Partial<Veiculo> = {}
    if (!veiculo.kmInicial && anterior.kmFinal !== null) {
      patch.kmInicial = String(anterior.kmFinal)
    }
    if (!veiculo.kmProximaTroca && anterior.kmProximaTroca !== null) {
      patch.kmProximaTroca = String(anterior.kmProximaTroca)
    }
    if (!Object.keys(patch).length) return
    patchVeiculo(veiculo.key, patch)
    toast.success(
      `KM do relatório anterior aplicado (${veiculo.placa.toUpperCase()}).`
    )
  }

  const parse = (v: string): number | null => {
    const digits = v.replace(/[^\d]/g, "")
    return digits ? Number(digits) : null
  }

  const veiculosCalc = veiculos.map((v) => {
    const kmInicial = parse(v.kmInicial)
    const kmFinal = parse(v.kmFinal)
    return {
      identificacao: v.identificacao,
      placa: v.placa.toUpperCase(),
      kmInicial,
      kmFinal,
      kmRodado: kmRodado(kmInicial, kmFinal),
      kmProximaTroca: parse(v.kmProximaTroca),
    }
  })

  const totalTurno = kmTotalTurno(veiculosCalc)

  // Prévia do texto: acompanha o formulário enquanto o usuário digita.
  const textoGerado = buildRelatorioDiarioMessage({
    posto: departmentName,
    date: new Date(date),
    periodo,
    responsavel: responsavel || null,
    encomendasProxTurno: parse(encomendasProxTurno),
    horaEncerramento: horaEncerramento || null,
    postoPassadoPara: postoPassadoPara || null,
    observacoes: observacoes || null,
    veiculos: veiculosCalc.filter((v) => v.identificacao || v.placa),
    encomendas: encomendas
      .filter((e) => e.destinatario.trim())
      .map((e) => ({
        destinatario: e.destinatario,
        quadraLote: e.quadraLote || null,
        codigos: e.codigos,
      })),
    estatisticas: estatisticas.map((e) => ({
      label: e.label,
      valor: parse(e.valor),
      status: null,
      observacao: null,
    })),
    portaria: portaria.map((p) => ({
      label: p.label,
      valor: null,
      status: p.status || null,
      observacao: p.observacao || null,
    })),
    vistorias: vistorias
      .filter((v) => v.titulo.trim())
      .map((v) => ({
        tipo: v.tipo,
        titulo: v.titulo,
        quadraLote: v.quadraLote || null,
        endereco: v.endereco || null,
        proprietario: v.proprietario || null,
        responsavel: v.responsavel || null,
        situacao: v.situacao || null,
        apontamentos: v.apontamentos,
        observacao: v.observacao || null,
      })),
  })

  // Blocos dinâmicos vão em campos JSON — a quantidade de linhas é variável.
  const veiculosJson = JSON.stringify(
    veiculos
      .filter((v) => v.identificacao.trim() || v.placa.trim())
      .map((v) => ({
        identificacao: v.identificacao,
        placa: v.placa,
        kmInicial: v.kmInicial,
        kmFinal: v.kmFinal,
        kmProximaTroca: v.kmProximaTroca,
      }))
  )

  const encomendasJson = JSON.stringify(
    encomendas
      .filter((e) => e.destinatario.trim())
      .map((e) => ({
        destinatario: e.destinatario,
        quadraLote: e.quadraLote,
        codigos: e.codigos,
      }))
  )

  const itensJson = JSON.stringify([
    ...estatisticas
      .filter((e) => e.label.trim())
      .map((e) => ({
        secao: "ESTATISTICA",
        label: e.label.trim(),
        valor: e.valor,
        status: null,
        observacao: "",
      })),
    ...portaria
      .filter((p) => p.label.trim())
      .map((p) => ({
        secao: "PORTARIA",
        label: p.label.trim(),
        valor: null,
        status: p.status || null,
        observacao: p.observacao,
      })),
  ])

  const vistoriasJson = JSON.stringify(
    vistorias
      .filter((v) => v.titulo.trim())
      .map((v) => ({
        tipo: v.tipo,
        titulo: v.titulo,
        quadraLote: v.quadraLote,
        endereco: v.endereco,
        proprietario: v.proprietario,
        responsavel: v.responsavel,
        situacao: v.situacao || null,
        apontamentos: v.apontamentos,
        observacao: v.observacao,
      }))
  )

  const obras = vistorias.filter((v) => v.tipo === "OBRA")
  const espacos = vistorias.filter((v) => v.tipo === "ESPACO")

  function novaVistoria(tipo: Vistoria["tipo"]) {
    setVistorias((prev) => [
      ...prev,
      {
        key: novaKey(),
        tipo,
        titulo: "",
        quadraLote: "",
        endereco: "",
        proprietario: "",
        responsavel: "",
        situacao: "",
        apontamentos: "",
        observacao: "",
      },
    ])
  }

  // Função de render, não componente: um componente declarado aqui dentro seria
  // recriado a cada tecla digitada e o React remontaria o bloco, tirando o foco
  // do campo que está sendo preenchido.
  function blocoVistoria(v: Vistoria, indice: number) {
    return (
      <div key={v.key} className="space-y-3 rounded-lg bg-muted/40 p-4">
        <div className="flex items-center gap-2">
          <Input
            value={v.titulo}
            onChange={(e) => patchVistoria(v.key, { titulo: e.target.value })}
            placeholder={
              v.tipo === "OBRA"
                ? "Título (ex.: Vistoria obra B-5)"
                : "Título (ex.: Vistoria de manutenção — Quiosque 2)"
            }
            aria-label={`Título da vistoria ${indice + 1}`}
            disabled={finalizado}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={finalizado}
            onClick={() =>
              setVistorias((prev) => prev.filter((x) => x.key !== v.key))
            }
            aria-label={`Remover vistoria ${indice + 1}`}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>

        {v.tipo === "OBRA" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={v.proprietario}
              onChange={(e) =>
                patchVistoria(v.key, { proprietario: e.target.value })
              }
              placeholder="Proprietário"
              aria-label={`Proprietário da vistoria ${indice + 1}`}
              disabled={finalizado}
            />
            <Input
              value={v.quadraLote}
              onChange={(e) => patchVistoria(v.key, { quadraLote: e.target.value })}
              placeholder="Quadra / Lote (ex.: Qd. B Lote 5)"
              aria-label={`Quadra e lote da vistoria ${indice + 1}`}
              disabled={finalizado}
            />
            <Input
              value={v.endereco}
              onChange={(e) => patchVistoria(v.key, { endereco: e.target.value })}
              placeholder="Endereço"
              aria-label={`Endereço da vistoria ${indice + 1}`}
              disabled={finalizado}
            />
            <Select
              value={v.situacao || undefined}
              onValueChange={(value) =>
                patchVistoria(v.key, {
                  situacao: (value as Vistoria["situacao"]) ?? "",
                })
              }
              items={SITUACAO_ITEMS}
              disabled={finalizado}
            >
              <SelectTrigger
                className="w-full"
                aria-label={`Situação da obra ${indice + 1}`}
              >
                <SelectValue placeholder="Situação da obra" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SITUACAO_ITEMS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Input
          value={v.responsavel}
          onChange={(e) => patchVistoria(v.key, { responsavel: e.target.value })}
          placeholder="Vistoria realizada por (ronda/líder)"
          aria-label={`Responsável pela vistoria ${indice + 1}`}
          disabled={finalizado}
        />

        <div className="space-y-2">
          <Label htmlFor={`vistoria-apontamentos-${v.key}`}>Apontamentos</Label>
          <Textarea
            id={`vistoria-apontamentos-${v.key}`}
            value={v.apontamentos}
            onChange={(e) => patchVistoria(v.key, { apontamentos: e.target.value })}
            placeholder="Um apontamento por linha"
            rows={5}
            disabled={finalizado}
          />
          <p className="text-xs text-muted-foreground">
            Cada linha vira um item da lista no relatório.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`vistoria-observacao-${v.key}`}>Observação</Label>
          <Textarea
            id={`vistoria-observacao-${v.key}`}
            value={v.observacao}
            onChange={(e) => patchVistoria(v.key, { observacao: e.target.value })}
            rows={2}
            disabled={finalizado}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {finalizado && (
        <div className="rounded-xl bg-muted/60 p-4 text-sm">
          Relatório finalizado — os campos estão bloqueados para preservar o
          código de autenticidade. Use <strong>Reabrir</strong> no fim da página
          para voltar a editar.
        </div>
      )}

      <form action={formAction} className="space-y-6">
        <input type="hidden" name="departmentId" value={departmentId} />
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="periodo" value={periodo} />
        <input type="hidden" name="veiculos" value={veiculosJson} />
        <input type="hidden" name="encomendas" value={encomendasJson} />
        <input type="hidden" name="itens" value={itensJson} />
        <input type="hidden" name="vistorias" value={vistoriasJson} />
        <input type="hidden" name="observacoes" value={observacoes} />
        <input type="hidden" name="mensagem" value={mensagem ?? ""} />

        <FieldError messages={errors?._} />

        <Secao title="Identificação">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Posto</Label>
              <Input value={departmentName.toUpperCase()} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="responsavel">Responsável pelo relatório</Label>
              <Input
                id="responsavel"
                name="responsavel"
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                placeholder="Nome de quem assina o relatório"
                disabled={finalizado}
              />
              <FieldError messages={errors?.responsavel} />
            </div>
          </div>
        </Secao>

        <Secao
          title="Controle de veículos"
          description="KM inicial é puxado do relatório anterior da mesma placa neste posto."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={finalizado}
              onClick={() =>
                setVeiculos((prev) => [
                  ...prev,
                  {
                    key: novaKey(),
                    identificacao: "",
                    placa: "",
                    kmInicial: "",
                    kmFinal: "",
                    kmProximaTroca: "",
                  },
                ])
              }
            >
              <Plus className="size-4" />
              Adicionar veículo
            </Button>
          }
        >
          {veiculos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum veículo lançado neste turno.
            </p>
          ) : (
            <div className="space-y-3">
              {veiculos.map((v, i) => {
                const calc = veiculosCalc[i]
                const restante = kmAteTroca(calc.kmFinal, calc.kmProximaTroca)
                return (
                  <div key={v.key} className="space-y-2 rounded-lg bg-muted/40 p-3">
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
                      <Input
                        value={v.identificacao}
                        onChange={(e) =>
                          patchVeiculo(v.key, { identificacao: e.target.value })
                        }
                        placeholder="Veículo (ex.: VTR carro Mobi)"
                        aria-label={`Identificação do veículo ${i + 1}`}
                        disabled={finalizado}
                      />
                      <Input
                        value={v.placa}
                        onChange={(e) => patchVeiculo(v.key, { placa: e.target.value })}
                        onBlur={() => puxarKmAnterior(v)}
                        placeholder="Placa"
                        className="uppercase"
                        aria-label={`Placa do veículo ${i + 1}`}
                        disabled={finalizado}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={finalizado}
                        onClick={() =>
                          setVeiculos((prev) => prev.filter((x) => x.key !== v.key))
                        }
                        aria-label={`Remover veículo ${i + 1}`}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3">
                      <Input
                        value={v.kmInicial}
                        onChange={(e) =>
                          patchVeiculo(v.key, { kmInicial: e.target.value })
                        }
                        inputMode="numeric"
                        placeholder="KM inicial"
                        aria-label={`KM inicial do veículo ${i + 1}`}
                        disabled={finalizado}
                      />
                      <Input
                        value={v.kmFinal}
                        onChange={(e) =>
                          patchVeiculo(v.key, { kmFinal: e.target.value })
                        }
                        inputMode="numeric"
                        placeholder="KM atual (final do turno)"
                        aria-label={`KM final do veículo ${i + 1}`}
                        disabled={finalizado}
                      />
                      <Input
                        value={v.kmProximaTroca}
                        onChange={(e) =>
                          patchVeiculo(v.key, { kmProximaTroca: e.target.value })
                        }
                        inputMode="numeric"
                        placeholder="KM da próxima troca de óleo"
                        aria-label={`KM da próxima troca do veículo ${i + 1}`}
                        disabled={finalizado}
                      />
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Rodado no turno:{" "}
                      <span className="font-medium text-foreground">
                        {calc.kmRodado === null ? "—" : `${formatKm(calc.kmRodado)} km`}
                      </span>
                      {restante !== null && (
                        <>
                          {" · "}
                          {restante >= 0 ? (
                            <>Faltam {formatKm(restante)} km para a troca de óleo</>
                          ) : (
                            <span className="font-medium text-destructive">
                              Troca de óleo vencida em {formatKm(Math.abs(restante))} km
                            </span>
                          )}
                        </>
                      )}
                    </p>
                  </div>
                )
              })}
              {veiculosCalc.filter((v) => v.kmRodado !== null).length > 1 && (
                <p className="text-sm">
                  KM total do turno:{" "}
                  <span className="font-medium">{formatKm(totalTurno)} km</span>
                </p>
              )}
            </div>
          )}
          <FieldError messages={errors?.veiculos} />
        </Secao>

        <Secao
          title="Encomendas"
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={finalizado}
              onClick={() =>
                setEncomendas((prev) => [
                  ...prev,
                  { key: novaKey(), destinatario: "", quadraLote: "", codigos: "" },
                ])
              }
            >
              <Plus className="size-4" />
              Adicionar encomenda
            </Button>
          }
        >
          <div className="space-y-2 sm:max-w-xs">
            <Label htmlFor="encomendasProxTurno">
              Encomendas passadas para o próximo turno
            </Label>
            <Input
              id="encomendasProxTurno"
              name="encomendasProxTurno"
              value={encomendasProxTurno}
              onChange={(e) => setEncomendasProxTurno(e.target.value)}
              inputMode="numeric"
              placeholder="0"
              disabled={finalizado}
            />
            <FieldError messages={errors?.encomendasProxTurno} />
          </div>

          {encomendas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma encomenda registrada.
            </p>
          ) : (
            <div className="space-y-2">
              {encomendas.map((e, i) => (
                <div
                  key={e.key}
                  className="grid gap-2 rounded-lg bg-muted/40 p-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1.2fr)_auto] sm:items-start"
                >
                  <Input
                    value={e.destinatario}
                    onChange={(ev) =>
                      patchEncomenda(e.key, { destinatario: ev.target.value })
                    }
                    placeholder="Destinatário"
                    aria-label={`Destinatário da encomenda ${i + 1}`}
                    disabled={finalizado}
                  />
                  <Input
                    value={e.quadraLote}
                    onChange={(ev) =>
                      patchEncomenda(e.key, { quadraLote: ev.target.value })
                    }
                    placeholder="Quadra / Lote"
                    aria-label={`Quadra e lote da encomenda ${i + 1}`}
                    disabled={finalizado}
                  />
                  <Textarea
                    value={e.codigos}
                    onChange={(ev) =>
                      patchEncomenda(e.key, { codigos: ev.target.value })
                    }
                    rows={2}
                    placeholder="Código (um por linha)"
                    aria-label={`Códigos da encomenda ${i + 1}`}
                    disabled={finalizado}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={finalizado}
                    onClick={() =>
                      setEncomendas((prev) => prev.filter((x) => x.key !== e.key))
                    }
                    aria-label={`Remover encomenda ${i + 1}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <FieldError messages={errors?.encomendas} />
        </Secao>

        <RelatorioSecaoItens
          departmentId={departmentId}
          secao="ESTATISTICA"
          descricao="Consolidação dos números do dia. Campos em branco não saem no relatório."
          itens={estatisticas}
          onChange={setEstatisticas}
          somenteLeitura={finalizado}
        />

        <RelatorioSecaoItens
          departmentId={departmentId}
          secao="PORTARIA"
          descricao="Itens sem marcação não entram no relatório."
          itens={portaria}
          onChange={setPortaria}
          somenteLeitura={finalizado}
        />

        <Secao
          title="Vistoria de obras"
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={finalizado}
              onClick={() => novaVistoria("OBRA")}
            >
              <Plus className="size-4" />
              Adicionar obra
            </Button>
          }
        >
          {obras.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma vistoria de obra neste turno.
            </p>
          ) : (
            <div className="space-y-3">{obras.map(blocoVistoria)}</div>
          )}
        </Secao>

        <Secao
          title="Vistoria de espaços públicos e manutenção"
          description="Áreas comuns, quiosques, vias, CFTV e demais apontamentos do posto."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={finalizado}
              onClick={() => novaVistoria("ESPACO")}
            >
              <Plus className="size-4" />
              Adicionar vistoria
            </Button>
          }
        >
          {espacos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma vistoria de espaço público neste turno.
            </p>
          ) : (
            <div className="space-y-3">{espacos.map(blocoVistoria)}</div>
          )}
        </Secao>

        <Secao title="Observações gerais e encerramento">
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações gerais</Label>
            <Textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={5}
              placeholder="Ocorrências e informações que não se encaixam nos blocos acima."
              disabled={finalizado}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="horaEncerramento">Hora de encerramento do turno</Label>
              <Input
                id="horaEncerramento"
                name="horaEncerramento"
                type="time"
                value={horaEncerramento}
                onChange={(e) => setHoraEncerramento(e.target.value)}
                disabled={finalizado}
              />
              <FieldError messages={errors?.horaEncerramento} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postoPassadoPara">Posto passado para</Label>
              <Input
                id="postoPassadoPara"
                name="postoPassadoPara"
                value={postoPassadoPara}
                onChange={(e) => setPostoPassadoPara(e.target.value)}
                placeholder="Quem assume o posto"
                disabled={finalizado}
              />
            </div>
          </div>
        </Secao>

        <div className="flex items-center gap-3">
          <SubmitButton bloqueado={finalizado} />
          <ButtonLink variant="outline" href={`/rh/efetivos/${departmentId}`}>
            Voltar ao posto
          </ButtonLink>
        </div>
      </form>

      <RelatorioWhatsappCard
        gerado={textoGerado}
        manual={mensagem}
        codigo={relatorio?.codigo ?? null}
        onManualChange={setMensagem}
      />

      <RelatorioFinalizarCard
        relatorioId={relatorio?.id ?? null}
        status={relatorio?.status ?? "RASCUNHO"}
        codigo={relatorio?.codigo ?? null}
        finalizadoAt={relatorio?.finalizadoAt ?? null}
        finalizadoPorNome={relatorio?.finalizadoPorNome ?? null}
        temGrupo={temGrupo}
        enviadoAt={relatorio?.enviadoAt ?? null}
        enviadoErro={relatorio?.enviadoErro ?? null}
      />
    </div>
  )
}
