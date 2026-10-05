import { Check, Compass, Layers, MapPin } from 'lucide-react'
import { useState } from 'react'
import type { Store } from '../types.ts'
import type { ShoppingItem } from '../lib/compute.ts'
import { SafeImage } from './SafeImage.tsx'
import { NA } from '../lib/format.ts'

interface InteractiveStoreMapProps {
  store: Store
  items: ShoppingItem[]
  checkedProductIds: ReadonlySet<string>
  route: number[]
  doneAisles: ReadonlySet<number>
  onToggleProduct: (productId: string) => void
}

export function InteractiveStoreMap({
  store,
  items,
  checkedProductIds,
  route,
  doneAisles,
  onToggleProduct,
}: InteractiveStoreMapProps) {
  const [showOnlyRoute, setShowOnlyRoute] = useState(false)
  const aisles = [...(store.aisles ?? [])].sort((a, b) => a.number - b.number)

  if (aisles.length === 0) {
    return <p className="text-sm italic text-muted">Mapa de la tienda: {NA}</p>
  }

  // Agrupar items por pasillo
  const itemsByAisle = new Map<number, ShoppingItem[]>()
  for (const item of items) {
    if (item.location?.aisle !== undefined) {
      const list = itemsByAisle.get(item.location.aisle) ?? []
      list.push(item)
      itemsByAisle.set(item.location.aisle, list)
    }
  }

  const displayedAisles = showOnlyRoute ? aisles.filter((a) => route.includes(a.number)) : aisles

  return (
    <div className="flex flex-col gap-3">
      {/* Selector de vista y resumen de ruta */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-black text-brand-dark">
          <Compass className="size-4 text-brand" aria-hidden />
          <span>{route.length} pasillos en tu ruta</span>
        </div>
        <button
          type="button"
          onClick={() => setShowOnlyRoute(!showOnlyRoute)}
          className="flex items-center gap-1 rounded-full bg-panel px-3 py-1 text-[11px] font-extrabold text-muted hover:text-ink transition-colors"
        >
          <Layers className="size-3" />
          <span>{showOnlyRoute ? 'Ver tienda completa' : 'Solo mis pasillos'}</span>
        </button>
      </div>

      {/* Plano interactivo de la tienda */}
      <div className="rounded-3xl border border-line bg-canvas p-3 shadow-inner">
        {/* Entrada */}
        <div className="mb-2 flex items-center justify-between border-b border-line pb-1.5 text-[10px] font-black uppercase tracking-wider text-muted">
          <span className="flex items-center gap-1 text-brand">
            <span className="size-2 rounded-full bg-brand animate-pulse" />
            ↑ Entrada de la tienda
          </span>
          <span>Tarjetas digitales activas</span>
        </div>

        {/* Pasillos */}
        <div className="flex flex-col gap-2.5">
          {displayedAisles.map((a) => {
            const stepIndex = route.indexOf(a.number)
            const hasItems = stepIndex >= 0
            const isDone = doneAisles.has(a.number)
            const aisleItems = itemsByAisle.get(a.number) ?? []

            const leftItems = aisleItems.filter((i) => i.location?.side === 'izq')
            const rightItems = aisleItems.filter((i) => i.location?.side === 'der')

            return (
              <div
                key={a.number}
                className={`relative rounded-2xl border transition-all ${
                  hasItems
                    ? isDone
                      ? 'border-brand/40 bg-brand-soft/50 shadow-xs'
                      : 'border-brand bg-white shadow-soft ring-1 ring-brand/20'
                    : 'border-line/70 bg-white/60 opacity-60'
                }`}
              >
                {/* Cabecera del pasillo */}
                <div
                  className={`flex items-center justify-between px-3 py-2 text-xs font-black ${
                    hasItems
                      ? isDone
                        ? 'text-brand-dark'
                        : 'text-brand-dark'
                      : 'text-muted'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`grid size-6 place-items-center rounded-full text-xs font-black ${
                        hasItems
                          ? isDone
                            ? 'bg-brand text-white'
                            : 'bg-brand text-white'
                          : 'bg-panel text-muted'
                      }`}
                    >
                      {isDone ? <Check className="size-3.5" strokeWidth={3} /> : a.number}
                    </span>
                    <span>
                      Pasillo {a.number} · {a.name}
                    </span>
                  </div>

                  {hasItems && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2 py-0.5 text-[10px] font-black text-accent-dark">
                      Paso {stepIndex + 1} de {route.length}
                    </span>
                  )}
                </div>

                {/* Si tiene productos: mostrar distribución en lineal izquierdo y derecho */}
                {hasItems && aisleItems.length > 0 && (
                  <div className="border-t border-line/60 p-2.5">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {/* Lado Izquierdo */}
                      <div className="rounded-xl bg-panel/80 p-2">
                        <span className="mb-1.5 block text-[10px] font-extrabold uppercase text-muted">
                          ← Lado Izquierdo
                        </span>
                        {leftItems.length > 0 ? (
                          <div className="flex flex-col gap-1.5">
                            {leftItems.map((item) => {
                              const checked = checkedProductIds.has(item.product.id)
                              return (
                                <button
                                  type="button"
                                  key={item.product.id}
                                  onClick={() => onToggleProduct(item.product.id)}
                                  className={`flex items-center gap-1.5 rounded-lg p-1 text-left transition-all ${
                                    checked
                                      ? 'bg-brand-soft/70 opacity-60'
                                      : 'bg-white shadow-xs hover:ring-1 hover:ring-brand'
                                  }`}
                                >
                                  <SafeImage
                                    src={item.product.thumbnail}
                                    alt=""
                                    kind="producto"
                                    className="size-7 shrink-0 rounded-md bg-white object-contain"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p
                                      className={`truncate text-[11px] font-bold leading-tight ${
                                        checked ? 'line-through text-muted' : 'text-ink'
                                      }`}
                                    >
                                      {item.product.name}
                                    </p>
                                    <span className="text-[10px] font-black text-brand-dark">
                                      Balda {item.location?.shelf ?? '-'}
                                    </span>
                                  </div>
                                  <span
                                    className={`grid size-4 shrink-0 place-items-center rounded-full text-white ${
                                      checked ? 'bg-brand' : 'border border-line bg-white'
                                    }`}
                                  >
                                    {checked && <Check className="size-2.5" strokeWidth={3} />}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          <p className="text-[10px] italic text-muted/80">Sin productos</p>
                        )}
                      </div>

                      {/* Lado Derecho */}
                      <div className="rounded-xl bg-panel/80 p-2">
                        <span className="mb-1.5 block text-[10px] font-extrabold uppercase text-muted">
                          Lado Derecho →
                        </span>
                        {rightItems.length > 0 ? (
                          <div className="flex flex-col gap-1.5">
                            {rightItems.map((item) => {
                              const checked = checkedProductIds.has(item.product.id)
                              return (
                                <button
                                  type="button"
                                  key={item.product.id}
                                  onClick={() => onToggleProduct(item.product.id)}
                                  className={`flex items-center gap-1.5 rounded-lg p-1 text-left transition-all ${
                                    checked
                                      ? 'bg-brand-soft/70 opacity-60'
                                      : 'bg-white shadow-xs hover:ring-1 hover:ring-brand'
                                  }`}
                                >
                                  <SafeImage
                                    src={item.product.thumbnail}
                                    alt=""
                                    kind="producto"
                                    className="size-7 shrink-0 rounded-md bg-white object-contain"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p
                                      className={`truncate text-[11px] font-bold leading-tight ${
                                        checked ? 'line-through text-muted' : 'text-ink'
                                      }`}
                                    >
                                      {item.product.name}
                                    </p>
                                    <span className="text-[10px] font-black text-brand-dark">
                                      Balda {item.location?.shelf ?? '-'}
                                    </span>
                                  </div>
                                  <span
                                    className={`grid size-4 shrink-0 place-items-center rounded-full text-white ${
                                      checked ? 'bg-brand' : 'border border-line bg-white'
                                    }`}
                                  >
                                    {checked && <Check className="size-2.5" strokeWidth={3} />}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          <p className="text-[10px] italic text-muted/80">Sin productos</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Cajas y salida */}
        <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2 text-[10px] font-black uppercase tracking-wider text-muted">
          <span>Línea de cajas y salida ↓</span>
          <span className="flex items-center gap-1 text-brand-dark">
            <MapPin className="size-3" />
            Fin de ruta
          </span>
        </div>
      </div>
    </div>
  )
}
