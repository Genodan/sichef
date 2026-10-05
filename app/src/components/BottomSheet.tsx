import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, type ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

/** Hoja modal pequeña que sube desde abajo, dentro del marco del móvil. */
export function BottomSheet({ open, onClose, title, children }: Props) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="sheet"
          className="absolute inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          initial={{ opacity: 1 }}
          exit={{ opacity: 1 }}
        >
          <motion.div
            className="absolute inset-0 bg-ink/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="no-scrollbar absolute inset-x-0 bottom-0 max-h-[85%] overflow-y-auto rounded-t-[30px] bg-white px-5 pb-[calc(var(--bottom-inset)+20px)] pt-3 shadow-card"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 340 }}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line" aria-hidden />
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 id={titleId} className="text-xl font-extrabold leading-tight">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                autoFocus
                aria-label="Cerrar"
                className="grid size-9 shrink-0 place-items-center rounded-full bg-panel text-muted"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
