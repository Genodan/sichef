import { BatteryFull, Signal, Wifi } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(t)
  }, [])
  return <>{now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</>
}

/** Barra de estado decorativa, solo dentro del marco de escritorio. */
function StatusBar() {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-[60] hidden h-11 items-center justify-between px-8 text-[15px] font-bold text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.25)] sm:flex"
      aria-hidden
    >
      <span className="tabular-nums">
        <Clock />
      </span>
      <span className="flex items-center gap-1.5">
        <Signal className="size-4" strokeWidth={2.5} />
        <Wifi className="size-4" strokeWidth={2.5} />
        <BatteryFull className="size-5" strokeWidth={2} />
      </span>
    </div>
  )
}

/**
 * En pantallas ≥ 640 px la app vive dentro de un móvil de 390 × 844 centrado;
 * en el móvil real, pantalla completa con márgenes seguros.
 */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh w-full flex-col items-center bg-canvas sm:justify-center sm:gap-4 sm:p-6">
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-white sm:h-[min(844px,calc(100dvh-80px))] sm:w-[390px] sm:rounded-[44px] sm:shadow-phone sm:ring-1 sm:ring-black/10">
        <StatusBar />
        {children}
        <div
          className="pointer-events-none absolute bottom-1.5 left-1/2 z-[60] hidden h-[5px] w-32 -translate-x-1/2 rounded-full bg-ink/80 sm:block"
          aria-hidden
        />
      </div>
      <p className="hidden text-sm font-bold text-muted sm:block">Tú dices sí. SíChef hace el resto.</p>
    </div>
  )
}
