import type { z } from "zod"

export type FormState =
  | { errors?: Record<string, string[]>; message?: string }
  | undefined

export function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path[0]?.toString() ?? "_"
    ;(out[key] ??= []).push(issue.message)
  }
  return out
}

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message || "Dados inválidos."
}
