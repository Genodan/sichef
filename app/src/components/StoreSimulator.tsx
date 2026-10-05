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

// ─────────────────────────────────────────────────────────────────────────────
// Planimetría simulada inspirada en un Mercadona real (vista cenital, en vertical):
//  · fondo: obrador/panadería y mostradores de carnicería, pescadería y charcutería
//  · pared izquierda: fruta y verdura (mural + mesas), junto a la entrada
//  · pared derecha: murales refrigerados (lácteos, huevos) y congelados
//  · centro: dos bloques de góndolas separados por un pasillo transversal
//  · frente: línea de cajas, entrada y salida
// Unidades SVG: 1 u ≈ 0,5 m.
// ─────────────────────────────────────────────────────────────────────────────
const VB_W = 100
const VB_H = 152
const METERS_PER_UNIT = 0.5
const WALK_SPEED = 34 // u/s en la animación
const STOP_MS = 2200
const SHELF_ORDER = ['A', 'B', 'C', 'D']

const Y_BACK = 20 // pasillo frente a los mostradores
const Y_MID = 66 // pasillo transversal central
const Y_FRONT = 110 // pasillo frente a las cajas
const LANE_PRODUCE = 22
const LANE_FRIDGE = 84
const CENTER_LANES = [32, 42, 52, 62, 72]
const GONDOLA_X = [27, 37, 47, 57, 67, 77]
const BLOCKS: [number, number][] = [
  [26, 62],
  [70, 106],
]
const ENTRANCE: Pt = { x: 14, y: 140 }
const CHECKOUT: Pt = { x: 62, y: 124 }

/** Pasillos por los que se puede caminar (segmentos horizontales y verticales). */
interface Seg {
  a: Pt
  b: Pt
}
const SEGMENTS: Seg[] = [
  { a: { x: 10, y: Y_BACK }, b: { x: 86, y: Y_BACK } },
  { a: { x: LANE_PRODUCE, y: Y_MID }, b: { x: LANE_FRIDGE, y: Y_MID } },
  { a: { x: 10, y: Y_FRONT }, b: { x: 86, y: Y_FRONT } },
  ...[LANE_PRODUCE, ...CENTER_LANES, LANE_FRIDGE].map((x) => ({ a: { x, y: Y_BACK }, b: { x, y: Y_FRONT } })),
  { a: { x: ENTRANCE.x, y: Y_FRONT }, b: ENTRANCE },
  { a: { x: CHECKOUT.x, y: Y_FRONT }, b: CHECKOUT },
]

/** Zona del plano donde se colocan los productos de una sección. */
interface Zone {
  /** 'lane' = a lo largo de un pasillo vertical; 'cross' = a lo largo del pasillo del fondo. */
  kind: 'lane' | 'cross'
  fixed: number
  from: number
  to: number
  /** Dirección fija de la etiqueta (murales y mostradores); si no, según el lado izq/der. */
  tag?: Pt
}

const PERIMETER: { match: RegExp; zone: Zone; fallback: string }[] = [
  { match: /fruta|verdura/i, fallback: 'Fruta y verdura', zone: { kind: 'lane', fixed: LANE_PRODUCE, from: 30, to: 100, tag: { x: -4.6, y: 0 } } },
  { match: /pan|horno|boller/i, fallback: 'Horno', zone: { kind: 'cross', fixed: Y_BACK, from: 11, to: 17, tag: { x: 0, y: -5 } } },
  { match: /carne|aves|carnicer/i, fallback: 'Carnicería', zone: { kind: 'cross', fixed: Y_BACK, from: 25, to: 41, tag: { x: 0, y: -5 } } },
  { match: /pescad|marisc/i, fallback: 'Pescadería', zone: { kind: 'cross', fixed: Y_BACK, from: 45, to: 61, tag: { x: 0, y: -5 } } },
  { match: /charcut|embutid|queso/i, fallback: 'Charcutería', zone: { kind: 'cross', fixed: Y_BACK, from: 65, to: 81, tag: { x: 0, y: -5 } } },
  { match: /l[aá]cte|leche|huevo|yogur|refriger/i, fallback: 'Lácteos y huevos', zone: { kind: 'lane', fixed: LANE_FRIDGE, from: 25, to: 61, tag: { x: 4.6, y: 0 } } },
  { match: /congel/i, fallback: 'Congelados', zone: { kind: 'lane', fixed: LANE_FRIDGE, from: 71, to: 105, tag: { x: 4.6, y: 0 } } },
]
/** Huecos de góndola central: bloque de arriba (izq→der) y luego bloque de abajo. */
const CENTER_SLOTS: Zone[] = BLOCKS.flatMap(([from, to]) =>
  CENTER_LANES.map((x) => ({ kind: 'lane' as const, fixed: x, from: from + 2, to: to - 2 })),
)
/** Rótulos de relleno para las góndolas sin sección en los datos (como en una tienda real). */
const FILLER = ['Desayunos', 'Bebidas', 'Droguería', 'Perfumería', 'Mascotas', 'Dulces', 'Snacks', 'Limpieza', 'Infantil', 'Agua']

