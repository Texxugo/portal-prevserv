import { normalizeKey } from "@/lib/import/parse-sheet"

// Leitura do relatório de empregados exportado pela folha. O arquivo não é uma
// planilha plana: ele vem em blocos — uma linha só com a razão social, o
// cabeçalho "Código / Nome / Nº do C.P.F." e as linhas do pessoal daquela
// empresa, repetindo o bloco para cada empregador. A empresa de cada
// colaborador é, portanto, o cabeçalho do bloco em que ele aparece.

export type EmpregadoLinha = {
  linha: number
  empresa: string
  matricula: string
  name: string
  cpf: string
  sexo: string
}

type Colunas = { matricula: number; nome: number; cpf: number; sexo: number }

const TOTAL_PREFIX = "total de empregados"

// Só as letras do rótulo: "Nº do C.P.F." vira "nodocpf", "Código" vira "codigo".
function letras(value: string): string {
  return normalizeKey(value).replace(/[^a-z]/g, "")
}

// Reconhece a linha de cabeçalho do bloco e devolve em que coluna cada campo
// está — as colunas são mescladas no relatório, então não são fixas.
function acharColunas(row: string[]): Colunas | null {
  let matricula = -1
  let nome = -1
  let cpf = -1
  let sexo = -1

  row.forEach((cell, idx) => {
    if (!cell) return
    const l = letras(cell)
    if (matricula === -1 && (l === "codigo" || l === "matricula")) matricula = idx
    else if (nome === -1 && l === "nome") nome = idx
    else if (cpf === -1 && l.includes("cpf")) cpf = idx
    else if (sexo === -1 && (l === "sexo" || l === "genero")) sexo = idx
  })

  if (nome === -1 || (matricula === -1 && cpf === -1)) return null
  return { matricula, nome, cpf, sexo }
}

