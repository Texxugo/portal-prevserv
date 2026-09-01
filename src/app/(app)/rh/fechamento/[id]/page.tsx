import { redirect } from "next/navigation"

export default async function FechamentoDetailRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ comp?: string }>
}) {
  const { id } = await params
  const { comp } = await searchParams
  redirect(`/rh/ponto/${id}${comp ? `?comp=${comp}` : ""}`)
}
