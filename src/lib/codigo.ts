import { randomInt } from "node:crypto"

// Alfabeto dos códigos que o portal imprime para alguém redigitar depois
// (autenticidade do relatório diário, correção de ponto). Sem 0/O/1/I/L/U —
// some a confusão de quem relê o código de uma foto do WhatsApp ou de um papel
// já assinado (e o U evita palavrão acidental).
export const ALFABETO_CODIGO = "23456789ABCDEFGHJKMNPQRSTVWXYZ"

// Bloco SORTEADO, nunca derivado do conteúdo. Um sufixo calculado poderia ser
// recomputado por quem descobrisse a regra; sorteado, só existe para quem o
// emitiu — é o banco que responde se ele é válido.
export function blocoAleatorio(tamanho: number): string {
  let out = ""
  for (let i = 0; i < tamanho; i++) {
    out += ALFABETO_CODIGO[randomInt(ALFABETO_CODIGO.length)]
  }
  return out
}
