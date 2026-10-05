import { ArrowRight, ArrowUp, X } from 'lucide-react'
import { AnimatePresence, animate, motion, useMotionValue, useTransform, type Variants } from 'motion/react'
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { AllergenCode } from '../types.ts'
import { LIKE_ADDS_TO_BASKET } from '../lib/appState.ts'
import type { HouseholdSuitability, RecipeInfo } from '../lib/compute.ts'
import { formatEuro } from '../lib/format.ts'
import { RecipeCard } from './RecipeCard.tsx'

export type Decision = 'like' | 'pass'

/** Distancia (px) o velocidad (px/s) a partir de la cual el gesto cuenta como decisión. */
const SWIPE_DISTANCE = 110
const SWIPE_VELOCITY = 650

const stack: Variants = {
  enter: { opacity: 0, scale: 0.9, x: -16, y: 24, rotate: -6 },
  top: { opacity: 1, scale: 1, x: 0, y: 0, rotate: 0, transition: { type: 'spring', stiffness: 280, damping: 26 } },
  second: { opacity: 1, scale: 0.95, x: -14, y: 6, rotate: -4, transition: { type: 'spring', stiffness: 280, damping: 26 } },
  waiting: { opacity: 0, scale: 0.9, x: -16, y: 24, rotate: -6 },
  exit: (dir: number) => ({
    x: dir * 520,
    rotate: dir * 22,
    opacity: 0,
    transition: { duration: 0.32, ease: [0.4, 0, 1, 1] },
  }),
}

interface CardProps {
  info: RecipeInfo
  index: number
  exitDir: number
  mine: readonly AllergenCode[]
  suitability?: HouseholdSuitability
  reason?: string
  onSwiped: (dir: 1 | -1) => void
  onOpen: () => void
}

