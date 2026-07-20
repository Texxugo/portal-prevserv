"use client"

import { useEffect, useLayoutEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

import type { TourStep } from "@/lib/tours"
import { Button } from "@/components/ui/button"

const SPOT_PADDING = 8
const CARD_GAP = 12
const EDGE = 16

export function TourOverlay({
  step,
  index,
  count,
  isLast,
  continueHref,
  onNext,
  onPrev,
  onClose,
  onContinue,
}: {
  step: TourStep
  index: number
  count: number
  isLast: boolean
  continueHref: string | null
  onNext: () => void
  onPrev: () => void
  onClose: () => void
  onContinue: (href: string) => void
}) {
  const spotRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)

  // Posicionamento imperativo (sem re-render): spotlight no rect do alvo,
  // card abaixo (flip p/ cima se estourar), ambos com transition-all no CSS.
  useLayoutEffect(() => {
    const spot = spotRef.current
    const card = cardRef.current
    if (!card) return

    function position() {
      if (!card) return
      const el = step.target ? document.querySelector(step.target) : null

      if (!step.target || !el || el.getClientRects().length === 0) {
        if (spot) spot.style.display = "none"
        card.style.top = "50%"
        card.style.left = "50%"
        card.style.transform = "translate(-50%, -50%)"
        return
      }

      const r = el.getBoundingClientRect()
      const top = r.top - SPOT_PADDING
      const left = r.left - SPOT_PADDING
      const width = r.width + SPOT_PADDING * 2
      const height = r.height + SPOT_PADDING * 2
      if (spot) {
        spot.style.display = "block"
        spot.style.top = `${top}px`
        spot.style.left = `${left}px`
        spot.style.width = `${width}px`
        spot.style.height = `${height}px`
      }

      const { width: cw, height: ch } = card.getBoundingClientRect()
      let cardTop = top + height + CARD_GAP
      if (cardTop + ch > window.innerHeight - EDGE) {
        cardTop = Math.max(EDGE, top - CARD_GAP - ch)
      }
      let cardLeft = left + width / 2 - cw / 2
      cardLeft = Math.min(
        Math.max(EDGE, cardLeft),
        window.innerWidth - cw - EDGE
      )
      card.style.top = `${cardTop}px`
      card.style.left = `${cardLeft}px`
      card.style.transform = "none"
    }

    if (step.target) {
      document
        .querySelector(step.target)
        ?.scrollIntoView({ block: "center", behavior: "smooth" })
    }
    position()

    let raf = 0
    const update = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(position)
    }
    window.addEventListener("scroll", update, { capture: true, passive: true })
    window.addEventListener("resize", update)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("scroll", update, { capture: true })
      window.removeEventListener("resize", update)
    }
  }, [step])

  // Esc fecha; foco no botão primário a cada etapa
  useEffect(() => {
    primaryRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [step, onClose])

  const primaryLabel = !isLast
    ? "Próximo"
    : continueHref
      ? "Continuar →"
      : "Concluir"
  const onPrimary = () => {
    if (!isLast) return onNext()
    if (continueHref) return onContinue(continueHref)
    onClose()
  }

  return createPortal(
    <div>
      {/* bloqueia interação com a página durante o tour */}
      <div className="fixed inset-0 z-[60]" aria-hidden />

      {step.target ? (
        // o box-shadow gigante é o escurecimento com recorte no alvo
        <div
          ref={spotRef}
          aria-hidden
          className="pointer-events-none fixed z-[60] rounded-lg transition-all duration-300"
          style={{ boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)" }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 z-[60] bg-black/50" />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={step.title ?? "Tutorial"}
        className="fixed z-[61] w-80 max-w-[calc(100vw-2rem)] rounded-xl bg-card p-4 text-card-foreground shadow-lg ring-1 ring-foreground/10 transition-all duration-300"
      >
        <div className="flex items-start justify-between gap-2">
          {step.title && <p className="text-sm font-semibold">{step.title}</p>}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Fechar tutorial"
            className="-mt-1 -mr-1 ml-auto shrink-0"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
        <div className="mt-4 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {index + 1} de {count}
          </span>
          <div className="flex-1" />
          {index > 0 && (
            <Button variant="outline" size="sm" onClick={onPrev}>
              Voltar
            </Button>
          )}
          <Button ref={primaryRef} size="sm" onClick={onPrimary}>
            {primaryLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
