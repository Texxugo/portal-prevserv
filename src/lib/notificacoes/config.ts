import { getSetting } from "@/lib/settings"

// Telefone (WhatsApp) que recebe os lembretes de cobrança de pendências.
// Leitura pura (sem sessão) — usada tanto pelo scheduler quanto pelas pages.
export const COBRANCA_PHONE_KEY = "cobranca_phone"

export async function getCobrancaPhone(): Promise<string> {
  return (await getSetting(COBRANCA_PHONE_KEY))?.trim() ?? ""
}
