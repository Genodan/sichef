import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bot,
  Check,
  CheckCircle2,
  Compass,
  Lightbulb,
  MapPin,
  Play,
  RotateCcw,
  Sparkles,
  Store as StoreIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Store } from '../types.ts'
import type { ShoppingItem } from '../lib/compute.ts'
import { SafeImage } from './SafeImage.tsx'
import { PrimaryButton } from './ui.tsx'
import { formatEuro } from '../lib/format.ts'

interface StoreSimulatorProps {
  store: Store
  items: ShoppingItem[]
  checkedProductIds: ReadonlySet<string>
  onToggleProduct: (productId: string) => void
  onFinishPurchase: () => void
}

interface Position {
  x: number
  y: number
}

// Cálculo determinista de coordenadas para cada pasillo en el plano (0-100%)
function getAisleCoordinates(aisleNumber: number) {
  const isLeft = aisleNumber % 2 === 1
  const row = Math.floor((aisleNumber - 1) / 2)
  const x = isLeft ? 22 : 78
  const y = 18 + row * 15
  return { x, y, isLeft }
}

// Coordenadas de un producto en la estantería según pasillo y lado
function getProductCoordinates(item: ShoppingItem): Position | null {
  if (!item.location) return null
  const aisleCoords = getAisleCoordinates(item.location.aisle)
  const sideOffset = item.location.side === 'izq' ? -5 : 5
  return {
    x: aisleCoords.x + sideOffset,
    y: aisleCoords.y,
  }
}

