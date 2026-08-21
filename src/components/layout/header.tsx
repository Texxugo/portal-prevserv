import { podeEditar, type Access } from "@/lib/permissions"
import { MobileNav } from "./mobile-nav"
import { NotificationBell } from "./notification-bell"
import { ThemeToggle } from "./theme-toggle"
import { UserMenu } from "./user-menu"
import { HelpButton } from "@/components/tour/help-button"

export function Header({ access }: { access: Access }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <MobileNav access={access} />
      <div className="flex-1" />
      {/* o sino cobra documento pendente: só faz sentido para quem trata a cobrança */}
      {podeEditar(access, "PENDENCIAS") && <NotificationBell />}
      <HelpButton />
      <ThemeToggle />
      <UserMenu name={access.name} email={access.email} role={access.role} />
    </header>
  )
}
