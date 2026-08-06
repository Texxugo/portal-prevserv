// SUGESTÕES de itens do relatório diário, extraídas do formulário em uso no
// Residencial Barra do Cisne. Nada aqui é obrigatório nem é aplicado sozinho:
// cada posto monta a própria lista no formulário do relatório e ela fica salva
// em RelatorioModeloItem. Esta lista só existe para quem quiser um ponto de
// partida em vez de digitar tudo do zero.

export const RELATORIO_SECOES = ["ESTATISTICA", "PORTARIA"] as const
export type RelatorioSecao = (typeof RELATORIO_SECOES)[number]

export const RELATORIO_SECAO_LABEL: Record<RelatorioSecao, string> = {
  ESTATISTICA: "Estatística do posto",
  PORTARIA: "Checklist da portaria",
}

// Marcação de cada item do checklist. IRREGULAR é o que vira apontamento no
// texto final (o "Ok" some e sobra a descrição do problema).
export const CHECKLIST_STATUS = ["OK", "IRREGULAR", "NAO_APLICA"] as const
export type ChecklistStatus = (typeof CHECKLIST_STATUS)[number]

export const CHECKLIST_STATUS_LABEL: Record<ChecklistStatus, string> = {
  OK: "Ok",
  IRREGULAR: "Irregular",
  NAO_APLICA: "Não se aplica",
}

const ESTATISTICA_SUGESTOES = [
  "Casas habitadas",
  "Casas não habitadas",
  "Obras em andamento",
  "Prestadores de serviço que entraram a pé",
  "Prestadores de serviço cadastrados (primeira vez)",
  "Prestadores de serviço cadastrados no dia",
  "Entrega de material",
  "Acompanhamento de entrega de material pela ronda",
  "PS circulando em obras sem motivo justificado",
  "Socorro feito pela segurança com destino ao PS",
  "Orientação a prestadores de serviço",
  "Orientação sobre velocidade (prestador/morador/proprietário)",
  "Advertência verbal a prestadores de serviço",
  "Portaria social — veículos (proprietário + morador)",
  "Portaria social — veículos (prestador fixo)",
  "Portaria social — veículos (prestador diário)",
  "Portaria social — veículos (acesso livre)",
  "Portaria social — veículos (visitante)",
  "Portaria social — veículos (prestador fixo/diário, acesso livre e visitante)",
  "Portaria social — veículos (total)",
  "Portaria social — pedestres (proprietário)",
  "Portaria social — pedestres (morador)",
  "Portaria social — pedestres (acesso livre)",
  "Portaria social — pedestres (prestador fixo)",
  "Portaria social — pedestres (prestador diário)",
  "Portaria social — pedestres (visitante)",
  "Portaria social — pedestres (total)",
  "Orientação a proprietários sobre procedimento",
  "Orientação a moradores sobre procedimento",
  "Furtos de objetos",
  "Acidentes de trânsito dentro do residencial",
  "Menor condutor de veículo automotor",
  "Direção perigosa",
  "Embriaguez",
  "Ato de vandalismo",
  "Furtos em residência",
  "Perturbação do sossego",
]

const PORTARIA_SUGESTOES = [
  "Celulares",
  "Telefone fixo",
  "Mouse",
  "Computadores",
  "Limpeza da portaria",
  "Botoeiras",
  "Portões do píer",
  "Cancelas",
  "Câmeras",
  "Micro-ondas",
  "Portão de saída de pedestre",
  "Portão de saída visitante/morador",
  "Cadeiras da portaria",
  "Interfones",
  "Chaves",
]

export function sugestoesDaSecao(secao: RelatorioSecao): string[] {
  return secao === "ESTATISTICA" ? ESTATISTICA_SUGESTOES : PORTARIA_SUGESTOES
}
