import { blocoAleatorio } from "@/lib/codigo"

// Código de autenticidade do relatório: "RD-0806N-7K3F9".
//
// O primeiro grupo é LEGÍVEL de propósito — dia, mês e turno (D/N). Quem lê a
// mensagem no grupo vê na hora se o código combina com a data que o texto diz
// ser: relatório reaproveitado se contradiz sozinho, sem ninguém abrir o portal.
//
// O segundo grupo é sorteado (ver blocoAleatorio).
const GRUPO = 5

// Datas são "date-only" gravadas em UTC — usar getters UTC, senão o fuso
// empurra o código para o dia anterior.
function prefixo(date: Date, periodo: string): string {
  const dd = String(date.getUTCDate()).padStart(2, "0")
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0")
  return `${dd}${mm}${periodo === "NOTURNO" ? "N" : "D"}`
}

export function gerarCodigoRelatorio(date: Date, periodo: string): string {
  return `RD-${prefixo(date, periodo)}-${blocoAleatorio(GRUPO)}`
}

// Aceita o código digitado com espaço, minúscula ou sem os hífens. O tamanho
// total não mudou (5+5), então códigos emitidos no formato antigo — sufixo
// aleatório nos dois grupos — continuam normalizando igual.
export function normalizarCodigo(codigo: string): string {
  const limpo = codigo
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/^RD/, "")
  if (limpo.length !== GRUPO * 2) return ""
  return `RD-${limpo.slice(0, GRUPO)}-${limpo.slice(GRUPO)}`
}

// Data/turno que o próprio código declara. Só existe no formato novo; código
// antigo devolve null e a conferência recai sobre o que está gravado no banco.
export function dadosDoCodigo(
  codigo: string
): { dia: string; mes: string; periodo: string } | null {
  const m = /^RD-(\d{2})(\d{2})([DN])-/.exec(normalizarCodigo(codigo))
  if (!m) return null
  return {
    dia: m[1],
    mes: m[2],
    periodo: m[3] === "N" ? "NOTURNO" : "DIURNO",
  }
}

// Encontra o código dentro da mensagem colada do WhatsApp. Tolera caixa
// trocada e separador ausente ou virado espaço — é assim que o código volta
// quando alguém redigita a partir de uma foto da conversa.
export function extrairCodigo(texto: string): string | null {
  const m = /RD[\s-]{0,2}([0-9A-Z]{5})[\s-]{0,2}([0-9A-Z]{5})/i.exec(texto)
  if (!m) return null
  return normalizarCodigo(`${m[1]}${m[2]}`) || null
}
