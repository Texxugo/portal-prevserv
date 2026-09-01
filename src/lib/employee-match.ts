// Casamento de colaboradores do arquivo Qyon com o cadastro: matrícula exata,
// matrícula sem zeros à esquerda e, por fim, nome normalizado.

const ACCENTS = new RegExp("[\\u0300-\\u036f]", "g")

export function normNome(s: string): string {
  return s
    .normalize("NFD")
    .replace(ACCENTS, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim()
}

// Resultado detalhado do casamento. `ambiguo` distingue "ninguém tem essa matrícula"
// de "duas pessoas têm" — a fila de pendências precisa separar os dois casos, porque
// a correção é diferente (cadastrar vs escolher qual).
export type MatchResult<T> = { employee: T | null; ambiguo: boolean }

export type EmployeeIndex<T> = {
  find(matricula: string, nome: string): T | null
  findDetalhado(matricula: string, nome: string): MatchResult<T>
}

// A matrícula só é única dentro da empresa, e o "Emp." do relatório Qyon é um
// código numérico que não casa com a razão social gravada em Employee.empresa —
// não dá para desempatar por empresa aqui. Então uma matrícula que aparece em
// mais de um cadastro é tratada como AMBÍGUA e sai do índice: o casamento cai
// para o nome, em vez de escolher uma das pessoas no chute (foi assim que as
// batidas do Raimundo foram parar no Kaique). Nome repetido no cadastro segue a
// mesma regra — melhor cair em "não encontrado", que o import mostra, do que
// gravar ponto na pessoa errada em silêncio.
export function buildEmployeeIndex<
  T extends { matricula: string | null; name: string },
>(employees: T[]): EmployeeIndex<T> {
  const byMat = new Map<string, T | null>()
  const byNome = new Map<string, T | null>()

  // null = chave ambígua (dois cadastros a reivindicam) → não casa por ela.
  const registrar = (mapa: Map<string, T | null>, chave: string, e: T) => {
    if (!chave) return
    const atual = mapa.get(chave)
    if (atual === undefined) mapa.set(chave, e)
    else if (atual !== null && atual !== e) mapa.set(chave, null)
  }

  for (const e of employees) {
    if (e.matricula) {
      const mat = e.matricula.trim()
      registrar(byMat, mat, e)
      const semZeros = mat.replace(/^0+/, "")
      if (semZeros !== mat) registrar(byMat, semZeros, e)
    }
    registrar(byNome, normNome(e.name), e)
  }

  const findDetalhado = (matricula: string, nome: string): MatchResult<T> => {
    const mat = matricula.trim()
    // undefined = chave inexistente; null = chave ambígua (ver comentário acima).
    const candidatos = [
      byMat.get(mat),
      byMat.get(mat.replace(/^0+/, "")),
      byNome.get(normNome(nome)),
    ]
    for (const c of candidatos) if (c) return { employee: c, ambiguo: false }
    return { employee: null, ambiguo: candidatos.some((c) => c === null) }
  }

  return {
    find: (matricula, nome) => findDetalhado(matricula, nome).employee,
    findDetalhado,
  }
}

// Conectores não distinguem ninguém ("KEVIN COSTA BRITO" e "KEVIN COSTA DE
// BRITO" são a mesma pessoa), então saem da comparação.
const CONECTORES = new Set(["DA", "DE", "DO", "DAS", "DOS", "E"])

const tokens = (nome: string): Set<string> =>
  new Set(normNome(nome).split(" ").filter((t) => t && !CONECTORES.has(t)))

// Sugestão APENAS informativa para um nome que não casou: o cadastro com maior
// sobreposição de sobrenomes. Nunca é usada para gravar — serve para o RH ver
// que "GLEICE CALARA" e "GLEICE CLARA" são a mesma pessoa e acertar o cadastro.
// Empate no topo devolve null: sugerir a pessoa errada é pior que não sugerir.
export function sugerirParecido<T extends { name: string }>(
  alvo: string,
  employees: T[]
): T | null {
  const a = tokens(alvo)
  if (a.size === 0) return null

  let melhor: { employee: T; score: number } | null = null
  let empate = false

  for (const e of employees) {
    const b = tokens(e.name)
    if (b.size === 0) continue
    let comuns = 0
    for (const t of a) if (b.has(t)) comuns++
    const score = comuns / Math.max(a.size, b.size)
    if (!melhor || score > melhor.score) {
      melhor = { employee: e, score }
      empate = false
    } else if (score === melhor.score) {
      empate = true
    }
  }

  if (!melhor || empate || melhor.score < 0.6) return null
  return melhor.employee
}