// Digita como o cadastro já guarda: 000.000.000-00. Célula numérica come o zero
// à esquerda, daí o padStart.
export function formatCpf(raw: string): string | null {
  const digitos = raw.replace(/\D/g, "")
  if (!digitos) return null
  if (digitos.length > 11) return null
  const cpf = digitos.padStart(11, "0")
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`
}

// A coluna Sexo é OPCIONAL no relatório: quando não vem, o import não mexe no
// que já está cadastrado. Aceita as formas que aparecem na prática (M/F,
// masculino/feminino, homem/mulher).
export function normalizarSexo(raw: string): string {
  const v = normalizeKey(raw).replace(/[^a-z]/g, "")
  if (!v) return ""
  if (v.startsWith("m") && !v.startsWith("mulher")) return "M"
  if (v.startsWith("f") || v.startsWith("mulher")) return "F"
  if (v.startsWith("h")) return "M"
  return ""
}

// ---------- Conciliação com o cadastro ----------

export type EmpregadoCadastrado = {
  id: string
  name: string
  empresa: string | null
  cpf: string | null
  matricula: string | null
}

export type EmpregadoConciliado = {
  linha: number
  cells: {
    name: string
    empresa: string
    matricula: string
    cpf: string
    sexo: string
    acao: string
  }
  errors: string[]
  /** id do colaborador a atualizar; null cria um novo. Só quando errors está vazio. */
  alvoId: string | null
}

function soDigitos(value: string | null): string {
  return (value ?? "").replace(/\D/g, "")
}

// A matrícula só é única DENTRO da empresa — o mesmo código aparece em
// empregadores diferentes. Chave de comparação: empresa + matrícula.
export function chaveMatricula(
  empresa: string | null,
  matricula: string
): string {
  return `${normalizeKey(empresa ?? "")}|${matricula.trim()}`
}

// Importar não pode duplicar quem já existe: o CPF é a chave e a matrícula
// (dentro da empresa) é o desempate. Só Nome/Empresa/Matrícula/CPF e o Sexo
// (quando a coluna existe) entram — o resto do cadastro (departamento, escala,
// endereço, telefone) fica intacto.
export function conciliarEmpregados(
  registros: EmpregadoLinha[],
  cadastrados: EmpregadoCadastrado[]
): EmpregadoConciliado[] {
  const porCpf = new Map(
    cadastrados.filter((e) => e.cpf).map((e) => [soDigitos(e.cpf), e])
  )
  const porMatricula = new Map(
    cadastrados
      .filter((e) => !!e.matricula)
      .map((e) => [chaveMatricula(e.empresa, e.matricula!), e])
  )

  const cpfVisto = new Map<string, number>()
  const matriculaVista = new Map<string, number>()

  return registros.map((registro) => {
    const errors: string[] = []
    const name = registro.name.trim()
    const empresa = registro.empresa.trim()
    const matricula = registro.matricula.trim()

    if (!name) errors.push("Nome: informe o nome")

    let cpf = ""
    if (registro.cpf.trim()) {
      const formatado = formatCpf(registro.cpf)
      if (!formatado) errors.push("CPF: valor inválido")
      else cpf = formatado
    }
    if (!cpf && !matricula)
      errors.push("Sem CPF e sem matrícula: não dá para identificar o colaborador")

    const cpfDigitos = soDigitos(cpf)
    if (cpfDigitos) {
      const antes = cpfVisto.get(cpfDigitos)
      if (antes) errors.push(`CPF repetido na linha ${antes} do arquivo`)
      else cpfVisto.set(cpfDigitos, registro.linha)
    }

    const existentePorCpf = cpfDigitos ? porCpf.get(cpfDigitos) : undefined
    const chave = matricula ? chaveMatricula(empresa, matricula) : ""
    const dono = chave ? porMatricula.get(chave) : undefined
    const alvo = existentePorCpf ?? dono

    // Repetir a matrícula em empresas diferentes é normal; repetir DENTRO da
    // mesma empresa é que colide com a unicidade do cadastro.
    if (chave) {
      const antes = matriculaVista.get(chave)
      if (antes)
        errors.push(`Matrícula repetida nesta empresa na linha ${antes} do arquivo`)
      else matriculaVista.set(chave, registro.linha)

      // Só é conflito quando a matrícula pertence a outra pessoa que não a que
      // esta linha vai atualizar — casar pela matrícula com um cadastro ainda
      // sem CPF é o caso normal de completar o registro.
      if (dono && dono.id !== alvo?.id)
        errors.push(`Matrícula já usada por ${dono.name} nesta empresa`)
    }

    return {
      linha: registro.linha,
      cells: {
        name,
        empresa,
        matricula,
        cpf,
        sexo: normalizarSexo(registro.sexo),
        acao: alvo ? "Atualizar" : "Novo",
      },
      errors,
      alvoId: alvo?.id ?? null,
    }
  })
}

export function parseEmpregados(rows: string[][]): EmpregadoLinha[] {
  const registros: EmpregadoLinha[] = []
  let empresa = ""
  let colunas: Colunas | null = null

  rows.forEach((row, i) => {
    const preenchidas = row
      .map((v, idx) => ({ idx, v }))
      .filter((c) => c.v.length > 0)
    if (preenchidas.length === 0) return

    // Rodapé do bloco ("Total de empregados: 79").
    if (preenchidas.some((c) => normalizeKey(c.v).startsWith(TOTAL_PREFIX))) return

    const cabecalho = acharColunas(row)
    if (cabecalho) {
      colunas = cabecalho
      return
    }

    // Uma célula só é a razão social que abre o bloco — a não ser que caia
    // justamente na coluna do nome, aí é um colaborador sem código nem CPF.
    if (preenchidas.length === 1 && preenchidas[0].idx !== colunas?.nome) {
      empresa = preenchidas[0].v
      return
    }

    if (!colunas) return

    const { matricula, nome, cpf, sexo } = colunas
    registros.push({
      linha: i + 1,
      empresa,
      matricula: matricula >= 0 ? (row[matricula] ?? "") : "",
      name: nome >= 0 ? (row[nome] ?? "") : "",
      cpf: cpf >= 0 ? (row[cpf] ?? "") : "",
      sexo: sexo >= 0 ? (row[sexo] ?? "") : "",
    })
  })

  return registros
}
