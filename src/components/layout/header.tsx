import type { Role } from "@prisma/client"

import { canEdit } from "@/lib/permissions"
import { MobileNav } from "./mobile-nav"
import { NotificationBell } from "./notification-bell"
import { ThemeToggle } from "./theme-toggle"
import { UserMenu } from "./user-menu"
import { HelpButton } from "@/components/tour/help-button"

export function Header({
  user,
}: {
  user: { name?: string | null; email?: string | null; role: Role }
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <MobileNav role={user.role} />
      <div className="flex-1" />
      {canEdit(user.role, "rh") && <NotificationBell />}
      <HelpButton />
      <ThemeToggle />
      <UserMenu name={user.name} email={user.email} role={user.role} />
    </header>
  )
}
