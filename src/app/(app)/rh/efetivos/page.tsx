import Link from "next/link"
import { Building2 } from "lucide-react"

import { requireSector } from "@/lib/auth-helpers"
import { prisma } from "@/lib/db"
import { PageHeader } from "@/components/layout/page-header"

export default async function EfetivosPage() {
  await requireSector("rh")

  const departments = await prisma.department.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, _count: { select: { efetivos: true } } },
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Efetivos"
        description="Escolha o posto para consultar e cadastrar os efetivos do dia."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((d) => (
          <Link
            key={d.id}
            href={`/rh/efetivos/${d.id}`}
            data-tour="efetivos-card"
            className="flex items-center gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10 transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium uppercase">
                {d.name}
              </span>
              <span className="block text-sm text-muted-foreground">
                {d._count.efetivos === 1
                  ? "1 efetivo registrado"
                  : `${d._count.efetivos} efetivos registrados`}
              </span>
            </span>
          </Link>
        ))}
        {departments.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum posto cadastrado. Cadastre os postos em Departamentos.
          </p>
        )}
      </div>
    </div>
  )
}
