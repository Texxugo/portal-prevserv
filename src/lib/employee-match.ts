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

export function buildEmployeeIndex<
  T extends { matricula: string | null; name: string },
>(employees: T[]): EmployeeIndex<T> {
  const byMat = new Map<string, T>()
  const byNome = new Map<string, T>()
  for (const e of employees) {
    if (e.matricula) {
      byMat.set(e.matricula.trim(), e)
      byMat.set(e.matricula.trim().replace(/^0+/, ""), e)
    }
    byNome.set(normNome(e.name), e)
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
