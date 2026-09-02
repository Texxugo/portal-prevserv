"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Collapsible } from "@base-ui/react/collapsible"
import {
  CalendarClock,
  CalendarDays,
  CalendarX2,
  Building,
  ChevronDown,
  ClipboardList,
  FileClock,
  FileWarning,
  LayoutDashboard,
  Repeat,
  Shield,
  ShieldCheck,
  SquareKanban,
  UserCheck,
  Users,
} from "lucide-react"
import {
  podeEditar,
  podeVer,
  type Access,
  type ModuloKey,
} from "@/lib/permissions"
import { cn } from "@/lib/utils"

// `modulo: null` = sempre visível para quem está logado (só o Dashboard, que é
// a tela de destino de quem não tem permissão para nada).
// `editOnly` = o item só aparece para quem tem edição naquele módulo.
type NavLeaf = {
  href: string
  label: string
  icon: typeof LayoutDashboard
  modulo: ModuloKey
  editOnly?: boolean
}

type NavEntry =
  | {
      kind: "item"
      href: string
      label: string
      icon: typeof LayoutDashboard
      modulo: ModuloKey | null
      editOnly?: boolean
    }
  | {
      kind: "group"
      id: string
      label: string
      icon: typeof LayoutDashboard
      // o grupo aparece quando o usuário enxerga ao menos um filho
      href?: string
      hrefModulo?: ModuloKey
      children: NavLeaf[]
    }

const NAV: NavEntry[] = [
  { kind: "item", href: "/", label: "Dashboard", icon: LayoutDashboard, modulo: null },
  {
    kind: "item",
    href: "/tarefas",
    label: "Tarefas",
    icon: SquareKanban,
    modulo: "TAREFAS",
  },
  {
    kind: "group",
    id: "operacao",
    label: "Operação de posto",
    icon: UserCheck,
    children: [
      { href: "/rh/efetivos", label: "Efetivos", icon: UserCheck, modulo: "EFETIVOS" },
      {
        href: "/rh/efetivos/ausencias",
        label: "Ausências de cadastro",
        icon: CalendarX2,
        modulo: "EFETIVOS",
      },
      {
        href: "/rh/relatorios",
        label: "Relatórios de posto",
        icon: ShieldCheck,
        modulo: "RELATORIOS",
      },
    ],
  },
  {
    kind: "group",
    id: "rh",
    label: "RH / Pessoas",
    icon: Users,
    href: "/rh",
    hrefModulo: "COLABORADORES",
    children: [
      {
        href: "/rh/ponto",
        label: "Ponto eletrônico",
        icon: FileClock,
        modulo: "PONTO",
      },
      {
        href: "/rh/pendencias",
        label: "Pendências documentais",
        icon: FileWarning,
        modulo: "PENDENCIAS",
        editOnly: true,
      },
    ],
  },
  {
    kind: "group",
    id: "escala",
    label: "Escala",
    icon: CalendarDays,
    children: [
      { href: "/rh/escalas", label: "Escalas", icon: Repeat, modulo: "ESCALAS" },
      {
        href: "/rh/movimentos",
        label: "Movimentos",
        icon: CalendarClock,
        modulo: "MOVIMENTOS",
      },
      {
        href: "/rh/apontamento",
        label: "Apontamento",
        icon: ClipboardList,
        modulo: "APONTAMENTO",
        editOnly: true,
      },
    ],
  },
  {
    kind: "group",
    id: "admin",
    label: "Administração",
    icon: Shield,
    children: [
      {
        href: "/rh/departamentos",
        label: "Departamentos",
        icon: Building,
        modulo: "DEPARTAMENTOS",
        editOnly: true,
      },
      {
        href: "/admin/usuarios",
        label: "Usuários",
        icon: Shield,
        modulo: "USUARIOS",
      },
    ],
  },
]

function matches(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(href + "/")
}

const LINK_CLASSES =
  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"

const ACTIVE_CLASSES =
  "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"

