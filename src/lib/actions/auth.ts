"use server"

import { AuthError } from "next-auth"

import { signIn, signOut } from "@/auth"

export async function authenticate(
  _prevState: string | undefined,
  formData: FormData
) {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return "E-mail ou senha inválidos."
    }
    throw error
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" })
}
