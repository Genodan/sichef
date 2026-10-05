import { Check, Footprints, Pause, Play, RotateCcw, ShoppingCart, Sparkles, Store as StoreIcon, Zap } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Store } from '../types.ts'
import type { ShoppingItem } from '../lib/compute.ts'
import { formatEuro } from '../lib/format.ts'
import { SafeImage } from './SafeImage.tsx'

interface StoreSimulatorProps {
  store: Store
  items: ShoppingItem[]
  checkedProductIds: ReadonlySet<string>
  onToggleProduct: (productId: string) => void
  onFinishPurchase: () => void
}

interface Pt {
  x: number
  y: number
}

// ── Plano (unidades SVG). Tienda simulada: pasillos verticales, entrada abajo a la izquierda, cajas a la derecha.
const VB_W = 100
const VB_H = 140
const MARGIN = 6
const TOP_CROSS = 11 // pasillo transversal de arriba
const BOTTOM_CROSS = 126 // pasillo transversal de abajo
const SHELF_TOP = 18
const SHELF_BOTTOM = 119
const ENTRANCE: Pt = { x: 12, y: 135 }
const CHECKOUT: Pt = { x: 86, y: 135 }
/** Escala del plano simulado: 1 unidad ≈ 0,5 m; paso de compra ≈ 1 m/s. */
const METERS_PER_UNIT = 0.5
const WALK_SPEED = 34 // unidades por segundo en la animación
const STOP_MS = 2200 // pausa frente a cada etiqueta

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

const SHELF_ORDER = ['A', 'B', 'C', 'D']

function useLayout(store: Store) {
  return useMemo(() => {
    const aisles = [...(store.aisles ?? [])].sort((a, b) => a.number - b.number)
    const n = Math.max(1, aisles.length)
    const laneW = (VB_W - MARGIN * 2) / n
    const laneIndex = new Map(aisles.map((a, i) => [a.number, i]))
    const laneX = (aisle: number) => MARGIN + ((laneIndex.get(aisle) ?? 0) + 0.5) * laneW
    return { aisles, laneW, laneX }
  }, [store.aisles])
}

/** Punto del suelo frente al producto (centro del pasillo) y posición de su etiqueta en la estantería. */
function stopFor(item: ShoppingItem, laneX: (a: number) => number, laneW: number) {
  const loc = item.location!
  const y = SHELF_TOP + 6 + (hash(item.product.id) % 1000) / 1000 * (SHELF_BOTTOM - SHELF_TOP - 12)
  const x = laneX(loc.aisle)
  const tagX = x + (loc.side === 'izq' ? -1 : 1) * laneW * 0.32
  return { floor: { x, y }, tag: { x: tagX, y } }
}

/** Camino en «L» por los pasillos transversales (no atraviesa estanterías). */
function legBetween(a: Pt, b: Pt): Pt[] {
  if (Math.abs(a.x - b.x) < 0.5) return [b]
  const viaTop = Math.abs(a.y - TOP_CROSS) + Math.abs(b.y - TOP_CROSS)
  const viaBottom = Math.abs(a.y - BOTTOM_CROSS) + Math.abs(b.y - BOTTOM_CROSS)
  const c = viaTop < viaBottom ? TOP_CROSS : BOTTOM_CROSS
  return [{ x: a.x, y: c }, { x: b.x, y: c }, b]
}

function dist(a: Pt, b: Pt) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

interface Route {
  stops: { item: ShoppingItem; floor: Pt; tag: Pt; at: number }[]
  points: Pt[]
  cumulative: number[]
  length: number
}