export function SidebarNav({
  access,
  onNavigate,
}: {
  access: Access
  onNavigate?: () => void
}) {
  const pathname = usePathname()

  const visivel = (modulo: ModuloKey, editOnly?: boolean) =>
    editOnly ? podeEditar(access, modulo) : podeVer(access, modulo)

  const entries = NAV.flatMap<
    | Extract<NavEntry, { kind: "item" }>
    | (Extract<NavEntry, { kind: "group" }> & { children: NavLeaf[] })
  >((entry) => {
    if (entry.kind === "item") {
      const ok = entry.modulo === null || visivel(entry.modulo, entry.editOnly)
      return ok ? [entry] : []
    }
    const children = entry.children.filter((leaf) =>
      visivel(leaf.modulo, leaf.editOnly)
    )
    const header =
      entry.href && entry.hrefModulo && podeVer(access, entry.hrefModulo)
        ? { href: entry.href }
        : { href: undefined }
    // grupo sem nenhum filho liberado e sem página própria some do menu
    if (children.length === 0 && !header.href) return []
    return [{ ...entry, ...header, children }]
  })

  // Item ativo = correspondência mais específica (href mais longo)
  const hrefs = entries.flatMap((e) =>
    e.kind === "item"
      ? [e.href]
      : [...(e.href ? [e.href] : []), ...e.children.map((c) => c.href)]
  )
  const activeHref = hrefs
    .filter((href) => matches(pathname, href))
    .reduce((best, href) => (href.length > best.length ? href : best), "")

  const groupContainsActive = (
    group: Extract<NavEntry, { kind: "group" }> & { children: NavLeaf[] }
  ) =>
    group.href === activeHref ||
    group.children.some((c) => c.href === activeHref)

  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      entries
        .filter((e) => e.kind === "group")
        .map((g) => [g.id, groupContainsActive(g)])
    )
  )

  // Garante o grupo da rota ativa expandido ao navegar (não fecha os demais).
  // Ajuste de estado durante o render (padrão React p/ reagir a mudança de prop).
  const [prevActive, setPrevActive] = useState(activeHref)
  if (prevActive !== activeHref) {
    setPrevActive(activeHref)
    const next = { ...open }
    let changed = false
    for (const entry of entries) {
      if (entry.kind === "group" && groupContainsActive(entry) && !next[entry.id]) {
        next[entry.id] = true
        changed = true
      }
    }
    if (changed) setOpen(next)
  }

  function renderLink(
    href: string,
    label: string,
    Icon: typeof LayoutDashboard,
    options?: { child?: boolean }
  ) {
    return (
      <Link
        key={href}
        href={href}
        onClick={onNavigate}
        data-tour={`nav:${href}`}
        className={cn(
          LINK_CLASSES,
          options?.child && "ml-3",
          href === activeHref && ACTIVE_CLASSES
        )}
      >
        <Icon className="size-4 shrink-0" />
        {label}
      </Link>
    )
  }

  return (
    <nav className="flex flex-col gap-1">
      {entries.map((entry) => {
        if (entry.kind === "item") {
          return renderLink(entry.href, entry.label, entry.icon)
        }

        const Icon = entry.icon
        const isOpen = open[entry.id] ?? false
        const chevron = (
          <ChevronDown
            className={cn(
              "size-4 shrink-0 transition-transform",
              isOpen && "rotate-180"
            )}
          />
        )

        return (
          <Collapsible.Root
            key={entry.id}
            open={isOpen}
            onOpenChange={(next) =>
              setOpen((prev) => ({ ...prev, [entry.id]: next }))
            }
            className="flex flex-col gap-1"
          >
            {entry.href ? (
              // Header com página própria: rótulo navega; chevron só alterna.
              // Hover único no container — visual igual ao header sem href.
              <div
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  entry.href === activeHref && ACTIVE_CLASSES
                )}
              >
                <Link
                  href={entry.href}
                  onClick={onNavigate}
                  data-tour={`nav:${entry.href}`}
                  className="flex flex-1 items-center gap-3 px-3 py-2"
                >
                  <Icon className="size-4 shrink-0" />
                  {entry.label}
                </Link>
                <Collapsible.Trigger
                  aria-label={
                    isOpen ? `Recolher ${entry.label}` : `Expandir ${entry.label}`
                  }
                  className="p-2"
                >
                  {chevron}
                </Collapsible.Trigger>
              </div>
            ) : (
              // Header sem página própria: botão inteiro alterna
              <Collapsible.Trigger
                className={cn(LINK_CLASSES, "w-full text-left")}
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1">{entry.label}</span>
                {chevron}
              </Collapsible.Trigger>
            )}

            {/* keepMounted: links precisam existir no DOM p/ o tour checar permissão */}
            <Collapsible.Panel keepMounted className="flex flex-col gap-1">
              {entry.children.map((leaf) =>
                renderLink(leaf.href, leaf.label, leaf.icon, { child: true })
              )}
            </Collapsible.Panel>
          </Collapsible.Root>
        )
      })}
    </nav>
  )
}
