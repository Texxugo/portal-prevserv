import { redirect } from "next/navigation"

// /rh/fechamento e /rh/espelhos viraram as duas visões de /rh/ponto. O redirect fica:
// as rotas antigas estão em links, no tour e nos favoritos de quem usa todo dia.
export default async function FechamentoRedirect({
  searchParams,
}: {
  searchParams: Promise<{ comp?: string }>
}) {
  const { comp } = await searchParams
  redirect(`/rh/ponto?aba=tratar${comp ? `&comp=${comp}` : ""}`)
}
