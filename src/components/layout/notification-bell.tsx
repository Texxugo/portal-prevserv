"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell } from "lucide-react"

import {
  getNotificacoes,
  marcarNotificacoesLidas,
  type NotificacaoItem,
} from "@/lib/actions/notificacoes"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function timeLabel(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}

export function NotificationBell() {
  const router = useRouter()
  const [items, setItems] = useState<NotificacaoItem[]>([])
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    let active = true
    const load = async () => {
      const data = await getNotificacoes()
      if (active) {
        setItems(data.items)
        setUnread(data.unread)
      }
    }
    void load()
    const timer = setInterval(() => void load(), 60_000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  function marcarLidas() {
    void marcarNotificacoesLidas()
    setUnread(0)
    setItems((prev) =>
      prev.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() }))
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={
              unread > 0
                ? `Notificações (${unread} não lidas)`
                : "Notificações"
            }
            className="relative"
          />
        }
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-sm font-medium">Notificações</span>
          {unread > 0 && (
            <button
              type="button"
              onClick={marcarLidas}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Marcar todas como lidas
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {items.length === 0 && (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            Nenhuma notificação.
          </p>
        )}
        {items.map((item) => (
          <DropdownMenuItem
            key={item.id}
            className={cn(
              "flex flex-col items-start gap-0.5",
              !item.readAt && "bg-primary/5"
            )}
            onClick={() => router.push(item.href ?? "/rh/pendencias")}
          >
            <span className="text-sm font-medium">{item.title}</span>
            <span className="text-xs text-muted-foreground">
              {item.message}
            </span>
            <span className="text-[10px] text-muted-foreground/70">
              {timeLabel(item.createdAt)}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
