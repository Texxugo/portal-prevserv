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

export type EmployeeIndex<T> = {
  find(matricula: string, nome: string): T | null
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

  return {
    find(matricula, nome) {
      const mat = matricula.trim()
      return (
        byMat.get(mat) ??
        byMat.get(mat.replace(/^0+/, "")) ??
        byNome.get(normNome(nome)) ??
        null
      )
    },
  }
}
