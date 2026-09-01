"use client"

import { useRouter } from "next/navigation"
import { FileDown, FileSignature } from "lucide-react"

import { Button } from "@/components/ui/button"

// Documento de correção de ponto — só aparece na ocorrência "Marcação
// incompleta" (IMPAR). O papel sai com os dados do colaborador e um código
// único; horários e assinaturas são preenchidos à mão.
//
// O download é um <a> comum para a rota: o navegador salva o arquivo sem sair
// da página. Como a primeira emissão grava o código no banco, um refresh logo
// depois traz o código para a tela sem o usuário precisar recarregar.
export function CorrecaoPontoCard({
  occurrenceId,
  codigo,
  canEdit,
}: {
  occurrenceId: string
  codigo: string | null
  canEdit: boolean
}) {
  const router = useRouter()

  if (!canEdit && !codigo) return null

  const href = (formato: "docx" | "pdf") =>
    `/rh/ponto/correcao?occ=${occurrenceId}&formato=${formato}`

  return (
    <div className="space-y-3 rounded-lg bg-muted/40 p-3 ring-1 ring-foreground/10">
      <div className="flex items-start gap-2">
        <FileSignature className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Documento de correção de ponto</p>
          <p className="text-sm text-muted-foreground">
            Imprima, preencha à mão os horários que faltaram e colha as assinaturas
            do colaborador e do líder responsável.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canEdit && (
          <>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href={href("docx")} />}
              onClick={() => setTimeout(() => router.refresh(), 1500)}
            >
              <FileDown className="size-4" />
              Baixar DOCX
            </Button>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href={href("pdf")} />}
              onClick={() => setTimeout(() => router.refresh(), 1500)}
            >
              <FileDown className="size-4" />
              Baixar PDF
            </Button>
          </>
        )}
        <span className="text-sm text-muted-foreground">
          {codigo ? (
            <>
              Código{" "}
              <span className="font-mono text-foreground">{codigo}</span>
            </>
          ) : (
            "O código é gerado na primeira emissão."
          )}
        </span>
      </div>
    </div>
  )
}
