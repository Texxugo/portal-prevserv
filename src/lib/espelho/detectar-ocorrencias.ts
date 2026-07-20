import type { EspelhoDia } from "./parse-qyon"

// Ocorrência incorreta = dia com nº ímpar de marcações (>0): faltou bater
// entrada/saída. Dias sem nenhuma batida são ignorados (podem ser folga/feriado).
export function diasComOcorrencia(dias: EspelhoDia[]): EspelhoDia[] {
  return dias.filter(
    (d) => d.marcacoes.length > 0 && d.marcacoes.length % 2 !== 0
  )
}
