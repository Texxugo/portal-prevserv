"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { usePathname, useRouter } from "next/navigation"

import { findTour, type Tour, type TourStep } from "@/lib/tours"
import { TourOverlay } from "./tour-overlay"

const RESUME_KEY = "tour:resume"

type TourContextValue = {
  hasTour: boolean
  active: boolean
  start: () => void
}

const TourContext = createContext<TourContextValue | null>(null)

export function useTour() {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error("useTour deve ser usado dentro de <TourProvider>")
  return ctx
}

function isVisible(selector: string): boolean {
  const el = document.querySelector(selector)
  return !!el && el.getClientRects().length > 0
}

// Etapas cujo alvo existe e está visível (permissões/campos condicionais)
function resolveSteps(tour: Tour): TourStep[] {
  return tour.steps.filter((s) => !s.target || isVisible(s.target))
}

type ActiveTour = {
  tour: Tour
  steps: TourStep[]
  index: number
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [active, setActive] = useState<ActiveTour | null>(null)
  const resumeTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const stop = useCallback(() => setActive(null), [])

  const start = useCallback(() => {
    const tour = findTour(pathname)
    if (!tour) return
    const steps = resolveSteps(tour)
    if (steps.length === 0) return
    setActive({ tour, steps, index: 0 })
  }, [pathname])

  // Navegou: encerra tour aberto (ajuste de estado durante o render)
  const [prevPath, setPrevPath] = useState(pathname)
  if (prevPath !== pathname) {
    setPrevPath(pathname)
    setActive(null)
  }

  // Se a navegação veio de um "Continuar", retoma o roteiro da nova página
  // (retry até a página hidratar e os alvos existirem).
  useEffect(() => {
    if (resumeTimer.current) clearInterval(resumeTimer.current)
    if (sessionStorage.getItem(RESUME_KEY) !== "1") return
    sessionStorage.removeItem(RESUME_KEY)

    const tour = findTour(pathname)
    if (!tour) return
    const targets = tour.steps.filter((s) => s.target)

    let tries = 0
    resumeTimer.current = setInterval(() => {
      tries += 1
      const ready =
        targets.length === 0 || targets.some((s) => isVisible(s.target!))
      if (ready || tries > 14) {
        if (resumeTimer.current) clearInterval(resumeTimer.current)
        const steps = resolveSteps(tour)
        if (steps.length > 0) setActive({ tour, steps, index: 0 })
      }
    }, 150)
    return () => {
      if (resumeTimer.current) clearInterval(resumeTimer.current)
    }
  }, [pathname])

  const next = useCallback(() => {
    setActive((prev) => {
      if (!prev) return prev
      // re-checa visibilidade (campos condicionais podem ter sumido)
      for (let i = prev.index + 1; i < prev.steps.length; i++) {
        const s = prev.steps[i]
        if (!s.target || isVisible(s.target)) return { ...prev, index: i }
      }
      return prev
    })
  }, [])

  const prevStep = useCallback(() => {
    setActive((prev) => {
      if (!prev) return prev
      for (let i = prev.index - 1; i >= 0; i--) {
        const s = prev.steps[i]
        if (!s.target || isVisible(s.target)) return { ...prev, index: i }
      }
      return prev
    })
  }, [])

  const continueTo = useCallback(
    (href: string) => {
      sessionStorage.setItem(RESUME_KEY, "1")
      setActive(null)
      router.push(href)
    },
    [router]
  )

  const isLast = active ? active.index === active.steps.length - 1 : false
  const continueHref =
    active && isLast && active.tour.nextHref
      ? active.tour.nextHref(pathname)
      : null

  return (
    <TourContext.Provider
      value={{ hasTour: !!findTour(pathname), active: !!active, start }}
    >
      {children}
      {active && (
        <TourOverlay
          step={active.steps[active.index]}
          index={active.index}
          count={active.steps.length}
          isLast={isLast}
          continueHref={continueHref}
          onNext={next}
          onPrev={prevStep}
          onClose={stop}
          onContinue={continueTo}
        />
      )}
    </TourContext.Provider>
  )
}
