import { isSexo, type Situacao } from "@/lib/painel/situacao"

// Os ícones do mapa e os da lista lateral têm de ser a MESMA coisa: quem vê um
// alfinete precisa reconhecê-lo na lista sem tradução mental. Por isso o
// desenho mora num gerador de HTML — o Leaflet usa a string crua no divIcon e o
// React reaproveita a mesma string.

// Sexo define a cor de preenchimento; registro na Santo acrescenta o anel
// dourado por cima, sem trocar a cor — as duas informações precisam conviver.
const COR_SEXO: Record<string, string> = {
  M: "#2563eb", // azul
  F: "#db2777", // rosa
  "": "#64748b", // sem informação: cinza
}

const COR_SANTO = "#f59e0b"

// Silhueta simples masculina/feminina dentro do círculo. Em 26 px o rosto some,
// então o que distingue é a forma do corpo — saia para F, tronco reto para M.
const CORPO: Record<string, string> = {
  M: '<circle cx="12" cy="8" r="3.4"/><path d="M6.4 20v-3.2a5.6 5.6 0 0 1 11.2 0V20z"/>',
  F: '<circle cx="12" cy="8" r="3.4"/><path d="M12 11.4 7 20h10z"/>',
  "": '<circle cx="12" cy="8" r="3.4"/><path d="M6.9 20v-3.4a5.1 5.1 0 0 1 10.2 0V20z"/>',
}

export type MarcadorColaborador = {
  sexo: string | null
  santo: boolean
  situacao: Situacao
  selecionado?: boolean
  tamanho?: number
}

/**
 * `SEM_ESCALA` e `FOLGA` são quem interessa convocar, então saem em cheio.
 * Quem já está em serviço ou afastado fica esmaecido: continua no mapa (o
 * operador precisa ver onde a equipe está), mas não disputa a atenção.
 */
function opacidade(situacao: Situacao): number {
  if (situacao === "AFASTADO") return 0.4
  if (situacao === "NO_POSTO") return 0.55
  return 1
}

export function iconeColaboradorHtml(m: MarcadorColaborador): string {
  const sexo = isSexo(m.sexo) ? m.sexo : ""
  const cor = COR_SEXO[sexo]
  const tamanho = m.tamanho ?? 28
  const anel = m.santo ? COR_SANTO : "rgba(255,255,255,.9)"
  const espessura = m.santo ? 3 : 2

  return `
<span style="
  display:inline-flex;align-items:center;justify-content:center;
  width:${tamanho}px;height:${tamanho}px;border-radius:9999px;
  background:${cor};border:${espessura}px solid ${anel};
  box-shadow:0 1px 3px rgba(0,0,0,.45)${m.selecionado ? ",0 0 0 4px rgba(255,255,255,.75)" : ""};
  opacity:${opacidade(m.situacao)};
">
  <svg viewBox="0 0 24 24" width="${tamanho - 10}" height="${tamanho - 10}" fill="#fff" aria-hidden="true">
    ${CORPO[sexo]}
  </svg>
</span>`.trim()
}

export type MarcadorPosto = {
  comBaixa: boolean
  quantidade: number
  selecionado?: boolean
}

/**
 * Posto é quadrado e colaborador é redondo — a diferença de forma sobrevive ao
 * daltonismo e ao mapa cheio, que a cor sozinha não sobrevive.
 */
export function iconePostoHtml(m: MarcadorPosto): string {
  const cor = m.comBaixa ? "#dc2626" : "#0f766e"
  const tamanho = m.comBaixa ? 34 : 28

  const contador = m.comBaixa
    ? `<span style="
        position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;
        padding:0 4px;border-radius:9999px;background:#fff;color:#dc2626;
        font:700 11px/18px system-ui,sans-serif;text-align:center;
        box-shadow:0 1px 2px rgba(0,0,0,.4);
      ">${m.quantidade}</span>`
    : ""

  return `
<span style="position:relative;display:inline-block;"${m.comBaixa ? ' class="painel-baixa"' : ""}>
  <span style="
    display:inline-flex;align-items:center;justify-content:center;
    width:${tamanho}px;height:${tamanho}px;border-radius:8px;
    background:${cor};border:2px solid rgba(255,255,255,.9);
    box-shadow:0 1px 4px rgba(0,0,0,.5)${m.selecionado ? ",0 0 0 4px rgba(255,255,255,.75)" : ""};
  ">
    <svg viewBox="0 0 24 24" width="${tamanho - 12}" height="${tamanho - 12}" fill="#fff" aria-hidden="true">
      <path d="M4 20V9.2L12 4l8 5.2V20h-5.5v-5.2h-5V20z"/>
    </svg>
  </span>
  ${contador}
</span>`.trim()
}

/** Versão React dos mesmos ícones, para a lista lateral e a legenda. */
export function IconeColaborador(props: MarcadorColaborador) {
  return (
    <span
      className="inline-flex shrink-0"
      dangerouslySetInnerHTML={{ __html: iconeColaboradorHtml(props) }}
    />
  )
}

export function IconePosto(props: MarcadorPosto) {
  return (
    <span
      className="inline-flex shrink-0"
      dangerouslySetInnerHTML={{ __html: iconePostoHtml(props) }}
    />
  )
}
