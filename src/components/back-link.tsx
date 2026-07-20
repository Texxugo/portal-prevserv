"use client"

import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"

// "Voltar/Cancelar" que restaura a navegação anterior (inclusive querystring
// como ?comp=/?date=) via history; fallback p/ deep-link em aba nova.
export function BackLink({
  fallbackHref,
  variant = "ghost",
  children,
  ...props
}: { fallbackHref: string } & Omit<
  React.ComponentProps<typeof Button>,
  "onClick"
>) {
  const router = useRouter()
  return (
    <Button
      {...props}
      variant={variant}
      // dentro de <form>: sem type explícito o clique submeteria o form
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back()
        else router.push(fallbackHref)
      }}
    >
      {children}
    </Button>
  )
}
