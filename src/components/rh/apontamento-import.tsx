"use client"

import { useRef, useState, useTransition } from "react"
import { Loader2, Upload } from "lucide-react"

import {
  importarApontamentoTxt,
  type ApontamentoImportResult,
} from "@/lib/actions/apontamento"
import { competenciaLabel } from "@/lib/competencia"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// De→para mostrado na tela: o mapeamento não é óbvio olhando só o arquivo (HE vai
// para HE 50%, "Dias trabalhados" vira Vale transporte), e conferir isso depois de
// gravar sai caro.
const DE_PARA: [string, string][] = [
  ["Total previsto", "Total"],
  ["Dias trabalhados", "Vale transporte"],
  ["VR (dias)", "Vale refeição"],
  ["Adicional noturno (h)", "Adic. noturno"],
  ["Horas extras (HE)", "HE 50%"],
  ["Intrajornada", "Intra"],
  ["Faltas c/ atestado", "Faltas just."],
  ["Faltas s/ atestado", "Faltas n/ just."],
  ["DSR a descontar", "DSR"],
]

export function ApontamentoImport({
  competencia,
  onImportado,
}: {
  competencia: string
  onImportado: (resultado: Extract<ApontamentoImportResult, { status: "ok" }>) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, start] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  function importar() {
    const file = inputRef.current?.files?.[0]
    if (!file) {
      setErro("Selecione o arquivo TXT do apontamento.")
      return
    }
    setErro(null)
    start(async () => {
      const formData = new FormData()
      formData.set("file", file)
      const r = await importarApontamentoTxt(formData)
      if (r.status === "error") {
        setErro(r.message)
        return
      }
      if (r.itens.length === 0) {
        setErro("Nenhum colaborador do arquivo foi encontrado no cadastro.")
        return
      }
      setAberto(false)
      onImportado(r)
    })
  }

  return (
    <>
      <Button variant="outline" onClick={() => setAberto(true)} data-tour="apont-import">
        <Upload className="size-4" />
        Importar TXT
      </Button>

      <Dialog
        open={aberto}
        onOpenChange={(o) => {
          setAberto(o)
          if (!o) setErro(null)
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar apontamento (.txt)</DialogTitle>
            <DialogDescription>
              Os valores preenchem a grade da competência{" "}
              <strong>{competenciaLabel(competencia)}</strong>
              {" sem gravar nada — confira e use “Salvar importados” para persistir."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="apont-file">Arquivo</Label>
            <Input id="apont-file" ref={inputRef} type="file" accept=".txt,.csv" />
            <p className="text-xs text-muted-foreground">
              Uma linha por colaborador, colunas separadas por &ldquo;;&rdquo;, com a
              primeira linha nomeando as colunas. O casamento é pelo nome do
              colaborador.
            </p>
          </div>

          <div className="rounded-lg bg-muted/50 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Como as colunas são aproveitadas
            </p>
            <ul className="space-y-1 text-xs">
              {DE_PARA.map(([de, para]) => (
                <li key={de} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{de}</span>
                  <span className="font-medium">{para}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              &ldquo;Folgas&rdquo; e &ldquo;Períodos incompletos (PI)&rdquo; não têm campo
              no apontamento e são ignorados. HE 100%, faltas E/F, gratificação,
              premiações e observações não são tocados.
            </p>
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAberto(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button onClick={importar} disabled={enviando}>
              {enviando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Ler arquivo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
