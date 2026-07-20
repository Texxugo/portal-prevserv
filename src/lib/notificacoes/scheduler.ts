import { tickCobranca } from "./cobranca"

const g = globalThis as unknown as {
  __cobrancaTimer?: ReturnType<typeof setInterval>
}

// Iniciado 1x por instância do servidor via src/instrumentation.ts.
// Kill switch: COBRANCA_SCHEDULER=off no .env.
export function startCobrancaScheduler() {
  if (process.env.COBRANCA_SCHEDULER === "off") return
  if (g.__cobrancaTimer) return // dev/hot-reload: já rodando

  const run = () => {
    tickCobranca().catch((e) => console.error("[cobranca] tick falhou:", e))
  }

  const timer = setInterval(run, 60_000)
  timer.unref?.()
  g.__cobrancaTimer = timer

  // primeiro tick logo após o boot (não pode atrasar o register())
  setTimeout(run, 10_000).unref?.()
  console.log("[cobranca] scheduler iniciado (intervalo 60s)")
}
