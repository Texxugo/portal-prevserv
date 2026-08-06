"use client"

import { useState, useTransition } from "react"
import {
  AlertTriangle,
  Loader2,
  Minus,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react"

import {
  verificarCodigoRelatorio,
  type VerificacaoRelatorio,
} from "@/lib/actions/relatorios"
import { formatDate, formatDateTime } from "@/lib/format"
import { dadosDoCodigo } from "@/lib/relatorio/codigo"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

// Confere um relatório recebido de terceiro. O caminho recomendado é COLAR a
// mensagem inteira: só assim dá para dizer se o texto ainda é o que foi
// emitido. Digitar só o código responde apenas se ele existe.
export function RelatorioVerificarForm({ inicial }: { inicial?: string }) {
  const [entrada, setEntrada] = useState(inicial ?? "")
  const [pending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [relatorio, setRelatorio] = useState<VerificacaoRelatorio | null>(null)

  function verificar() {
    startTransition(async () => {
      setErro(null)
      setRelatorio(null)
      const result = await verificarCodigoRelatorio(entrada)
      if (!result.ok || !result.relatorio) {
        setErro(result.error || "Não foi possível verificar.")
        return
      }
      setRelatorio(result.relatorio)
    })
  }

  // O código novo carrega dia/mês/turno. Se isso não bater com o relatório
  // gravado, o código foi adulterado à mão na mensagem.
  const declarado = relatorio ? dadosDoCodigo(relatorio.codigo) : null
  const codigoContradiz =
    declarado !== null &&
    relatorio !== null &&
    (declarado.periodo !== relatorio.periodo ||
      `${declarado.dia}/${declarado.mes}` !==
        formatDate(relatorio.date).slice(0, 5))

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <div className="space-y-2">
          <Label htmlFor="entrada">Mensagem recebida ou código</Label>
          <Textarea
            id="entrada"
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            rows={8}
            placeholder={
              "Cole aqui a mensagem inteira do WhatsApp…\n\n(ou digite apenas o código, ex.: RD-0806N-7K3F9)"
            }
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Colando a mensagem inteira, o sistema também confere se o texto foi
            alterado depois de emitido. Só o código responde apenas se ele existe.
          </p>
        </div>
        <Button
          type="button"
          disabled={pending || entrada.trim().length < 8}
          onClick={verificar}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
          Verificar
        </Button>
      </div>

      {erro && (
        <div className="flex items-start gap-3 rounded-xl bg-destructive/10 p-5 ring-1 ring-destructive/30">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Não confere</p>
            <p className="text-sm text-muted-foreground">{erro}</p>
          </div>
        </div>
      )}

      {relatorio && (
        <div className="space-y-5 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <Veredito resultado={relatorio.resultado} codigo={relatorio.codigo} />

          {codigoContradiz && (
            <Aviso>
              O código diz <strong>{declarado?.dia}/{declarado?.mes}</strong>,{" "}
              {declarado?.periodo.toLowerCase()}, mas o relatório gravado é de{" "}
              <strong>{formatDate(relatorio.date)}</strong>,{" "}
              {relatorio.periodo.toLowerCase()}. O código foi editado na mensagem.
            </Aviso>
          )}

          {relatorio.consultasAnteriores > 0 && (
            <Aviso>
              Este código já foi conferido{" "}
              <strong>
                {relatorio.consultasAnteriores}{" "}
                {relatorio.consultasAnteriores === 1 ? "vez" : "vezes"}
              </strong>{" "}
              antes desta. Consultas repetidas em dias diferentes costumam
              indicar relatório reaproveitado.
            </Aviso>
          )}

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Campo label="Posto" valor={relatorio.posto.toUpperCase()} />
            <Campo
              label="Data e turno"
              valor={`${formatDate(relatorio.date)} · ${relatorio.periodo.toLowerCase()}`}
            />
            <Campo
              label="Responsável pelo relatório"
              valor={relatorio.responsavel ?? "—"}
            />
            <Campo
              label="Finalizado por"
              valor={`${relatorio.finalizadoPorNome ?? "—"}${
                relatorio.finalizadoAt
                  ? ` em ${formatDateTime(relatorio.finalizadoAt)}`
                  : ""
              }`}
            />
          </dl>

          {(relatorio.faltando.length > 0 ||
            relatorio.acrescentadas.length > 0) && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">
                Diferenças entre a mensagem e o relatório gravado
              </h3>
              {relatorio.acrescentadas.length > 0 && (
                <Divergencia
                  icone={<Plus className="size-3.5" />}
                  titulo="Só na mensagem apresentada"
                  linhas={relatorio.acrescentadas}
                />
              )}
              {relatorio.faltando.length > 0 && (
                <Divergencia
                  icone={<Minus className="size-3.5" />}
                  titulo="Está no sistema mas sumiu da mensagem"
                  linhas={relatorio.faltando}
                />
              )}
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-sm font-medium">
              Efetivo cadastrado no sistema para este posto e turno
            </h3>
            {relatorio.efetivos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum efetivo lançado para esta data e turno — o relatório
                existe, mas a equipe não foi registrada no sistema.
              </p>
            ) : (
              <ul className="space-y-1 text-sm">
                {relatorio.efetivos.map((e, i) => (
                  <li
                    key={`${e.pessoa}-${i}`}
                    className="flex flex-wrap items-center gap-x-2 rounded-lg bg-muted/40 px-3 py-1.5"
                  >
                    <span className="font-medium">{e.pessoa}</span>
                    {e.local && (
                      <span className="text-muted-foreground">· {e.local}</span>
                    )}
                    {e.horario && (
                      <span className="text-muted-foreground">· {e.horario}</span>
                    )}
                    {e.freelancer && (
                      <span className="text-xs text-muted-foreground">
                        freelancer
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  )
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-amber-500/10 p-3 text-sm ring-1 ring-amber-500/30">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500" />
      <p>{children}</p>
    </div>
  )
}

function Divergencia({
  icone,
  titulo,
  linhas,
}: {
  icone: React.ReactNode
  titulo: string
  linhas: string[]
}) {
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icone}
        {titulo}
      </p>
      <ul className="space-y-1">
        {linhas.map((l, i) => (
          <li
            key={`${l}-${i}`}
            className="rounded-lg bg-muted/40 px-3 py-1.5 font-mono text-xs"
          >
            {l}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Veredito({
  resultado,
  codigo,
}: {
  resultado: VerificacaoRelatorio["resultado"]
  codigo: string
}) {
  if (resultado === "ALTERADO") {
    return (
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div>
          <p className="font-medium text-destructive">
            Código válido, mas o texto foi alterado
          </p>
          <p className="text-sm text-muted-foreground">
            O código <code className="font-mono">{codigo}</code> existe, porém a
            mensagem apresentada não é igual ao relatório gravado. As diferenças
            estão listadas abaixo.
          </p>
        </div>
      </div>
    )
  }

  if (resultado === "CODIGO_APENAS") {
    return (
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <p className="font-medium">Código válido</p>
          <p className="text-sm text-muted-foreground">
            O código <code className="font-mono">{codigo}</code> foi emitido pelo
            sistema. Para conferir também se o texto está íntegro, cole a
            mensagem inteira em vez de só o código.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3">
      <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
      <div>
        <p className="font-medium">Relatório autêntico e íntegro</p>
        <p className="text-sm text-muted-foreground">
          A mensagem confere com o relatório emitido sob o código{" "}
          <code className="font-mono">{codigo}</code>.
        </p>
      </div>
    </div>
  )
}
