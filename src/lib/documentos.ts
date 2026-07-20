export const DOCUMENTO_STATUS = [
  "PENDENTE",
  "SOLICITADO",
  "RECEBIDO",
  "CANCELADO",
] as const

export type DocumentoStatus = (typeof DOCUMENTO_STATUS)[number]

export const DOCUMENTO_STATUS_LABEL: Record<DocumentoStatus, string> = {
  PENDENTE: "Pendente",
  SOLICITADO: "Solicitado",
  RECEBIDO: "Recebido",
  CANCELADO: "Cancelado",
}

export function isDocumentoAberto(status: string): boolean {
  return status === "PENDENTE" || status === "SOLICITADO"
}
