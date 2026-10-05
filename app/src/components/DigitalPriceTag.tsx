import { Check, Lightbulb, Radio, TrendingDown } from 'lucide-react'
import { useState, useEffect } from 'react'
import type { ShoppingItem } from '../lib/compute.ts'
import { SafeImage } from './SafeImage.tsx'
import { formatEuro, NA } from '../lib/format.ts'

interface DigitalPriceTagProps {
  item: ShoppingItem
  checked: boolean
  onToggle: () => void
  aisleName?: string | null
}

const SHELF_DESCRIPTIONS: Record<string, string> = {
  D: 'Balda D · Superior (altura de ojos · 1,80 m)',
  C: 'Balda C · Media-alta (1,40 m)',
  B: 'Balda B · Media-baja (1,00 m)',
  A: 'Balda A · Inferior (nivel suelo · 0,50 m)',
}

export function DigitalPriceTag({ item, checked, onToggle, aisleName }: DigitalPriceTagProps) {
  const { product, location, inStock } = item
  const [isBlinking, setIsBlinking] = useState(false)

  const shelfDesc = location?.shelf ? SHELF_DESCRIPTIONS[location.shelf] ?? `Balda ${location.shelf}` : null

  // Simulación de pick-by-light: el LED parpadea 4 segundos
  const handleLocateLed = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsBlinking(true)
  }

  useEffect(() => {
    if (!isBlinking) return
    const timer = setTimeout(() => setIsBlinking(false), 4500)
    return () => clearTimeout(timer)
  }, [isBlinking])

  return (
    <article
      className={`relative overflow-hidden rounded-3xl border-2 transition-all ${
        checked
          ? 'border-brand/40 bg-brand-soft/30 opacity-90'
          : isBlinking
            ? 'border-sun bg-amber-50/60 shadow-md ring-2 ring-sun/50'
            : 'border-line bg-white shadow-soft hover:border-brand/30'
      }`}
    >
      {/* Barra superior de la tarjeta digital: simula la pantalla E-Ink / ESL */}
      <div className="flex items-center justify-between border-b border-line/80 bg-panel/80 px-3.5 py-2 text-[11px] font-bold">
        <div className="flex items-center gap-1.5">
          <span className="rounded-md bg-ink/10 px-1.5 py-0.5 font-mono text-[10px] font-black text-ink/80">
            ESL-{product.id.slice(-4)}
          </span>
          <span className="flex items-center gap-1 text-muted">
            <Radio className="size-3 text-brand" aria-hidden />
            Sincronizada
          </span>
        </div>

        {/* LED de localización en la estantería */}
        <div className="flex items-center gap-1.5">
          {isBlinking ? (
            <span className="inline-flex items-center gap-1 text-accent-dark font-black">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sun opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
              </span>
              LED activo
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-muted text-[10px]">
              <span className="size-2 rounded-full bg-emerald-500" />
              En línea
            </span>
          )}
        </div>
      </div>

      <div className="p-3.5">
        <div className="flex items-start gap-3">
          <SafeImage
            src={product.thumbnail}
            alt=""
            kind="producto"
            className={`size-16 shrink-0 rounded-2xl bg-white object-contain ring-1 ring-line transition-opacity ${
              checked ? 'opacity-50' : ''
            }`}
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className={`text-sm font-black leading-tight ${checked ? 'text-muted line-through' : 'text-ink'}`}>
                {product.name}
              </h3>
              <div className="text-right shrink-0">
                <p className={`text-base font-black tabular-nums leading-none ${checked ? 'text-muted' : 'text-brand-dark'}`}>
                  {item.cost !== null ? formatEuro(item.cost) : <span className="text-xs italic text-muted">{NA}</span>}
                </p>
                {item.packages !== null && item.packages > 1 && (
                  <p className="text-[10px] font-extrabold text-muted">
                    {item.packages} × {formatEuro(product.unit_price)}
                  </p>
                )}
              </div>
            </div>

            <p className="mt-1 text-xs font-semibold text-muted">
              {item.packages !== null ? `${item.packages} envase${item.packages > 1 ? 's' : ''}` : `Envases: ${NA}`}
              {' · '}
              {item.uses.map((u) => `${u.recipeName} (${u.label})`).join(', ')}
            </p>

            {product.price_decreased && (
              <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-extrabold text-brand">
                <TrendingDown className="size-3" aria-hidden /> Ha bajado de precio
              </p>
            )}

            {inStock === false && (
              <p className="mt-1 text-[11px] font-extrabold text-pass">Sin stock en esta tienda (simulado)</p>
            )}
          </div>
        </div>

        {/* Coordenadas en la tienda y estantería */}
        <div className="mt-3 rounded-2xl bg-panel/90 p-2.5 text-xs font-bold text-ink">
          {location ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px] text-muted font-extrabold">
                <span>
                  Pasillo {location.aisle} {aisleName ? `· ${aisleName}` : ''}
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-ink shadow-xs">
                  {location.side === 'izq' ? 'Lado Izquierdo' : 'Lado Derecho'}
                </span>
              </div>
              <p className="text-brand-dark font-extrabold text-xs">
                📍 {shelfDesc}
              </p>
            </div>
          ) : (
            <p className="italic text-muted">Ubicación en tienda: {NA}</p>
          )}
        </div>

        {/* Notificación si el LED de la etiqueta está parpadeando */}
        {isBlinking && location && (
          <div className="mt-2 flex items-center gap-2 rounded-xl bg-sun/20 px-3 py-1.5 text-xs font-extrabold text-accent-dark animate-pulse">
            <Lightbulb className="size-4 shrink-0 text-accent" />
            <span>
              ¡LED parpadeando en la <strong>{location.shelf}</strong>! Mira la balda para localizarlo.
            </span>
          </div>
        )}

        {/* Botones de acción: Destello LED + Ya lo he cogido */}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-line/60 pt-2.5">
          <button
            type="button"
            onClick={handleLocateLed}
            disabled={!location}
            aria-label={`Hacer parpadear LED de ${product.name}`}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold transition-all ${
              isBlinking
                ? 'bg-sun text-ink shadow-soft'
                : 'bg-panel text-muted hover:bg-cream hover:text-accent-dark'
            }`}
          >
            <Lightbulb className={`size-3.5 ${isBlinking ? 'text-accent-dark' : ''}`} />
            <span>{isBlinking ? 'Parpadeando...' : 'Localizar con luz LED'}</span>
          </button>

          <button
            type="button"
            onClick={onToggle}
            aria-pressed={checked}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-black transition-all ${
              checked
                ? 'bg-brand text-white shadow-soft'
                : 'bg-white text-ink ring-1 ring-line hover:bg-brand-soft hover:text-brand-dark'
            }`}
          >
            <span
              className={`grid size-4 place-items-center rounded-md border text-white ${
                checked ? 'border-white bg-white text-brand' : 'border-line bg-white'
              }`}
            >
              {checked && <Check className="size-3.5" strokeWidth={4} />}
            </span>
            <span>{checked ? 'En el carro' : 'Coger producto'}</span>
          </button>
        </div>
      </div>
    </article>
  )
}