function DeckCard({ info, index, exitDir, mine, suitability, reason, onSwiped, onOpen }: CardProps) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-260, 0, 260], [-16, 0, 16])
  const yes = useTransform(x, [24, SWIPE_DISTANCE], [0, 1])
  const no = useTransform(x, [-SWIPE_DISTANCE, -24], [1, 0])
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const isTop = index === 0

  return (
    <motion.div
      className="absolute inset-0"
      style={{ zIndex: 10 - index }}
      custom={exitDir}
      variants={stack}
      initial="enter"
      animate={index === 0 ? 'top' : index === 1 ? 'second' : 'waiting'}
      exit="exit"
      aria-hidden={!isTop}
      inert={!isTop}
    >
      <motion.div
        className={`relative h-full ${isTop ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={{ x, rotate }}
        drag={isTop ? 'x' : false}
        dragMomentum={false}
        onDragEnd={(_, i) => {
          const dx = i.offset.x
          const vx = i.velocity.x
          if (dx > SWIPE_DISTANCE || (vx > SWIPE_VELOCITY && dx > 30)) onSwiped(1)
          else if (dx < -SWIPE_DISTANCE || (vx < -SWIPE_VELOCITY && dx < -30)) onSwiped(-1)
          else animate(x, 0, { type: 'spring', stiffness: 500, damping: 32 })
        }}
        onPointerDown={(e) => {
          pointer.current = { x: e.clientX, y: e.clientY }
        }}
        onClick={(e) => {
          const p = pointer.current
          if (isTop && p && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 8) onOpen()
        }}
      >
        <RecipeCard info={info} mine={mine} suitability={suitability} reason={reason} />
        <motion.span
          style={{ opacity: yes }}
          className="pointer-events-none absolute left-6 top-[32%] -rotate-12 rounded-2xl border-4 border-brand-bright bg-white/90 px-4 py-1 text-3xl font-black text-brand-bright"
          aria-hidden
        >
          ¡SÍ!
        </motion.span>
        <motion.span
          style={{ opacity: no }}
          className="pointer-events-none absolute right-6 top-[32%] rotate-12 rounded-2xl border-4 border-pass bg-white/90 px-4 py-1 text-3xl font-black text-pass"
          aria-hidden
        >
          PASO
        </motion.span>
      </motion.div>
    </motion.div>
  )
}

function ActionButton({
  label,
  ariaLabel,
  onClick,
  className,
  children,
  disabled,
}: {
  label: string
  ariaLabel: string
  onClick: () => void
  className: string
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel}
        className={`grid place-items-center rounded-full shadow-button transition-opacity disabled:opacity-40 ${className}`}
      >
        {children}
      </motion.button>
      <span className="text-[15px] font-extrabold text-white" aria-hidden>
        {label}
      </span>
    </div>
  )
}

interface Props {
  items: readonly RecipeInfo[]
  mine: readonly AllergenCode[]
  suitabilities?: ReadonlyMap<string, HouseholdSuitability>
  /** Texto «¿por qué esta receta?» por id (opcional). */
  reasons?: ReadonlyMap<string, string>
  onDecide: (id: string, decision: Decision) => void
  onOpen: (id: string) => void
  /** Se muestra en lugar del mazo cuando no quedan cartas. */
  empty: ReactNode
}

export function SwipeDeck({ items, mine, suitabilities, reasons, onDecide, onOpen, empty }: Props) {
  const [exitDir, setExitDir] = useState<1 | -1>(1)
  const top = items[0]

  const decide = (dir: 1 | -1) => {
    if (!top) return
    setExitDir(dir)
    onDecide(top.recipe.id, dir === 1 ? 'like' : 'pass')
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (!top) return
    if (e.key === 'ArrowRight') decide(1)
    else if (e.key === 'ArrowLeft') decide(-1)
    else if (e.key === 'ArrowUp' || e.key === 'Enter') onOpen(top.recipe.id)
    else return
    e.preventDefault()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="relative mx-5 mt-1 min-h-0 flex-1 rounded-[30px] focus-visible:outline-offset-4"
        role="region"
        aria-roledescription="mazo de recetas"
        aria-label="Recetas para descubrir. Flecha derecha: ¡Sí!; izquierda: Paso; arriba: ver receta."
        tabIndex={top ? 0 : -1}
        onKeyDown={onKeyDown}
      >
        {!top && empty}
        <AnimatePresence custom={exitDir}>
          {items.slice(0, 3).map((info, index) => (
            <DeckCard
              key={info.recipe.id}
              info={info}
              index={index}
              exitDir={exitDir}
              mine={mine}
              suitability={suitabilities?.get(info.recipe.id)}
              reason={reasons?.get(info.recipe.id)}
              onSwiped={decide}
              onOpen={() => onOpen(info.recipe.id)}
            />
          ))}
        </AnimatePresence>
        <p className="sr-only" aria-live="polite">
          {top
            ? `${top.recipe.name}. ${top.cost.perServing !== null ? `${formatEuro(top.cost.perServing)} por ración.` : ''}`
            : 'No quedan recetas.'}
        </p>
      </div>

      <div className="flex items-end justify-center gap-8 px-6 pb-3 pt-3">
        <ActionButton
          label="Paso"
          ariaLabel={top ? `Paso: descartar ${top.recipe.name}` : 'Paso'}
          onClick={() => decide(-1)}
          disabled={!top}
          className="size-16 bg-white text-pass"
        >
          <X className="size-8" strokeWidth={3} aria-hidden />
        </ActionButton>
        <ActionButton
          label="Ver receta"
          ariaLabel={top ? `Ver receta completa de ${top.recipe.name}` : 'Ver receta'}
          onClick={() => top && onOpen(top.recipe.id)}
          disabled={!top}
          className="mb-2 size-12 bg-white text-brand"
        >
          <ArrowUp className="size-6" strokeWidth={3} aria-hidden />
        </ActionButton>
        <ActionButton
          label="¡Sí!"
          ariaLabel={
            top
              ? `¡Sí! Guardar ${top.recipe.name}${LIKE_ADDS_TO_BASKET ? ' y añadirla a la cesta' : ' en el Recetario'}`
              : '¡Sí!'
          }
          onClick={() => decide(1)}
          disabled={!top}
          className="size-[72px] bg-brand-bright text-white ring-4 ring-white/90"
        >
          <ArrowRight className="size-9" strokeWidth={3} aria-hidden />
        </ActionButton>
      </div>
    </div>
  )
}