export function StoreSimulator({
  store,
  items,
  checkedProductIds,
  onToggleProduct,
  onFinishPurchase,
}: StoreSimulatorProps) {
  // Posición inicial: Entrada de la tienda (x: 50, y: 7)
  const [avatarPos, setAvatarPos] = useState<Position>({ x: 50, y: 7 })
  const [isAutoWalking, setIsAutoWalking] = useState(false)
  const autoWalkIntervalRef = useRef<number | null>(null)

  // Pasillos ordenados de la tienda
  const aisles = useMemo(() => [...(store.aisles ?? [])].sort((a, b) => a.number - b.number), [store.aisles])

  // Productos pendientes de recoger
  const pendingItems = useMemo(
    () => items.filter((i) => !checkedProductIds.has(i.product.id) && i.location !== null),
    [items, checkedProductIds],
  )

  // Producto objetivo actual (el primero de la ruta que esté pendiente)
  const currentTarget = pendingItems[0] ?? null

  const targetCoords = useMemo(() => {
    if (!currentTarget) {
      // Si todos están recogidos, el objetivo es Línea de cajas (x: 50, y: 93)
      return { x: 50, y: 93 }
    }
    return getProductCoordinates(currentTarget) ?? { x: 50, y: 93 }
  }, [currentTarget])

  // Distancia del avatar al objetivo (en porcentaje del mapa)
  const distanceToTarget = useMemo(() => {
    return Math.hypot(avatarPos.x - targetCoords.x, avatarPos.y - targetCoords.y)
  }, [avatarPos, targetCoords])

  // ¿Está en proximidad inmediata del producto? (< 7.5 unidades)
  const isNearTarget = currentTarget !== null && distanceToTarget <= 7.5

  // Destello LED automático al acercarse a la etiqueta digital
  const ledFlash = isNearTarget

  // ¿Ha llegado a las cajas con todos los productos?
  const isAtCheckout = currentTarget === null && distanceToTarget <= 8

  // Cancelar auto-caminar si se desmonta
  useEffect(() => {
    return () => {
      if (autoWalkIntervalRef.current) clearInterval(autoWalkIntervalRef.current)
    }
  }, [])

  // Mover el personaje manualmente
  const moveAvatar = useCallback((dx: number, dy: number) => {
    setAvatarPos((prev) => {
      const nextX = Math.max(10, Math.min(90, prev.x + dx))
      const nextY = Math.max(5, Math.min(95, prev.y + dy))
      return { x: nextX, y: nextY }
    })
  }, [])

  // Escuchar teclado (flechas o WASD) para mover el personaje
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) {
        e.preventDefault()
        moveAvatar(0, -3.5)
      } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
        e.preventDefault()
        moveAvatar(0, 3.5)
      } else if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        e.preventDefault()
        moveAvatar(-3.5, 0)
      } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
        e.preventDefault()
        moveAvatar(3.5, 0)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [moveAvatar])

  // Clic directo en el mapa para caminar a esa posición
  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = ((e.clientX - rect.left) / rect.width) * 100
    const clickY = ((e.clientY - rect.top) / rect.height) * 100
    setAvatarPos({
      x: Math.max(10, Math.min(90, clickX)),
      y: Math.max(5, Math.min(95, clickY)),
    })
  }

  // Auto-caminar paso a paso hacia el objetivo (ideal para demos de hackathon)
  const startAutoWalk = () => {
    if (isAutoWalking) {
      if (autoWalkIntervalRef.current) clearInterval(autoWalkIntervalRef.current)
      setIsAutoWalking(false)
      return
    }

    setIsAutoWalking(true)
    if (autoWalkIntervalRef.current) clearInterval(autoWalkIntervalRef.current)

    autoWalkIntervalRef.current = window.setInterval(() => {
      setAvatarPos((prev) => {
        const dx = targetCoords.x - prev.x
        const dy = targetCoords.y - prev.y
        const dist = Math.hypot(dx, dy)

        if (dist <= 2.5) {
          if (autoWalkIntervalRef.current) clearInterval(autoWalkIntervalRef.current)
          setIsAutoWalking(false)
          return targetCoords
        }

        // Caminar siguiendo la ruta de pasillos:
        // Primero moverse verticalmente por el pasillo central (x=50), luego entrar horizontalmente al pasillo
        const step = 2.2
        let stepX = 0
        let stepY = 0

        if (Math.abs(prev.x - 50) > 3 && Math.abs(dy) > 5) {
          // Si está dentro de un pasillo lateral y tiene que cambiar de fila, salir al pasillo central
          stepX = (50 - prev.x > 0 ? 1 : -1) * step
        } else if (Math.abs(dy) > 3) {
          // Caminar por el pasillo central hacia la altura del pasillo objetivo
          stepY = (dy > 0 ? 1 : -1) * step
          // Mantenerse centrado en pasillo
          if (Math.abs(prev.x - 50) > 1) {
            stepX = (50 - prev.x > 0 ? 1 : -1) * Math.min(step, Math.abs(50 - prev.x))
          }
        } else {
          // Una vez a la altura del pasillo, entrar hacia la estantería
          stepX = (dx > 0 ? 1 : -1) * step
        }

        return {
          x: Math.max(10, Math.min(90, prev.x + stepX)),
          y: Math.max(5, Math.min(95, prev.y + stepY)),
        }
      })
    }, 90)
  }

  // Texto guía hacia el objetivo
  const guidanceText = useMemo(() => {
    if (!currentTarget) {
      return '¡Todos los ingredientes recogidos! Dirígete a la Línea de cajas para finalizar.'
    }
    const loc = currentTarget.location
    if (!loc) return 'Buscando siguiente producto...'

    if (isNearTarget) {
      return `¡Estás frente al producto! Mira la luz LED parpadeando en la Balda ${loc.shelf}.`
    }

    const aisleCoords = getAisleCoordinates(loc.aisle)
    const isSameAisle = Math.abs(avatarPos.y - aisleCoords.y) < 8

    if (isSameAisle) {
      return `Entra en el Pasillo ${loc.aisle}. Está en el ${loc.side === 'izq' ? 'Lado Izquierdo' : 'Lado Derecho'} (Balda ${loc.shelf}).`
    }

    if (avatarPos.y < aisleCoords.y) {
      return `Avanza hacia delante por el pasillo central hacia el Pasillo ${loc.aisle} (${store.aisles.find((a) => a.number === loc.aisle)?.name ?? ''}).`
    } else {
      return `Retrocede por el pasillo central hacia el Pasillo ${loc.aisle}.`
    }
  }, [currentTarget, isNearTarget, avatarPos, store.aisles])

  return (
    <div className="flex flex-col gap-3">
      {/* HUD SUPERIOR: OBJETIVO Y GUÍA EN DIRECTO */}
      <div className="rounded-3xl border-2 border-brand bg-white p-3.5 shadow-soft ring-2 ring-brand/10">
        <div className="flex items-center justify-between border-b border-line pb-2 text-[11px] font-black uppercase tracking-wider text-muted">
          <span className="flex items-center gap-1.5 text-brand-dark">
            <Compass className="size-4 text-brand animate-spin" style={{ animationDuration: '8s' }} />
            <span>Navegación asistida por ESL</span>
          </span>
          <span className="rounded-full bg-cream px-2 py-0.5 text-accent-dark">
            {currentTarget
              ? `Producto ${items.length - pendingItems.length + 1} de ${items.length}`
              : 'Recorrido finalizado'}
          </span>
        </div>

        {/* Ficha del producto objetivo actual */}
        {currentTarget ? (
          <div className="mt-2.5 flex items-start gap-3">
            <div className="relative size-14 shrink-0 rounded-2xl bg-white p-1 ring-1 ring-line">
              <SafeImage
                src={currentTarget.product.thumbnail}
                alt=""
                kind="producto"
                className="size-full object-contain"
              />
              {ledFlash && (
                <span className="absolute -top-1 -right-1 flex size-3.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sun opacity-75" />
                  <span className="relative inline-flex size-3.5 rounded-full bg-accent" />
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-1">
                <p className="truncate text-sm font-black text-ink">{currentTarget.product.name}</p>
                <span className="text-sm font-black text-brand-dark tabular-nums shrink-0">
                  {formatEuro(currentTarget.product.unit_price)}
                </span>
              </div>

              {currentTarget.location && (
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs font-bold text-muted">
                  <span className="text-ink">
                    Pasillo {currentTarget.location.aisle} · {currentTarget.location.side === 'izq' ? 'Lado Izq' : 'Lado Der'}
                  </span>
                  <span className="font-black text-brand-dark">Balda {currentTarget.location.shelf}</span>
                </div>
              )}

              {/* Indicador de estado del LED */}
              <div className="mt-1 flex items-center gap-1 text-[11px] font-extrabold">
                {isNearTarget ? (
                  <span className="inline-flex items-center gap-1 text-accent-dark font-black">
                    <Lightbulb className="size-3.5 text-accent animate-pulse" />
                    ¡Luz LED activa en estantería!
                  </span>
                ) : (
                  <span className="text-muted">
                    Distancia: ~{Math.round(distanceToTarget * 0.4)} metros
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-2.5 flex items-center gap-3 py-1">
            <div className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
              <CheckCircle2 className="size-7" />
            </div>
            <div>
              <p className="text-sm font-black text-brand-dark">¡Todos los productos en el carro!</p>
              <p className="text-xs font-semibold text-muted">Dirígete a la Línea de cajas para finalizar tu compra.</p>
            </div>
          </div>
        )}

        {/* Mensaje de dirección paso a paso */}
        <div
          className={`mt-2.5 rounded-2xl p-2.5 text-xs font-black transition-all ${
            isNearTarget
              ? 'bg-sun/20 text-accent-dark border border-sun animate-pulse'
              : 'bg-panel text-ink'
          }`}
        >
          <p className="flex items-center gap-1.5">
            <span className="text-base">📍</span>
            <span>{guidanceText}</span>
          </p>
        </div>

        {/* Botón de acción contextual: Recoger producto al llegar */}
        {isNearTarget && currentTarget && (
          <div className="mt-2.5">
            <button
              type="button"
              onClick={() => onToggleProduct(currentTarget.product.id)}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-brand py-2.5 text-xs font-black text-white shadow-soft hover:bg-brand-dark transition-all"
            >
              <Check className="size-4" strokeWidth={3} />
              <span>Ya he cogido {currentTarget.product.name}</span>
            </button>
          </div>
        )}
      </div>

      {/* PLANO DE LA TIENDA CON EL AVATAR Y LAS ESTANTERÍAS */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-line bg-canvas p-3 shadow-soft select-none">
        {/* Cabecera del plano */}
        <div className="flex items-center justify-between border-b border-line pb-1.5 text-[10px] font-black uppercase text-muted">
          <span className="flex items-center gap-1 text-brand">
            <StoreIcon className="size-3" />
            {store.name}
          </span>
          <span>Toca el plano para caminar</span>
        </div>

        {/* Superficie interactiva de la tienda (alto fijo para móvil) */}
        <div
          onClick={handleMapClick}
          className="relative mt-2 h-96 w-full cursor-crosshair rounded-2xl bg-gradient-to-b from-stone-100 via-white to-stone-100 p-2 border border-line"
          role="region"
          aria-label="Plano interactivo del supermercado"
        >
          {/* Zona: Entrada (arriba) */}
          <div className="absolute top-1 left-1/2 -translate-x-1/2 rounded-full bg-brand-soft px-3 py-0.5 text-[9px] font-black text-brand border border-brand/30">
            ↑ ENTRADA
          </div>

          {/* Pasillo central (guía visual vertical) */}
          <div className="absolute top-7 bottom-9 left-1/2 -translate-x-1/2 w-8 border-x border-dashed border-line/80 flex flex-col items-center justify-around pointer-events-none opacity-40">
            <span className="text-[8px] font-bold text-muted">↓</span>
            <span className="text-[8px] font-bold text-muted">↓</span>
            <span className="text-[8px] font-bold text-muted">↓</span>
            <span className="text-[8px] font-bold text-muted">↓</span>
          </div>

          {/* Pasillos laterales */}
          {aisles.map((a) => {
            const coords = getAisleCoordinates(a.number)
            const aisleItems = items.filter((i) => i.location?.aisle === a.number)
            const hasItems = aisleItems.length > 0
            const isTargetAisle = currentTarget?.location?.aisle === a.number

            return (
              <div
                key={a.number}
                style={{
                  left: `${coords.x}%`,
                  top: `${coords.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className={`absolute w-24 rounded-xl border p-1 text-center transition-all ${
                  isTargetAisle
                    ? 'border-brand bg-brand-soft shadow-md ring-2 ring-brand/30 scale-105 z-10'
                    : hasItems
                      ? 'border-brand/40 bg-white/90 shadow-xs'
                      : 'border-line/60 bg-panel/60 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between text-[8px] font-black text-ink">
                  <span className="rounded bg-brand px-1 text-white">{a.number}</span>
                  <span className="truncate max-w-16">{a.name}</span>
                </div>

                {/* Línea de estantería con productos */}
                {hasItems && (
                  <div className="mt-1 flex items-center justify-center gap-1">
                    {aisleItems.map((item) => {
                      const isPicked = checkedProductIds.has(item.product.id)
                      const isCurrent = currentTarget?.product.id === item.product.id

                      return (
                        <div
                          key={item.product.id}
                          className={`relative size-4 rounded-full border transition-all ${
                            isCurrent
                              ? 'border-sun bg-sun shadow-xs scale-125'
                              : isPicked
                                ? 'border-brand bg-brand-soft opacity-60'
                                : 'border-line bg-white'
                          }`}
                          title={`${item.product.name} (Balda ${item.location?.shelf ?? '-'})`}
                        >
                          {isCurrent && (
                            <span className="absolute -inset-1 animate-ping rounded-full bg-sun opacity-75" />
                          )}
                          {isPicked && <Check className="size-full text-brand" strokeWidth={3} />}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {/* Línea hacia el objetivo (ruta visual en el suelo) */}
          <svg className="absolute inset-0 size-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
            <line
              x1={`${avatarPos.x}%`}
              y1={`${avatarPos.y}%`}
              x2={`${targetCoords.x}%`}
              y2={`${targetCoords.y}%`}
              stroke="#1f8a4c"
              strokeWidth="2"
              strokeDasharray="4 4"
              opacity="0.6"
            />
          </svg>

          {/* Zona: Línea de Cajas (abajo) */}
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-accent/20 px-3 py-0.5 text-[9px] font-black text-accent-dark border border-accent/30">
            LÍNEA DE CAJAS ↓
          </div>

          {/* AVATAR DEL CLIENTE (TÚ ESTÁS AQUÍ) */}
          <div
            style={{
              left: `${avatarPos.x}%`,
              top: `${avatarPos.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
            className="absolute z-20 transition-all duration-100 ease-out pointer-events-none"
          >
            {/* Onda de radar de posición */}
            <span className="absolute -inset-2 rounded-full bg-brand/30 animate-ping opacity-75" />
            <div className="relative flex size-8 items-center justify-center rounded-full bg-brand text-white shadow-phone ring-2 ring-white">
              <span className="text-sm font-black">🛒</span>
            </div>
            <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink/80 px-1 py-0.2 text-[8px] font-black text-white">
              Tú
            </span>
          </div>
        </div>
      </div>

      {/* CONTROLES DE MOVIMIENTO (D-PAD Y AUTO-WALK) */}
      <div className="rounded-3xl border border-line bg-white p-3 shadow-soft">
        <div className="flex items-center justify-between text-xs font-black text-ink mb-2">
          <span>Controles de movimiento</span>
          <span className="text-[10px] text-muted font-bold">O usa teclado ↑ ↓ ← →</span>
        </div>

        <div className="flex items-center justify-between gap-4">
          {/* Botón de auto-caminar para la demo */}
          <div className="flex flex-1 flex-col gap-2">
            <button
              type="button"
              onClick={startAutoWalk}
              className={`flex items-center justify-center gap-1.5 rounded-2xl py-3 px-3 text-xs font-black transition-all ${
                isAutoWalking
                  ? 'bg-pass text-white shadow-soft animate-pulse'
                  : 'bg-accent text-white shadow-soft hover:bg-accent-dark'
              }`}
            >
              {isAutoWalking ? <Bot className="size-4" /> : <Play className="size-4" />}
              <span>{isAutoWalking ? 'Pausar avance' : '🚶 Guiar automáticamente'}</span>
            </button>

            <button
              type="button"
              onClick={() => setAvatarPos({ x: 50, y: 7 })}
              className="flex items-center justify-center gap-1 rounded-xl bg-panel py-1.5 text-[11px] font-bold text-muted hover:text-ink transition-colors"
            >
              <RotateCcw className="size-3" />
              <span>Volver a la entrada</span>
            </button>
          </div>

          {/* D-Pad táctil para moverse con el pulgar */}
          <div className="grid grid-cols-3 grid-rows-3 gap-1 size-28 shrink-0 place-items-center">
            <div />
            <button
              type="button"
              aria-label="Mover hacia arriba"
              onClick={() => moveAvatar(0, -4)}
              className="flex size-8 items-center justify-center rounded-xl bg-panel text-ink shadow-xs active:bg-brand active:text-white transition-colors"
            >
              <ArrowUp className="size-4" />
            </button>
            <div />

            <button
              type="button"
              aria-label="Mover hacia la izquierda"
              onClick={() => moveAvatar(-4, 0)}
              className="flex size-8 items-center justify-center rounded-xl bg-panel text-ink shadow-xs active:bg-brand active:text-white transition-colors"
            >
              <ArrowLeft className="size-4" />
            </button>

            <div className="grid size-8 place-items-center rounded-xl bg-brand-soft text-[10px] font-black text-brand">
              <MapPin className="size-3.5" />
            </div>

            <button
              type="button"
              aria-label="Mover hacia la derecha"
              onClick={() => moveAvatar(4, 0)}
              className="flex size-8 items-center justify-center rounded-xl bg-panel text-ink shadow-xs active:bg-brand active:text-white transition-colors"
            >
              <ArrowRight className="size-4" />
            </button>

            <div />
            <button
              type="button"
              aria-label="Mover hacia abajo"
              onClick={() => moveAvatar(0, 4)}
              className="flex size-8 items-center justify-center rounded-xl bg-panel text-ink shadow-xs active:bg-brand active:text-white transition-colors"
            >
              <ArrowDown className="size-4" />
            </button>
            <div />
          </div>
        </div>
      </div>

      {/* BOTÓN FINAL DE COMPRA / FINALIZACIÓN */}
      <div className="mt-1">
        <PrimaryButton
          variant={isAtCheckout || pendingItems.length === 0 ? 'brand' : 'ghost'}
          onClick={onFinishPurchase}
          className={`w-full flex items-center justify-center gap-2 py-3.5 text-sm font-black shadow-button transition-all ${
            isAtCheckout ? 'ring-4 ring-brand/30 animate-pulse' : ''
          }`}
        >
          <Sparkles className="size-4" />
          <span>He terminado la compra</span>
        </PrimaryButton>
        <p className="mt-1.5 text-center text-[10px] font-semibold text-muted">
          Al pulsar, todos los productos recogidos se guardarán como «En casa» en tu Recetario.
        </p>
      </div>
    </div>
  )
}
