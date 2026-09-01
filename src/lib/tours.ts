// Roteiros do tutorial guiado (tour com spotlight) — client-safe.
// Cada tour casa com uma rota; etapas com `target` (seletor CSS) são puladas
// quando o elemento não existe/está oculto (permissões, campos condicionais).

export type TourStep = {
  target?: string // ausente = card centralizado (intro/encerramento)
  title?: string
  text: string
}

export type Tour = {
  id: string
  match: (pathname: string) => boolean
  steps: TourStep[]
  // Próxima página do fluxo encadeado (null = fim). Roda no client e pode
  // consultar o DOM (links do sidebar refletem a permissão do usuário).
  nextHref?: (pathname: string) => string | null
}

// Ordem do workflow RH: cadastro → operação diária → ponto → fechamento → folha
const CHAIN = [
  "/rh",
  "/rh/escalas",
  "/rh/efetivos",
  "/rh/ponto",
  "/rh/pendencias",
  "/rh/movimentos",
  "/rh/apontamento",
]

function navAllowed(href: string): boolean {
  return !!document.querySelector(`[data-tour="nav:${href}"]`)
}

// Próximo destino permitido da cadeia após `current`
function nextChain(current: string): string | null {
  const idx = CHAIN.indexOf(current)
  for (const href of CHAIN.slice(idx + 1)) {
    if (navAllowed(href)) return href
  }
  return null
}

