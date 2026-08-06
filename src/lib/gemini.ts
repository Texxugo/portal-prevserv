// Correção de texto via Google Gemini. Lê GEMINI_API_KEY do .env;
// modelo configurável por GEMINI_MODEL (padrão: gemini-2.0-flash).

const BASE = "https://generativelanguage.googleapis.com/v1beta/models"

export type CorrecaoResult = { ok: boolean; text?: string; error?: string }

const PROMPT_MENSAGEM = `Você é o revisor de português do setor de RH. Reescreva a mensagem que será enviada a um colaborador deixando-a clara, concisa e sem erros gramaticais, mantendo um tom cordial e formal.

Regras:
- Preserve exatamente nomes de pessoas, datas, nomes de documentos e a competência (mês/ano).
- Não invente nenhuma informação que não esteja no texto original.
- Mantenha o estilo das mensagens de RH, por exemplo: "Olá, Fulano! Precisamos do documento X referente à competência Maio/2026. Por favor, envie o documento por este contato. Em caso de dúvida, estamos à disposição neste contato. Obrigado!".
- Responda APENAS com o texto corrigido, sem aspas e sem comentários.`

const PROMPT_RELATORIO = `Você é o revisor dos relatórios operacionais de uma empresa de portaria e segurança patrimonial. Reescreva o trecho de relatório deixando-o correto, objetivo e profissional, no padrão de registro de ocorrência.

Regras:
- Não invente nada: nenhum fato, número, nome, local ou data que não esteja no texto original.
- Preserve exatamente nomes de pessoas, datas, horários, placas, quilometragens, quadras, lotes, ruas e códigos.
- Use terceira pessoa e tom impessoal ("Foi constatado…", "Informo que…"). Nada de gírias ou abreviações informais.
- Seja conciso: elimine repetição e rodeio, sem perder nenhuma informação.
- Corrija ortografia, acentuação, pontuação e concordância; padronize maiúsculas (não escreva frases inteiras em CAIXA ALTA).
- Se o texto for uma lista de apontamentos, mantenha o formato de lista, um apontamento por linha, cada linha começando com "- ".
- Responda APENAS com o texto corrigido, sem aspas, sem título e sem comentários.`

export type CorrecaoModo = "mensagem" | "relatorio"

const PROMPTS: Record<CorrecaoModo, string> = {
  mensagem: PROMPT_MENSAGEM,
  relatorio: PROMPT_RELATORIO,
}

export async function corrigirMensagem(
  input: string,
  modo: CorrecaoModo = "mensagem"
): Promise<CorrecaoResult> {
  const key = process.env.GEMINI_API_KEY
  if (!key) {
    return {
      ok: false,
      error: "Gemini não configurado. Defina GEMINI_API_KEY no .env.",
    }
  }

  const text = (input ?? "").trim()
  if (!text) return { ok: false, error: "Escreva a mensagem antes de corrigir." }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite"

  try {
    const res = await fetch(`${BASE}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: PROMPTS[modo] }] },
        contents: [{ role: "user", parts: [{ text }] }],
        generationConfig: { temperature: 0.3 },
      }),
    })
    const data = (await res.json().catch(() => null)) as
      | {
          candidates?: { content?: { parts?: { text?: string }[] } }[]
          error?: { message?: string }
        }
      | null
    if (!res.ok) {
      return { ok: false, error: data?.error?.message || `HTTP ${res.status}` }
    }
    const corrected = data?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim()
    if (!corrected) return { ok: false, error: "Resposta vazia do Gemini." }
    return { ok: true, text: corrected }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao corrigir" }
  }
}
