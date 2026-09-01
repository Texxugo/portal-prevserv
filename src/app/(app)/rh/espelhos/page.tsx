import { redirect } from "next/navigation"

export default async function EspelhosRedirect() {
  redirect("/rh/ponto?aba=importar")
}