function buildRoute(items: ShoppingItem[], laneX: (a: number) => number, laneW: number): Route {
  // Orden en serpiente: pasillos de menor a mayor, subiendo y bajando alternativamente.
  const located = items.filter((i) => i.location)
  const aisleOrder = [...new Set(located.map((i) => i.location!.aisle))].sort((a, b) => a - b)
  const ordered = aisleOrder.flatMap((aisle, k) => {
    const inAisle = located
      .filter((i) => i.location!.aisle === aisle)
      .map((item) => ({ item, ...stopFor(item, laneX, laneW) }))
    inAisle.sort((p, q) => (k % 2 === 0 ? q.floor.y - p.floor.y : p.floor.y - q.floor.y))
    return inAisle
  })

  const points: Pt[] = [ENTRANCE]
  const stops: Route['stops'] = []
  let cur = ENTRANCE
  for (const s of ordered) {
    points.push(...legBetween(cur, s.floor))
    cur = s.floor
    stops.push({ ...s, at: points.length - 1 })
  }
  points.push(...legBetween(cur, CHECKOUT))

  const cumulative = [0]
  for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1] + dist(points[i - 1], points[i]))
  // `at` pasa de índice de punto a distancia recorrida
  for (const s of stops) s.at = cumulative[s.at]
  return { stops, points, cumulative, length: cumulative[cumulative.length - 1] }
}

function pointAt(route: Route, d: number): Pt {
  const { points, cumulative } = route
  if (d <= 0) return points[0]
  for (let i = 1; i < points.length; i++) {
    if (cumulative[i] >= d) {
      const t = (d - cumulative[i - 1]) / (cumulative[i] - cumulative[i - 1] || 1)
      return { x: points[i - 1].x + (points[i].x - points[i - 1].x) * t, y: points[i - 1].y + (points[i].y - points[i - 1].y) * t }
    }
  }
  return points[points.length - 1]
}

/** Recorte del camino hasta la distancia d (para pintar lo ya recorrido). */
function pathUntil(route: Route, d: number): Pt[] {
  const out: Pt[] = [route.points[0]]
  for (let i = 1; i < route.points.length; i++) {
    if (route.cumulative[i] <= d) out.push(route.points[i])
    else {
      out.push(pointAt(route, d))
      break
    }
  }
  return out
}

const toPoints = (pts: Pt[]) => pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')

type Phase = 'idle' | 'walking' | 'stop' | 'done'

