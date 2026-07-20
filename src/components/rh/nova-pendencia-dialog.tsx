"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DocumentoForm } from "@/components/rh/documento-form"

type Option = { id: string; name: string }

export function NovaPendenciaDialog({
  employees,
  documentTypes,
  competencia,
  openKeys,
}: {
  employees: Option[]
  documentTypes: Option[]
  competencia: string
  openKeys: string[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Nova pendência
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova pendência documental</DialogTitle>
          </DialogHeader>
          {open && (
            <DocumentoForm
              employees={employees}
              documentTypes={documentTypes}
              defaults={{ employeeId: "", competencia }}
              openKeys={openKeys}
              onCreated={() => {
                setOpen(false)
                router.refresh()
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
