"use client"

import { useState, useTransition } from "react"
import {
  ArrowDown,
  ArrowUp,
  Check,
  Lightbulb,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { saveRelatorioModeloSecao } from "@/lib/actions/relatorios"
import {
  CHECKLIST_STATUS,
  CHECKLIST_STATUS_LABEL,
  RELATORIO_SECAO_LABEL,
  sugestoesDaSecao,
  type ChecklistStatus,
  type RelatorioSecao,
} from "@/lib/relatorio/modelo-padrao"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Um item da seção. `key` é identidade estável no React — o rótulo NÃO serve
// para isso, porque ele é editável e pode até repetir enquanto se digita.
export type ItemSecao = {
  key: number
  label: string
  valor: string
  status: "" | ChecklistStatus
  observacao: string
}

const STATUS_ITEMS = Object.fromEntries(
  CHECKLIST_STATUS.map((s) => [s, CHECKLIST_STATUS_LABEL[s]])
)

let proximaKey = 1
export const novaKeyItem = () => proximaKey++

export function itemVazio(label: string): ItemSecao {
  return { key: novaKeyItem(), label, valor: "", status: "", observacao: "" }
}

// Seção de itens configuráveis do relatório. Tem dois modos:
// - preenchimento: lança os valores do turno;
// - edição da lista: renomeia, adiciona, remove e reordena os itens do POSTO,
//   gravando em RelatorioModeloItem para valer nos próximos relatórios.
export function RelatorioSecaoItens({
  departmentId,
  secao,
  descricao,
  itens,
  onChange,
  somenteLeitura,
}: {
  departmentId: string
  secao: RelatorioSecao
  descricao: string
  itens: ItemSecao[]
  onChange: (itens: ItemSecao[]) => void
  somenteLeitura?: boolean
}) {
  const [editando, setEditando] = useState(false)
  const [salvando, startSalvar] = useTransition()

  const estatistica = secao === "ESTATISTICA"

  function patch(key: number, p: Partial<ItemSecao>) {
    onChange(itens.map((i) => (i.key === key ? { ...i, ...p } : i)))
  }

  function mover(indice: number, direcao: -1 | 1) {
    const destino = indice + direcao
    if (destino < 0 || destino >= itens.length) return
    const copia = [...itens]
    ;[copia[indice], copia[destino]] = [copia[destino], copia[indice]]
    onChange(copia)
  }

  // Só entram as sugestões que o posto ainda não tem — clicar duas vezes não duplica.
  function adicionarSugestoes() {
    const existentes = new Set(itens.map((i) => i.label.trim().toLowerCase()))
    const novos = sugestoesDaSecao(secao)
      .filter((label) => !existentes.has(label.toLowerCase()))
      .map(itemVazio)
    if (!novos.length) {
      toast.info("Todas as sugestões já estão na lista.")
      return
    }
    onChange([...itens, ...novos])
    toast.success(
      `${novos.length} ${novos.length === 1 ? "sugestão adicionada" : "sugestões adicionadas"}. Ajuste e salve a lista.`
    )
  }

  function salvarLista() {
    const labels = itens.map((i) => i.label.trim()).filter(Boolean)
    startSalvar(async () => {
      const result = await saveRelatorioModeloSecao(departmentId, secao, labels)
      if (!result.ok) {
        toast.error(result.error || "Não foi possível salvar a lista.")
        return
      }
      // descarta itens que ficaram sem rótulo e reflete a deduplicação do servidor
      const vistos = new Set<string>()
      onChange(
        itens.filter((i) => {
          const label = i.label.trim().toLowerCase()
          if (!label || vistos.has(label)) return false
          vistos.add(label)
          return true
        })
      )
      setEditando(false)
      toast.success("Lista salva para este posto.")
    })
  }

  return (
    <section className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium">
            {RELATORIO_SECAO_LABEL[secao]}
          </h2>
          <p className="text-sm text-muted-foreground">
            {editando
              ? "Os itens valem para este posto e para os próximos relatórios."
              : descricao}
          </p>
        </div>

        {!somenteLeitura && (
          <div className="flex flex-wrap items-center gap-2">
            {editando ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={salvando}
                  onClick={adicionarSugestoes}
                >
                  <Lightbulb className="size-4" />
                  Sugestões
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={salvando}
                  onClick={() => onChange([...itens, itemVazio("")])}
                >
                  <Plus className="size-4" />
                  Adicionar item
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={salvando}
                  onClick={salvarLista}
                >
                  {salvando ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  Salvar lista
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={salvando}
                  onClick={() => setEditando(false)}
                  aria-label="Sair da edição da lista"
                >
                  <X className="size-4" />
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditando(true)}
              >
                <Pencil className="size-4" />
                Editar lista
              </Button>
            )}
          </div>
        )}
      </div>

      {itens.length === 0 ? (
        <div className="space-y-3 rounded-lg bg-muted/40 p-4">
          <p className="text-sm text-muted-foreground">
            Este posto ainda não tem itens nesta seção. Cadastre os indicadores
            que fazem sentido para a operação daqui — ou comece de uma sugestão e
            edite à vontade.
          </p>
          {!somenteLeitura && !editando && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setEditando(true)
                  onChange([...itens, itemVazio("")])
                }}
              >
                <Plus className="size-4" />
                Criar item
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditando(true)
                  adicionarSugestoes()
                }}
              >
                <Lightbulb className="size-4" />
                Ver sugestões
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className={estatistica && !editando ? "grid gap-2 sm:grid-cols-2" : "space-y-2"}>
          {itens.map((item, i) => (
            <div
              key={item.key}
              className={
                editando
                  ? "flex items-center gap-2 rounded-lg bg-muted/40 p-2"
                  : estatistica
                    ? "flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2"
                    : "grid gap-2 rounded-lg bg-muted/40 p-3 sm:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1.4fr)] sm:items-center"
              }
            >
              {editando ? (
                <>
                  <span className="w-6 shrink-0 text-center text-xs text-muted-foreground">
                    {i + 1}
                  </span>
                  <Input
                    value={item.label}
                    onChange={(e) => patch(item.key, { label: e.target.value })}
                    placeholder={
                      estatistica
                        ? "Nome do indicador (ex.: Rondas realizadas)"
                        : "Item a verificar (ex.: Rádio HT)"
                    }
                    aria-label={`Item ${i + 1}`}
                    autoFocus={!item.label}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={i === 0}
                    onClick={() => mover(i, -1)}
                    aria-label={`Mover item ${i + 1} para cima`}
                    className="text-muted-foreground"
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={i === itens.length - 1}
                    onClick={() => mover(i, 1)}
                    aria-label={`Mover item ${i + 1} para baixo`}
                    className="text-muted-foreground"
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onChange(itens.filter((x) => x.key !== item.key))}
                    aria-label={`Remover item ${i + 1}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </>
              ) : estatistica ? (
                <>
                  <span className="flex-1 text-sm">{item.label}</span>
                  <Input
                    value={item.valor}
                    onChange={(e) => patch(item.key, { valor: e.target.value })}
                    inputMode="numeric"
                    className="w-20 text-center"
                    aria-label={item.label}
                    disabled={somenteLeitura}
                  />
                </>
              ) : (
                <>
                  <span className="text-sm">{item.label}</span>
                  <Select
                    value={item.status || undefined}
                    onValueChange={(value) =>
                      patch(item.key, {
                        status: (value as ItemSecao["status"]) ?? "",
                      })
                    }
                    items={STATUS_ITEMS}
                    disabled={somenteLeitura}
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-label={`Situação — ${item.label}`}
                    >
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {CHECKLIST_STATUS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {CHECKLIST_STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={item.observacao}
                    onChange={(e) => patch(item.key, { observacao: e.target.value })}
                    placeholder={
                      item.status === "IRREGULAR"
                        ? "O que foi encontrado"
                        : "Observação (opcional)"
                    }
                    aria-label={`Observação — ${item.label}`}
                    disabled={somenteLeitura}
                  />
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
