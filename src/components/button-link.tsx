import Link from "next/link"
import type { ComponentProps } from "react"

import { Button } from "@/components/ui/button"

type ButtonProps = ComponentProps<typeof Button>

// Botão que navega (renderiza um <Link>). Base UI exige nativeButton={false}
// quando o elemento renderizado não é um <button> nativo.
export function ButtonLink({
  href,
  children,
  ...props
}: { href: string } & Omit<ButtonProps, "render" | "nativeButton">) {
  return (
    <Button {...props} nativeButton={false} render={<Link href={href} />}>
      {children}
    </Button>
  )
}
