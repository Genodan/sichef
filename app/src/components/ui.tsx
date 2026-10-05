// Piezas pequeñas de interfaz compartidas por las pantallas.

import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'
import type { ToastAction } from '../lib/ui.ts'

/** Cabecera verde de las pestañas (misma familia visual que Descubre). */
export function ScreenHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <header className="shrink-0 bg-brand px-5 pb-5 pt-[calc(var(--top-inset)+14px)] text-white">
      <h1 className="text-[28px] font-black leading-tight">{title}</h1>
      {subtitle && <p className="mt-0.5 text-sm font-semibold text-white/85">{subtitle}</p>}
      {children}
    </header>
  )
}

export function EmptyState({
  icon,
  title,
  children,
  tone = 'light',
}: {
  icon: ReactNode
  title: string
  children?: ReactNode
  tone?: 'light' | 'dark'
}) {
  return (
    <div className={`flex flex-col items-center px-8 py-10 text-center ${tone === 'dark' ? 'text-white' : 'text-ink'}`}>
      <div
        className={`mb-4 grid size-20 place-items-center rounded-full ${tone === 'dark' ? 'bg-white/15 text-white' : 'bg-brand-soft text-brand'}`}
        aria-hidden
      >
        {icon}
      </div>
      <h2 className="text-xl font-extrabold">{title}</h2>
      <div className={`mt-2 text-sm font-semibold ${tone === 'dark' ? 'text-white/85' : 'text-muted'}`}>{children}</div>
    </div>
  )
}

export function PrimaryButton({
  children,
  onClick,
  variant = 'accent',
  className = '',
}: {
  children: ReactNode
  onClick: () => void
  variant?: 'accent' | 'brand' | 'white' | 'ghost'
  className?: string
}) {
  const styles = {
    accent: 'bg-accent text-white shadow-button',
    brand: 'bg-brand text-white shadow-button',
    white: 'bg-white text-brand shadow-button',
    ghost: 'bg-white/15 text-white',
  }[variant]
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 font-extrabold ${styles} ${className}`}
    >
      {children}
    </button>
  )
}

export interface ToastData {
  id: number
  message: string
  action?: ToastAction
}

export function Toast({ toast, onDismiss }: { toast: ToastData | null; onDismiss: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[calc(var(--top-inset)+10px)] z-[55] flex justify-center px-4">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            role="status"
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            className="pointer-events-auto flex max-w-full items-center gap-3 rounded-full bg-ink py-2.5 pl-4 pr-2 text-sm font-bold text-white shadow-card"
          >
            <span className="min-w-0 truncate">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.run()
                  onDismiss()
                }}
                className="shrink-0 rounded-full bg-white/15 px-3 py-1 font-extrabold text-sun"
              >
                {toast.action.label}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