export const TOURS: Tour[] = [
  {
    id: "rh",
    match: (p) => p === "/rh",
    steps: [
      {
        title: "Bem-vindo ao RH / Pessoas",
        text: "Este é o módulo de RH. Vamos percorrer o fluxo completo: colaboradores, escalas, efetivos, ponto, pendências e folha.",
      },
      {
        target: '[data-tour="rh-tabela"]',
        title: "Colaboradores",
        text: "Aqui ficam todos os colaboradores, com empresa, matrícula, departamento e situação. Use a busca para localizar alguém.",
      },
      {
        target: '[data-tour="rh-novo"]',
        title: "Novo colaborador",
        text: "Cadastre um colaborador manualmente: nome, empresa, matrícula, CPF, escala, departamento, endereço e situação.",
      },
      {
        target: '[data-tour="rh-importar"]',
        title: "Importação em lote",
        text: "Ou importe vários de uma vez pelo relatório de empregados da folha (nome, empresa, matrícula e CPF).",
      },
      {
        target: '[data-tour="rh-departamentos"]',
        title: "Departamentos / Postos",
        text: "Gerencie os postos de trabalho. Eles são usados nos Efetivos e na alocação diária.",
      },
      {
        target: '[data-tour="nav:/rh/escalas"]',
        title: "Próxima parada",
        text: "No menu Escala ficam as escalas, movimentos, apontamento e efetivos. Vamos começar pelas escalas.",
      },
    ],
    nextHref: () => nextChain("/rh"),
  },
  {
    id: "escalas",
    match: (p) => p === "/rh/escalas",
    steps: [
      {
        title: "Escalas de trabalho",
        text: "Escalas rotativas definem o ciclo de dias trabalhados e folgas (ex.: 12x36).",
      },
      {
        target: '[data-tour="escalas-manager"]',
        title: "Gerencie os ciclos",
        text: "Crie e edite escalas aqui. Cada colaborador recebe a sua no próprio cadastro, com a data de início do ciclo.",
      },
    ],
    nextHref: () => nextChain("/rh/escalas"),
  },
  {
    id: "efetivos",
    match: (p) => p === "/rh/efetivos",
    steps: [
      {
        title: "Efetivos",
        text: "Os efetivos registram quem trabalhou em cada posto, dia a dia — incluindo freelancers e eventos.",
      },
      {
        target: '[data-tour="efetivos-card"]',
        title: "Postos",
        text: "Cada cartão é um posto. Clique para consultar e cadastrar os efetivos daquele local.",
      },
    ],
    nextHref: () => {
      const card = document.querySelector<HTMLAnchorElement>(
        '[data-tour="efetivos-card"]'
      )
      return card?.getAttribute("href") ?? nextChain("/rh/efetivos")
    },
  },
  {
    id: "efetivos-dept",
    match: (p) => /^\/rh\/efetivos\/[^/]+$/.test(p),
    steps: [
      {
        target: '[aria-label="Data"]',
        title: "Filtro por dia",
        text: "A listagem mostra um dia por vez. Troque a data para consultar o histórico do posto.",
      },
      {
        target: '[data-tour="efet-tabela"]',
        title: "Efetivos do dia",
        text: "Quem trabalhou, horário, local, evento e período. A coluna Documento mostra o status da pendência documental do evento.",
      },
      {
        target: '[data-tour="efet-novo"]',
        title: "Novo efetivo",
        text: "Registre um profissional alocado neste posto. Vamos ver o formulário.",
      },
    ],
    nextHref: (pathname) => {
      if (document.querySelector('[data-tour="efet-novo"]')) {
        return `${pathname}/novo`
      }
      return nextChain("/rh/efetivos")
    },
  },
  {
    id: "efetivos-novo",
    match: (p) => /^\/rh\/efetivos\/[^/]+\/novo$/.test(p),
    steps: [
      {
        target: '[data-tour="efet-tipo-pessoa"]',
        title: "Funcionário ou freelancer",
        text: "Escolha um funcionário já cadastrado ou informe o nome de um freelancer avulso.",
      },
      {
        target: "#employeeId",
        title: "Selecione a pessoa",
        text: "A lista traz todos os funcionários cadastrados no sistema.",
      },
      {
        target: "#freelancerName",
        title: "Nome do freelancer",
        text: "Digite o nome completo do freelancer — ele não precisa estar no cadastro.",
      },
      {
        target: "#date",
        title: "Data",
        text: "O dia em que o profissional atuou no posto.",
      },
      {
        target: "#horarioEntrada",
        title: "Horários",
        text: "Informe os horários de entrada e saída da atuação.",
      },
      {
        target: "#local",
        title: "Local",
        text: "O local específico de atuação dentro do posto, se houver.",
      },
      {
        target: "#evento",
        title: "Evento",
        text: "Escolha o evento do dia (TT, TI, TE, TP, PI...). Eventos exigem validação documental.",
      },
      {
        target: "#periodo",
        title: "Período",
        text: "Diurno ou noturno.",
      },
      {
        target: '[data-tour="efet-documento"]',
        title: "Documento do evento",
        text: "Se existir documento, vincule o link. Se não, o sistema cria automaticamente uma pendência documental para regularização.",
      },
      {
        title: "Fluxo do efetivo",
        text: "Ao salvar, a pendência (quando gerada) aparece em Pendências documentais. Próxima etapa do fluxo: ponto eletrônico.",
      },
    ],
    nextHref: () => nextChain("/rh/efetivos"),
  },
  {
    id: "ponto",
    match: (p) => p === "/rh/ponto",
    steps: [
      {
        title: "Ponto eletrônico",
        text: "Uma tela só para o ponto: importar o TXT do Qyon, acompanhar as ocorrências do período e encerrar a competência.",
      },
      {
        target: '[aria-label="Competência"]',
        title: "Competência",
        text: "O período vai do dia 21 ao dia 20 do mês seguinte. A competência do arquivo é conferida na importação.",
      },
      {
        target: '[data-tour="ponto-abas"]',
        title: "Duas visões",
        text: "Importar e acompanhar é o uso do dia a dia; Tratar e encerrar é onde as ocorrências viram justificativa e o mês se fecha.",
      },
      {
        target: '[data-tour="ponto-import"]',
        title: "Importar",
        text: "Suba o arquivo do relógio. A competência vem das datas do próprio arquivo — importar de novo no mesmo período não duplica batidas.",
      },
      {
        target: '[data-tour="ponto-acompanhamento"]',
        title: "Acompanhar e avisar",
        text: "Quem tem ocorrência em aberto aparece aqui com a mensagem pronta para o WhatsApp.",
      },
      {
        target: '[data-tour="ponto-acoes"]',
        title: "Encerrar",
        text: "Encerre os espelhos prontos e trave a competência quando tudo estiver concluído.",
      },
    ],
    nextHref: () => nextChain("/rh/ponto"),
  },
  {
    id: "pendencias",
    match: (p) => p === "/rh/pendencias",
    steps: [
      {
        target: '[data-tour="pend-counters"]',
        title: "Visão geral",
        text: "Documentos em aberto, vencidos e próximos do prazo de retorno.",
      },
      {
        target: '[data-tour="pend-filtros"]',
        title: "Filtros",
        text: "Filtre por status: em aberto, vencidas, recebidas ou canceladas.",
      },
      {
        target: '[data-tour="pend-tipos"]',
        title: "Tipos de documento",
        text: "Configure as categorias de documento usadas nas solicitações.",
      },
      {
        target: '[data-tour="pend-nova"]',
        title: "Nova pendência",
        text: "Crie uma pendência manual. As automáticas chegam dos efetivos e do fechamento de espelho.",
      },
      {
        target: '[data-tour="pend-tabela"]',
        title: "Acompanhamento",
        text: "Clique em uma pendência para ver o histórico, registrar o recebimento ou cobrar pelo WhatsApp.",
      },
    ],
    nextHref: () => nextChain("/rh/pendencias"),
  },
  {
    id: "movimentos",
    match: (p) => p === "/rh/movimentos",
    steps: [
      {
        target: '[aria-label="Competência"]',
        title: "Competência",
        text: "Os movimentos são agrupados pela competência de fechamento.",
      },
      {
        target: '[data-tour="mov-tabela"]',
        title: "Movimentações",
        text: "Faltas, férias, contratações e demissões lançadas no período.",
      },
      {
        target: '[data-tour="mov-nova"]',
        title: "Nova movimentação",
        text: "Lance uma falta, férias, contratação ou demissão.",
      },
      {
        target: '[data-tour="mov-resumo"]',
        title: "Resumo",
        text: "Veja o consolidado por colaborador na competência.",
      },
    ],
    nextHref: () => nextChain("/rh/movimentos"),
  },
  {
    id: "apontamento",
    match: (p) => p === "/rh/apontamento",
    steps: [
      {
        target: '[data-tour="apont-grid"]',
        title: "Apontamento para folha",
        text: "Lance os direitos de cada colaborador na competência: vales, horas extras, faltas, DSR e gratificações.",
      },
      {
        target: '[data-tour="apont-export"]',
        title: "Exportar",
        text: "Gere o relatório em DOCX para enviar à contabilidade.",
      },
      {
        title: "Fim do fluxo!",
        text: "Você percorreu o workflow completo do RH. Reabra o tutorial de qualquer página pelo ícone ? no topo.",
      },
    ],
  },
]

export function findTour(pathname: string): Tour | undefined {
  return TOURS.find((t) => t.match(pathname))
}
