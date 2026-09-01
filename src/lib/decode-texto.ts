// Decodifica tentando UTF-8; se aparecer caractere de substituição (arquivo
// latin1), refaz com windows-1252. Os relatórios que o RH exporta (Qyon,
// planilhas de apontamento) chegam ora num, ora noutro.
export function decodeTexto(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes)
  if (!utf8.includes("�")) return utf8
  return new TextDecoder("windows-1252", { fatal: false }).decode(bytes)
}