interface Layout {
  zoneOf: Map<number, Zone>
  perimeterLabels: { label: string; aisle: number | null; zone: Zone }[]
  slotLabels: { label: string; aisle: number | null; zone: Zone }[]
}

function useLayout(store: Store): Layout {
  return useMemo(() => {
    const aisles = [...(store.aisles ?? [])].sort((a, b) => a.number - b.number)
    const zoneOf = new Map<number, Zone>()
    const usedPerimeter = new Set<number>()
    const general: { number: number; name: string }[] = []
    for (const a of aisles) {
      const i = PERIMETER.findIndex((p, idx) => !usedPerimeter.has(idx) && p.match.test(a.name))
      if (i >= 0) {
        usedPerimeter.add(i)
        zoneOf.set(a.number, PERIMETER[i].zone)
      } else general.push(a)
    }
    general.forEach((a, i) => zoneOf.set(a.number, CENTER_SLOTS[i % CENTER_SLOTS.length]))

    const perimeterLabels = PERIMETER.map((p) => {
      const a = aisles.find((x) => zoneOf.get(x.number) === p.zone)
      return { label: a?.name ?? p.fallback, aisle: a?.number ?? null, zone: p.zone }
    })
    let filler = 0
    const slotLabels = CENTER_SLOTS.map((zone, i) => {
      const a = general[i]
      return { label: a?.name ?? FILLER[filler++ % FILLER.length], aisle: a?.number ?? null, zone }
    })
    return { zoneOf, perimeterLabels, slotLabels }
  }, [store.aisles])
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

/** Punto del suelo frente al producto y posición de su etiqueta en el lineal. */
function stopFor(item: ShoppingItem, zone: Zone) {
  const t = (hash(item.product.id) % 1000) / 1000
  const along = zone.from + t * (zone.to - zone.from)
  const floor = zone.kind === 'lane' ? { x: zone.fixed, y: along } : { x: along, y: zone.fixed }
  const dir = zone.tag ?? { x: item.location?.side === 'izq' ? -3.2 : 3.2, y: 0 }
  return { floor, tag: { x: floor.x + dir.x, y: floor.y + dir.y } }
}

// ── Caminos: grafo de pasillos + Dijkstra (nunca atraviesa estanterías)
const k = (p: Pt) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`
const isH = (s: Seg) => Math.abs(s.a.y - s.b.y) < 0.01
function onSeg(p: Pt, s: Seg) {
  const [x0, x1] = [Math.min(s.a.x, s.b.x), Math.max(s.a.x, s.b.x)]
  const [y0, y1] = [Math.min(s.a.y, s.b.y), Math.max(s.a.y, s.b.y)]
  return p.x >= x0 - 0.01 && p.x <= x1 + 0.01 && p.y >= y0 - 0.01 && p.y <= y1 + 0.01 && (isH(s) ? Math.abs(p.y - s.a.y) < 0.01 : Math.abs(p.x - s.a.x) < 0.01)
}

function buildGraph(extra: Pt[]) {
  const nodes = new Map<string, Pt>()
  const adj = new Map<string, { to: string; w: number }[]>()
  for (const s of SEGMENTS) {
    const pts: Pt[] = [s.a, s.b, ...extra.filter((p) => onSeg(p, s))]
    for (const o of SEGMENTS) {
      if (isH(s) === isH(o)) continue
      const p = isH(s) ? { x: o.a.x, y: s.a.y } : { x: s.a.x, y: o.a.y }
      if (onSeg(p, s) && onSeg(p, o)) pts.push(p)
    }
    pts.sort((p, q) => (isH(s) ? p.x - q.x : p.y - q.y))
    for (let i = 0; i < pts.length; i++) {
      nodes.set(k(pts[i]), pts[i])
      if (i === 0) continue
      const [a, b] = [k(pts[i - 1]), k(pts[i])]
      if (a === b) continue
      const w = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
      adj.set(a, [...(adj.get(a) ?? []), { to: b, w }])
      adj.set(b, [...(adj.get(b) ?? []), { to: a, w }])
    }
  }
  return { nodes, adj }
}

function shortest(g: ReturnType<typeof buildGraph>, from: Pt) {
  const dist = new Map<string, number>([[k(from), 0]])
  const prev = new Map<string, string>()
  const open = new Set(g.nodes.keys())
  while (open.size) {
    let u: string | null = null
    for (const n of open) if (dist.has(n) && (u === null || dist.get(n)! < dist.get(u)!)) u = n
    if (u === null) break
    open.delete(u)
    for (const { to, w } of g.adj.get(u) ?? []) {
      const nd = dist.get(u)! + w
      if (nd < (dist.get(to) ?? Infinity)) {
        dist.set(to, nd)
        prev.set(to, u)
      }
    }
  }
  const pathTo = (p: Pt): Pt[] => {
    const out: Pt[] = []
    for (let c: string | undefined = k(p); c; c = prev.get(c)) out.unshift(g.nodes.get(c)!)
    return out
  }
  return { dist: (p: Pt) => dist.get(k(p)) ?? Infinity, pathTo }
}

interface Route {
  stops: { item: ShoppingItem; floor: Pt; tag: Pt; at: number }[]
  points: Pt[]
  cumulative: number[]
  length: number
}

function buildRoute(items: ShoppingItem[], layout: Layout): Route {
  const pending = items
    .filter((i) => i.location && layout.zoneOf.has(i.location.aisle))
    .map((item) => ({ item, ...stopFor(item, layout.zoneOf.get(item.location!.aisle)!) }))
  const g = buildGraph([ENTRANCE, CHECKOUT, ...pending.map((p) => p.floor)])

  // Vecino más cercano por distancia real caminando.
  const points: Pt[] = [ENTRANCE]
  const ordered: typeof pending = []
  let cur = ENTRANCE
  const left = [...pending]
  while (left.length) {
    const sp = shortest(g, cur)
    left.sort((a, b) => sp.dist(a.floor) - sp.dist(b.floor))
    const next = left.shift()!
    points.push(...sp.pathTo(next.floor).slice(1))
    ordered.push(next)
    cur = next.floor
  }
  const stopIdx = [] as number[]
  {
    // índices de cada parada dentro de `points`
    let from = 0
    for (const s of ordered) {
      const i = points.findIndex((p, j) => j >= from && k(p) === k(s.floor))
      stopIdx.push(i)
      from = i
    }
  }
  points.push(...shortest(g, cur).pathTo(CHECKOUT).slice(1))

  const cumulative = [0]
  for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y))
  const stops = ordered.map((s, i) => ({ ...s, at: cumulative[stopIdx[i]] }))
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

// ── Dibujo de la planimetría (estilo plano técnico, discreto)
const INK = '#17251c'
const LINE = '#9aa69e'
const FILL = '#e9eee9'

function Shelf({ x, y, w, h, step = 3 }: { x: number; y: number; w: number; h: number; step?: number }) {
  const vertical = h > w
  const n = Math.floor((vertical ? h : w) / step)
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={FILL} stroke={LINE} strokeWidth="0.25" />
      {Array.from({ length: n - 1 }, (_, i) =>
        vertical ? (
          <line key={i} x1={x} x2={x + w} y1={y + (i + 1) * step} y2={y + (i + 1) * step} stroke={LINE} strokeWidth="0.15" />
        ) : (
          <line key={i} y1={y} y2={y + h} x1={x + (i + 1) * step} x2={x + (i + 1) * step} stroke={LINE} strokeWidth="0.15" />
        ),
      )}
      {vertical ? (
        <line x1={x + w / 2} x2={x + w / 2} y1={y} y2={y + h} stroke={LINE} strokeWidth="0.2" />
      ) : (
        <line y1={y + h / 2} y2={y + h / 2} x1={x} x2={x + w} stroke={LINE} strokeWidth="0.2" />
      )}
    </g>
  )
}

function Label({ x, y, text, active, rotate }: { x: number; y: number; text: string; active: boolean; rotate?: number }) {
  return (
    <text
      x={x}
      y={y}
      transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined}
      textAnchor="middle"
      fontSize="2.2"
      fontWeight="900"
      letterSpacing="0.1"
      fill={active ? '#146b3a' : '#7d8a82'}
    >
      {text.toUpperCase()}
    </text>
  )
}

function FloorPlan({ layout, activeAisles }: { layout: Layout; activeAisles: Set<number> }) {
  const isActive = (a: number | null) => a !== null && activeAisles.has(a)
  const per = (re: RegExp) => layout.perimeterLabels[PERIMETER.findIndex((p) => p.match.source === re.source)]
  const [produce, bakery, meat, fish, deli, dairy, frozen] = PERIMETER.map((p) => per(p.match))
  return (
    <g>
      <defs>
        <pattern id="hatch" width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="2.4" stroke="#c4ccc6" strokeWidth="0.5" />
        </pattern>
      </defs>
      {/* Almacén y muelle (fuera de la sala de ventas) */}
      <rect x="0" y="0" width={VB_W} height="3.2" fill="url(#hatch)" />
      <rect x={VB_W - 2.4} y="0" width="2.4" height={VB_H} fill="url(#hatch)" />
      {/* Sala de ventas */}
      <rect x="2" y="3.2" width={VB_W - 4.4} height="142" fill="#fbfcfa" stroke={INK} strokeWidth="0.7" />

      {/* Horno / obrador */}
      <rect x="4" y="5" width="15" height="10" rx="0.8" fill="#f6ead2" stroke={LINE} strokeWidth="0.25" />
      <Label x={11.5} y={10.8} text={bakery.label} active={isActive(bakery.aisle)} />

      {/* Mostradores del fondo */}
      {[
        { z: meat, x: 23 },
        { z: fish, x: 43 },
        { z: deli, x: 63 },
      ].map(({ z, x }) => (
        <g key={x}>
          <rect x={x} y="5" width="20" height="5.5" fill="#dde7ef" stroke={LINE} strokeWidth="0.25" />
          <path d={`M${x} 10.5 Q${x + 10} 15.5 ${x + 20} 10.5`} fill="#eef3f7" stroke={LINE} strokeWidth="0.25" />
          <Label x={x + 10} y={8.6} text={z.label} active={isActive(z.aisle)} />
        </g>
      ))}
      <Shelf x={85} y={5} w={9} h={6} />

      {/* Fruta y verdura: mural + mesas */}
      <Shelf x={3.4} y={24} w={3} h={82} step={4} />
      {[30, 42, 54, 66, 78, 90].map((y) => (
        <rect key={y} x="9" y={y} width="8.5" height="8" rx="1.2" fill="#e3f1e2" stroke={LINE} strokeWidth="0.25" />
      ))}
      <Label x={13} y={27.6} text={produce.label} active={isActive(produce.aisle)} />

      {/* Murales refrigerados y congelados */}
      <Shelf x={89} y={22} w={5} h={42} step={4} />
      <Label x={91.5} y={43} text={dairy.label} active={isActive(dairy.aisle)} rotate={90} />
      <rect x="88.6" y="69" width="5.8" height="37" fill="#e4eef6" stroke={LINE} strokeWidth="0.25" />
      <line x1="91.5" x2="91.5" y1="69" y2="106" stroke={LINE} strokeWidth="0.2" />
      <Label x={91.5} y={87.5} text={frozen.label} active={isActive(frozen.aisle)} rotate={90} />

      {/* Góndolas centrales */}
      {BLOCKS.map(([y0, y1]) => GONDOLA_X.map((x) => <Shelf key={`${x}-${y0}`} x={x - 2} y={y0} w={4} h={y1 - y0} />))}
      {layout.slotLabels.map((s, i) => {
        const upper = i < CENTER_LANES.length
        const y = upper ? 24.4 : 108.6
        const act = isActive(s.aisle)
        return (
          <g key={i}>
            {s.aisle !== null && (
              <>
                <circle cx={s.zone.fixed} cy={upper ? 64 : 68} r="1.9" fill={act ? '#1f8a4c' : '#c9d2cb'} />
                <text x={s.zone.fixed} y={upper ? 64.8 : 68.8} textAnchor="middle" fontSize="2.2" fontWeight="900" fill="#fff">
                  {s.aisle}
                </text>
              </>
            )}
            <text x={s.zone.fixed} y={y} textAnchor="middle" fontSize="1.7" fontWeight="800" fill={act ? '#146b3a' : '#9aa69e'}>
              {s.label.split(/[ ,]/)[0].toUpperCase()}
            </text>
          </g>
        )
      })}

      {/* Línea de cajas */}
      {[34, 42, 50, 58, 66, 74, 82].map((x) => (
        <g key={x}>
          <rect x={x - 1.2} y="116" width="2.4" height="10" rx="0.4" fill="#fdf1d8" stroke={LINE} strokeWidth="0.25" />
          <rect x={x + 1.6} y="121" width="2.2" height="2.2" fill="#f2c26b" />
        </g>
      ))}
      <text x="58" y="131" textAnchor="middle" fontSize="2.4" fontWeight="900" fill="#b86e00">
        LÍNEA DE CAJAS
      </text>

      {/* Accesos */}
      <rect x="7" y="143.6" width="14" height="2.6" fill="#fbfcfa" />
      <path d="M8 146 L8 142 M20 146 L20 142" stroke={INK} strokeWidth="0.4" />
      <text x="14" y="149.6" textAnchor="middle" fontSize="2.4" fontWeight="900" fill="#146b3a">
        ENTRADA ↑
      </text>
      <rect x="80" y="143.6" width="12" height="2.6" fill="#fbfcfa" />
      <text x="86" y="149.6" textAnchor="middle" fontSize="2.4" fontWeight="900" fill="#7d8a82">
        SALIDA ↓
      </text>
    </g>
  )
}

type Phase = 'idle' | 'walking' | 'stop' | 'done'

export function StoreSimulator({ store, items, checkedProductIds, onToggleProduct, onFinishPurchase }: StoreSimulatorProps) {
  const layout = useLayout(store)
  const totalAisles = store.aisles?.length ?? 0

  // La ruta se congela al empezar, para que marcar productos no la recalcule a mitad.
  const [frozenIds, setFrozenIds] = useState<string[] | null>(null)
  const routeItems = useMemo(() => {
    const ids = frozenIds
    return ids ? items.filter((i) => ids.includes(i.product.id)) : items.filter((i) => !checkedProductIds.has(i.product.id))
  }, [items, checkedProductIds, frozenIds])
  const route = useMemo(() => buildRoute(routeItems, layout), [routeItems, layout])

  const [phase, setPhase] = useState<Phase>('idle')
  const [paused, setPaused] = useState(false)
  const [d, setD] = useState(0)
  const [stopIndex, setStopIndex] = useState(0)
  const dRef = useRef(0)
  const stopRef = useRef(0)

  const activeAisles = useMemo(() => new Set(route.stops.map((s) => s.item.location!.aisle)), [route])
  const visitedAisles = activeAisles.size
  const meters = Math.round(route.length * METERS_PER_UNIT)
  const minutes = Math.max(1, Math.round((meters + route.stops.length * 20) / 60))
  const current = route.stops[stopIndex] ?? null
  const pickedCount = route.stops.filter((s) => checkedProductIds.has(s.item.product.id)).length
  const pickedTotal = route.stops
    .filter((s) => checkedProductIds.has(s.item.product.id))
    .reduce((sum, s) => sum + s.item.product.unit_price * (s.item.packages ?? 1), 0)
  const aisleName = (n: number) => store.aisles.find((a) => a.number === n)?.name ?? ''

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
              : `Ruta óptima: ${route.stops.length} productos en ${visitedAisles} de ${totalAisles} pasillos · ~${meters} m · ~${minutes} min`)}
          {phase === 'walking' && current && (
            <>
              Vamos al <span className="text-sun">pasillo {current.item.location!.aisle}</span> ·{' '}
              {aisleName(current.item.location!.aisle)}
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

        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="block w-full rounded-2xl" role="img" aria-label="Plano de la tienda con la ruta de compra">
          <defs>
            <filter id="glow" x="-200%" y="-200%" width="500%" height="500%">
              <feGaussianBlur stdDeviation="1.6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <FloorPlan layout={layout} activeAisles={activeAisles} />

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