export function StoreSimulator({ store, items, checkedProductIds, onToggleProduct, onFinishPurchase }: StoreSimulatorProps) {
  const { aisles, laneW, laneX } = useLayout(store)

  // La ruta se congela al empezar, para que marcar productos no la recalcule a mitad.
  const [frozenIds, setFrozenIds] = useState<string[] | null>(null)
  const routeItems = useMemo(() => {
    const ids = frozenIds
    const source = ids ? items.filter((i) => ids.includes(i.product.id)) : items.filter((i) => !checkedProductIds.has(i.product.id))
    return source
  }, [items, checkedProductIds, frozenIds])
  const route = useMemo(() => buildRoute(routeItems, laneX, laneW), [routeItems, laneX, laneW])

  const [phase, setPhase] = useState<Phase>('idle')
  const [paused, setPaused] = useState(false)
  const [d, setD] = useState(0)
  const [stopIndex, setStopIndex] = useState(0)
  const dRef = useRef(0)
  const stopRef = useRef(0)

  const visitedAisles = new Set(route.stops.map((s) => s.item.location!.aisle)).size
  const meters = Math.round(route.length * METERS_PER_UNIT)
  const minutes = Math.max(1, Math.round((meters + route.stops.length * 20) / 60))
  const current = route.stops[stopIndex] ?? null
  const pickedCount = route.stops.filter((s) => checkedProductIds.has(s.item.product.id)).length
  const pickedTotal = route.stops
    .filter((s) => checkedProductIds.has(s.item.product.id))
    .reduce((sum, s) => sum + s.item.product.unit_price * (s.item.packages ?? 1), 0)

  // Bucle de animación: avanza a velocidad constante y se detiene en cada etiqueta.
  useEffect(() => {
    if (phase !== 'walking' || paused) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      const next = route.stops[stopRef.current]
      const limit = next ? next.at : route.length
      const nd = Math.min(limit, dRef.current + WALK_SPEED * dt)
      dRef.current = nd
      setD(nd)
      if (nd >= limit) {
        if (next) {
          setPhase('stop')
          navigator.vibrate?.(180)
        } else setPhase('done')
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase, paused, route])

  // Frente a la etiqueta: se enciende, y tras una pausa el producto pasa al carro.
  useEffect(() => {
    if (phase !== 'stop' || paused || !current) return
    const t = window.setTimeout(() => pick(), STOP_MS)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paused, stopIndex])

  function pick() {
    const s = route.stops[stopRef.current]
    if (!s) return
    if (!checkedProductIds.has(s.item.product.id)) onToggleProduct(s.item.product.id)
    stopRef.current += 1
    setStopIndex(stopRef.current)
    setPhase('walking')
  }

  function start() {
    if (routeItems.length === 0) return
    setFrozenIds(routeItems.map((i) => i.product.id))
    dRef.current = 0
    stopRef.current = 0
    setD(0)
    setStopIndex(0)
    setPaused(false)
    setPhase('walking')
  }

  function reset() {
    setFrozenIds(null)
    dRef.current = 0
    stopRef.current = 0
    setD(0)
    setStopIndex(0)
    setPaused(false)
    setPhase('idle')
  }

  const avatar = pointAt(route, d)
  const walked = pathUntil(route, d)
  const nothing = route.stops.length === 0 && phase === 'idle'

  return (
    <div className="flex flex-col gap-3">
      {/* HUD: progreso y siguiente producto */}
      <div className="rounded-3xl bg-ink p-3.5 text-white shadow-card">
        <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider">
          <span className="flex items-center gap-1.5 text-sun">
            <Zap className="size-3.5" aria-hidden />
            Guiado por etiquetas digitales
          </span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 tabular-nums">
            {pickedCount}/{route.stops.length} en el carro
          </span>
        </div>
        <div className="mt-2 flex gap-1" aria-hidden>
          {route.stops.map((s, i) => (
            <span
              key={s.item.product.id}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${
                checkedProductIds.has(s.item.product.id) ? 'bg-brand-bright' : i === stopIndex && phase !== 'idle' ? 'bg-sun' : 'bg-white/15'
              }`}
            />
          ))}
        </div>
        <p className="mt-2.5 min-h-10 text-sm font-bold leading-snug" aria-live="polite">
          {phase === 'idle' &&
            (nothing
              ? 'Añade recetas a la cesta para trazar tu ruta.'
              : `Ruta óptima: ${route.stops.length} productos en ${visitedAisles} de ${aisles.length} pasillos · ~${meters} m · ~${minutes} min`)}
          {phase === 'walking' && current && (
            <>
              Vamos al <span className="text-sun">pasillo {current.item.location!.aisle}</span> ·{' '}
              {aisles.find((a) => a.number === current.item.location!.aisle)?.name}
            </>
          )}
          {phase === 'walking' && !current && 'Todo en el carro. ¡A la línea de cajas!'}
          {phase === 'stop' && current && (
            <>
              ✨ Mira la etiqueta que parpadea: lado {current.item.location!.side === 'izq' ? 'izquierdo' : 'derecho'}, balda{' '}
              {current.item.location!.shelf}
            </>
          )}
          {phase === 'done' && `¡Compra completa! ${pickedCount} productos · ${formatEuro(pickedTotal)}`}
        </p>
      </div>

      {/* PLANO */}
      <div className="relative overflow-hidden rounded-3xl bg-white p-2 shadow-soft ring-1 ring-line">
        <div className="flex items-center justify-between px-1.5 pb-1 text-[10px] font-black uppercase text-muted">
          <span className="flex items-center gap-1 text-brand">
            <StoreIcon className="size-3" aria-hidden />
            {store.name}
          </span>
          <span>Plano simulado</span>
        </div>

        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="block w-full" role="img" aria-label="Plano de la tienda con la ruta de compra">
          <defs>
            <filter id="glow" x="-200%" y="-200%" width="500%" height="500%">
              <feGaussianBlur stdDeviation="1.6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect x="1" y="1" width={VB_W - 2} height={VB_H - 2} rx="5" fill="#f6f8f5" stroke="#e7ebe7" />

          {/* Estanterías entre pasillos */}
          {Array.from({ length: aisles.length + 1 }, (_, k) => {
            const x = MARGIN + k * laneW
            const w = laneW * 0.42
            return (
              <rect
                key={k}
                x={x - w / 2}
                y={SHELF_TOP}
                width={w}
                height={SHELF_BOTTOM - SHELF_TOP}
                rx="1.2"
                fill="#dfe6e0"
                stroke="#cdd6cf"
                strokeWidth="0.3"
              />
            )
          })}

          {/* Número de pasillo */}
          {aisles.map((a) => {
            const active = route.stops.some((s) => s.item.location!.aisle === a.number)
            return (
              <g key={a.number}>
                <circle cx={laneX(a.number)} cy={TOP_CROSS + 3} r="2.6" fill={active ? '#1f8a4c' : '#c9d2cb'} />
                <text x={laneX(a.number)} y={TOP_CROSS + 4.1} textAnchor="middle" fontSize="3" fontWeight="900" fill="#fff">
                  {a.number}
                </text>
              </g>
            )
          })}

          {/* Entrada y cajas */}
          <g fontSize="3.2" fontWeight="900">
            <rect x={ENTRANCE.x - 9} y={VB_H - 9} width="18" height="6" rx="3" fill="#e6f4ea" />
            <text x={ENTRANCE.x} y={VB_H - 4.8} textAnchor="middle" fill="#146b3a">ENTRADA</text>
            <rect x={CHECKOUT.x - 9} y={VB_H - 9} width="18" height="6" rx="3" fill="#fdf1d8" />
            <text x={CHECKOUT.x} y={VB_H - 4.8} textAnchor="middle" fill="#b86e00">CAJAS</text>
          </g>

          {/* Ruta completa (por recorrer) y tramo recorrido */}
          <polyline points={toPoints(route.points)} fill="none" stroke="#1f8a4c" strokeOpacity="0.35" strokeWidth="1.1" strokeDasharray="2 1.6" strokeLinecap="round" strokeLinejoin="round">
            <animate attributeName="stroke-dashoffset" from="7.2" to="0" dur="0.8s" repeatCount="indefinite" />
          </polyline>
          <polyline points={toPoints(walked)} fill="none" stroke="#1f8a4c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />

          {/* Etiquetas digitales de los productos de la ruta */}
          {route.stops.map((s, i) => {
            const picked = checkedProductIds.has(s.item.product.id)
            const lit = phase === 'stop' && i === stopIndex
            return (
              <g key={s.item.product.id}>
                <rect
                  x={s.tag.x - 2.4}
                  y={s.tag.y - 1.6}
                  width="4.8"
                  height="3.2"
                  rx="0.6"
                  fill={lit ? '#f8c744' : picked ? '#27a65c' : '#ffffff'}
                  stroke={lit ? '#f7a21b' : picked ? '#1f8a4c' : '#17251c'}
                  strokeWidth="0.35"
                  filter={lit ? 'url(#glow)' : undefined}
                >
                  {lit && <animate attributeName="opacity" values="1;0.35;1" dur="0.5s" repeatCount="indefinite" />}
                </rect>
                <text x={s.tag.x} y={s.tag.y + 0.9} textAnchor="middle" fontSize="2.3" fontWeight="900" fill={picked ? '#fff' : '#17251c'}>
                  {picked ? '✓' : i + 1}
                </text>
              </g>
            )
          })}

          {/* Tú */}
          <g transform={`translate(${avatar.x} ${avatar.y})`}>
            <circle r="4.2" fill="#1f8a4c" opacity="0.18">
              <animate attributeName="r" values="3;5.5;3" dur="1.6s" repeatCount="indefinite" />
            </circle>
            <circle r="2.6" fill="#1f8a4c" stroke="#fff" strokeWidth="0.8" />
            <text y="1" textAnchor="middle" fontSize="2.6">🛒</text>
          </g>
        </svg>

        {/* Etiqueta electrónica ampliada (el momento WOW) */}
        <AnimatePresence>
          {phase === 'stop' && current && (
            <motion.div
              key={current.item.product.id}
              initial={{ y: 40, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -30, x: 60, opacity: 0, scale: 0.6 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="absolute inset-x-3 bottom-3"
            >
              <EslTag item={current.item} />
            </motion.div>
          )}
          {phase === 'done' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-x-3 bottom-3 rounded-3xl bg-brand p-4 text-center text-white shadow-card"
            >
              <Sparkles className="mx-auto size-7 text-sun" aria-hidden />
              <p className="mt-1 text-lg font-black">¡Todo en el carro!</p>
              <p className="text-sm font-bold text-white/85">
                {pickedCount} productos · {visitedAisles} pasillos · ~{meters} m
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controles */}
      <div className="flex gap-2">
        {phase === 'idle' && (
          <button
            type="button"
            onClick={start}
            disabled={nothing}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 text-sm font-black text-white shadow-button disabled:opacity-40"
          >
            <Footprints className="size-5" aria-hidden />
            Empezar ruta en tienda
          </button>
        )}
        {(phase === 'walking' || phase === 'stop') && (
          <>
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-ink py-3 text-sm font-black text-white"
            >
              {paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
              {paused ? 'Seguir' : 'Pausa'}
            </button>
            {phase === 'stop' && (
              <button
                type="button"
                onClick={pick}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand py-3 text-sm font-black text-white"
              >
                <Check className="size-4" strokeWidth={3} aria-hidden />
                ¡Lo tengo!
              </button>
            )}
          </>
        )}
        {phase === 'done' && (
          <button
            type="button"
            onClick={onFinishPurchase}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 text-sm font-black text-white shadow-button"
          >
            <ShoppingCart className="size-5" aria-hidden />
            Terminar compra
          </button>
        )}
        {phase !== 'idle' && (
          <button
            type="button"
            onClick={reset}
            aria-label="Reiniciar la ruta"
            className="grid w-12 place-items-center rounded-2xl bg-panel text-muted"
          >
            <RotateCcw className="size-4" aria-hidden />
          </button>
        )}
      </div>
      <p className="text-center text-[10px] font-semibold text-muted">
        Tienda y ubicaciones simuladas: así funcionaría con las etiquetas digitales y el servidor de cada Mercadona.
      </p>
    </div>
  )
}

/** Etiqueta electrónica de lineal (estilo e-paper) con LED encendido. */
function EslTag({ item }: { item: ShoppingItem }) {
  const { product, location } = item
  const shelfIdx = SHELF_ORDER.indexOf(location?.shelf ?? '')
  return (
    <div className="overflow-hidden rounded-2xl bg-[#f4f4ef] shadow-card ring-4 ring-sun">
      <div className="flex items-center justify-between bg-ink px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white">
        <span className="flex items-center gap-1.5">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-sun" />
            <span className="relative inline-flex size-2.5 rounded-full bg-sun" />
          </span>
          Etiqueta digital · encendida para ti
        </span>
        <span className="text-sun">SíChef</span>
      </div>
      <div className="flex items-center gap-3 p-3">
        <div className="size-16 shrink-0 rounded-xl bg-white p-1 ring-1 ring-line">
          <SafeImage src={product.thumbnail} alt="" kind="producto" className="size-full object-contain" />
        </div>
        <div className="min-w-0 flex-1 font-mono text-ink">
          <p className="line-clamp-2 text-[13px] font-bold leading-tight">{product.name}</p>
          <p className="mt-1 text-2xl font-black tabular-nums">{formatEuro(product.unit_price)}</p>
          <p className="text-[10px] font-semibold text-muted">
            {formatEuro(product.bulk_price)}/{product.reference_format}
            {item.packages && item.packages > 1 ? ` · coge ${item.packages}` : ''}
          </p>
        </div>
        {/* Mini estantería: lado y balda */}
        <div className="flex shrink-0 flex-col items-center gap-0.5" aria-label={`Balda ${location?.shelf ?? ''}`}>
          {[...SHELF_ORDER].reverse().map((s, i) => (
            <span
              key={s}
              className={`h-2.5 w-9 rounded-sm ${SHELF_ORDER.length - 1 - i === shelfIdx ? 'animate-pulse bg-sun' : 'bg-line'}`}
            />
          ))}
          <span className="mt-0.5 text-[9px] font-black text-muted">
            P{location?.aisle} · {location?.side === 'izq' ? 'IZQ' : 'DER'}
          </span>
        </div>
      </div>
    </div>
  )
}
