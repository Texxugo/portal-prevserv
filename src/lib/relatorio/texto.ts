import {
  buildRelatorioDiarioMessage,
  type RelatorioDiarioInputMsg,
} from "@/lib/whatsapp/templates"

// Reconstrói o corpo canônico do relatório a partir do que está gravado.
// Se o usuário reescreveu o texto à mão (ou pela correção), é esse texto que
// vale — foi ele que saiu para o grupo, então é contra ele que se compara.
export type RelatorioGravado = {
  mensagem: string | null
  posto: string
  date: Date
  periodo: string
  responsavel: string | null
  encomendasProxTurno: number | null
  horaEncerramento: string | null
  postoPassadoPara: string | null
  observacoes: string | null
  veiculos: RelatorioDiarioInputMsg["veiculos"]
  encomendas: RelatorioDiarioInputMsg["encomendas"]
  estatisticas: RelatorioDiarioInputMsg["estatisticas"]
  portaria: RelatorioDiarioInputMsg["portaria"]
  vistorias: RelatorioDiarioInputMsg["vistorias"]
}

export function textoCanonico(r: RelatorioGravado): string {
  if (r.mensagem) return r.mensagem
  return buildRelatorioDiarioMessage({
    posto: r.posto,
    date: r.date,
    periodo: r.periodo,
    responsavel: r.responsavel,
    encomendasProxTurno: r.encomendasProxTurno,
    horaEncerramento: r.horaEncerramento,
    postoPassadoPara: r.postoPassadoPara,
    observacoes: r.observacoes,
    veiculos: r.veiculos,
    encomendas: r.encomendas,
    estatisticas: r.estatisticas,
    portaria: r.portaria,
    vistorias: r.vistorias,
  })
}

// O WhatsApp mexe no texto no caminho: quebra linha, engole espaço duplo,
// às vezes muda aspas. Comparar caractere a caractere acusaria diferença em
// mensagem honesta, então a comparação é por LINHA e sem ruído de formatação.
function linhasComparaveis(texto: string): string[] {
  return texto
    .split("\n")
    .map((l) =>
      l
        .replace(/\s+/g, " ")
        .replace(/[""]/g, '"')
        .replace(/['']/g, "'")
        .trim()
    )
    .filter(Boolean)
    // o rodapé de autenticidade não faz parte do corpo gravado
    .filter(
      (l) =>
        l !== "---" &&
        !/^Código de verificação:/i.test(l) &&
        !/^Confira a autenticidade/i.test(l)
    )
}

export type ComparacaoTexto = {
  igual: boolean
  // linhas do relatório gravado que sumiram da mensagem apresentada
  faltando: string[]
  // linhas que aparecem na mensagem mas não existem no relatório gravado
  acrescentadas: string[]
}

export function compararTexto(
  apresentado: string,
  gravado: string
): ComparacaoTexto {
  const a = linhasComparaveis(apresentado)
  const g = linhasComparaveis(gravado)

  // Multiconjunto: uma linha repetida de propósito (ex.: dois lotes iguais)
  // não pode marcar diferença só porque aparece mais de uma vez.
  const contar = (linhas: string[]) => {
    const mapa = new Map<string, number>()
    for (const l of linhas) mapa.set(l, (mapa.get(l) ?? 0) + 1)
    return mapa
  }
  const ca = contar(a)
  const cg = contar(g)

  const faltando: string[] = []
  for (const [linha, n] of cg) {
    const diff = n - (ca.get(linha) ?? 0)
    for (let i = 0; i < diff; i++) faltando.push(linha)
  }

  const acrescentadas: string[] = []
  for (const [linha, n] of ca) {
    const diff = n - (cg.get(linha) ?? 0)
    for (let i = 0; i < diff; i++) acrescentadas.push(linha)
  }

  return {
    igual: faltando.length === 0 && acrescentadas.length === 0,
    faltando,
    acrescentadas,
  }
}

// Distingue "colaram a mensagem inteira" de "digitaram só o código": sem corpo
// não há o que conferir além da existência do código.
export function temCorpo(entrada: string, codigo: string | null): boolean {
  const semCodigo = codigo
    ? entrada.replace(new RegExp(codigo.replace(/-/g, "-?"), "i"), "")
    : entrada
  return linhasComparaveis(semCodigo).join(" ").length > 40
}
