"use client"

import { useState, useTransition } from "react"
import { Loader2, Search } from "lucide-react"
import { toast } from "sonner"

import { consultarCep } from "@/lib/actions/geo"
import { formatCep, normalizeCep, UFS } from "@/lib/geo/endereco"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Bloco de endereço compartilhado pelo cadastro de posto e pelo de colaborador.
// Os campos são controlados porque a busca por CEP precisa preenchê-los; os
// `name` são os mesmos do schema (enderecoFields), então o form pai só precisa
// incluir este bloco.

export type EnderecoDefaults = {
  cep?: string | null
  logradouro?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null
  return <p className="text-sm text-destructive">{messages[0]}</p>
}

export function EnderecoFields({
  defaults,
  errors,
  disabled,
}: {
  defaults?: EnderecoDefaults
  errors?: Record<string, string[]>
  disabled?: boolean
}) {
  const [cep, setCep] = useState(formatCep(defaults?.cep))
  const [logradouro, setLogradouro] = useState(defaults?.logradouro ?? "")
  const [numero, setNumero] = useState(defaults?.numero ?? "")
  const [complemento, setComplemento] = useState(defaults?.complemento ?? "")
  const [bairro, setBairro] = useState(defaults?.bairro ?? "")
  const [cidade, setCidade] = useState(defaults?.cidade ?? "")
  const [uf, setUf] = useState(defaults?.uf ?? "")
  const [buscando, startBusca] = useTransition()

  function buscar() {
    const limpo = normalizeCep(cep)
    if (limpo.length !== 8) {
      toast.error("Informe os 8 dígitos do CEP.")
      return
    }
    startBusca(async () => {
      const r = await consultarCep(limpo)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      // Rua/bairro/cidade vêm do ViaCEP; número e complemento são de quem mora
      // lá. Sobrescrever o logradouro é o certo: se o CEP mudou, o resto do
      // endereço antigo está errado.
      setLogradouro(r.endereco.logradouro)
      setBairro(r.endereco.bairro)
      setCidade(r.endereco.cidade)
      setUf(r.endereco.uf)
      toast.success("Endereço preenchido pelo CEP.")
    })
  }

  return (
    <div className="grid gap-5 sm:grid-cols-6">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="cep">CEP</Label>
        <div className="flex items-center gap-2">
          <Input
            id="cep"
            name="cep"
            value={cep}
            inputMode="numeric"
            placeholder="00000-000"
            disabled={disabled}
            onChange={(e) => setCep(formatCep(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                buscar()
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Buscar endereço pelo CEP"
            disabled={disabled || buscando}
            onClick={buscar}
          >
            {buscando ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
          </Button>
        </div>
        <FieldError messages={errors?.cep} />
      </div>

      <div className="space-y-2 sm:col-span-3">
        <Label htmlFor="logradouro">Rua / logradouro</Label>
        <Input
          id="logradouro"
          name="logradouro"
          value={logradouro}
          disabled={disabled}
          onChange={(e) => setLogradouro(e.target.value)}
        />
        <FieldError messages={errors?.logradouro} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="numero">Número</Label>
        <Input
          id="numero"
          name="numero"
          value={numero}
          disabled={disabled}
          onChange={(e) => setNumero(e.target.value)}
        />
        <FieldError messages={errors?.numero} />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="complemento">Complemento</Label>
        <Input
          id="complemento"
          name="complemento"
          value={complemento}
          placeholder="Apto, bloco, portaria"
          disabled={disabled}
          onChange={(e) => setComplemento(e.target.value)}
        />
        <FieldError messages={errors?.complemento} />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="bairro">Bairro</Label>
        <Input
          id="bairro"
          name="bairro"
          value={bairro}
          disabled={disabled}
          onChange={(e) => setBairro(e.target.value)}
        />
        <FieldError messages={errors?.bairro} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="cidade">Cidade</Label>
        <Input
          id="cidade"
          name="cidade"
          value={cidade}
          disabled={disabled}
          onChange={(e) => setCidade(e.target.value)}
        />
        <FieldError messages={errors?.cidade} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="uf">UF</Label>
        <Select
          name="uf"
          value={uf}
          onValueChange={(v) => setUf(v ?? "")}
          disabled={disabled}
        >
          <SelectTrigger id="uf" className="w-full">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">—</SelectItem>
            {UFS.map((sigla) => (
              <SelectItem key={sigla} value={sigla}>
                {sigla}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError messages={errors?.uf} />
      </div>
    </div>
  )
}
