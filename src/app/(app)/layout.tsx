import { Building2 } from "lucide-react"

import { requireUser } from "@/lib/auth-helpers"
import { Header } from "@/components/layout/header"
import { SidebarNav } from "@/components/layout/sidebar-nav"
import { TourProvider } from "@/components/tour/tour-provider"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireUser()

  return (
    <TourProvider>
      <div className="flex min-h-svh">
        <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
          <div className="flex h-14 items-center gap-2 px-5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Building2 className="size-4" />
            </div>
            <span className="font-medium">Portal Interno</span>
          </div>
          <div className="flex-1 px-3 py-2">
            <SidebarNav role={user.role} />
          </div>
          <div className="p-4 text-xs text-sidebar-foreground/60">v0.1 · MVP</div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <Header
            user={{ name: user.name, email: user.email, role: user.role }}
          />
          <main className="flex-1 bg-muted/30 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </TourProvider>
  )
}
