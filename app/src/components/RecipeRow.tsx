import { Flame, ShieldAlert, TrendingDown } from 'lucide-react'
import type { ReactNode } from 'react'
import type { HouseholdSuitability, RecipeInfo, Visibility } from '../lib/compute.ts'
import { formatEuro, formatNutrient } from '../lib/format.ts'
import { SafeImage } from './SafeImage.tsx'

interface Props {
  info: RecipeInfo
  onOpen: () => void
  visibility?: Visibility
  suitability?: HouseholdSuitability
  /** Botones a la derecha (cesta, quitar…). */
  actions?: ReactNode
  /** Resumen de estado de ingredientes (cesta, casa, pendientes). */
  ingredientSummary?: ReactNode
}

/** Fila de receta para listas (Buscar, Recetario). */
export function RecipeRow({ info, onOpen, visibility, suitability, actions, ingredientSummary }: Props) {
  const { recipe, cost, nutrition, priceDecreased } = info
  const hidden = visibility && !visibility.visible
  return (
    <li className="flex items-center gap-3 rounded-3xl bg-white p-2.5 shadow-soft">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        aria-label={`Ver receta: ${recipe.name}`}
      >
        <SafeImage src={recipe.image?.url} alt="" className="size-20 shrink-0 rounded-2xl object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-extrabold leading-tight">{recipe.name}</p>
          {recipe.subtitle && <p className="truncate text-xs font-semibold text-muted">{recipe.subtitle}</p>}
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-bold">
            <span className="rounded-full bg-cream px-2 py-0.5 text-accent-dark">
              {cost.perServing !== null ? `${formatEuro(cost.perServing)}/ración` : 'Precio: dato no disponible'}
            </span>
            <span className="inline-flex items-center gap-0.5 text-muted">
              <Flame className="size-3.5 text-kcal" aria-hidden />
              {formatNutrient('kcal', nutrition.perServing.kcal)}
            </span>
            {priceDecreased.length > 0 && (
              <span className="inline-flex items-center gap-0.5 text-brand">
                <TrendingDown className="size-3.5" aria-hidden /> Ha bajado
              </span>
            )}
          </p>
          {ingredientSummary && <div className="mt-1.5">{ingredientSummary}</div>}
          {suitability && suitability.members.length > 0 ? (
            <div className="mt-1 text-[11px] font-black">
              {suitability.allCanEat ? (
                <span className="inline-flex items-center gap-1 text-brand-dark">
                  <span aria-hidden>✅</span> Apto para toda la casa
                </span>
              ) : suitability.noneCanEat ? (
                <span className="inline-flex items-center gap-1 text-pass">
                  <span aria-hidden>❌</span> No apto en casa
                </span>
              ) : (
                <span className="flex flex-wrap items-center gap-1">
                  <span className="text-brand-dark">✅ {suitability.canEat.map((m) => m.memberName).join(', ')}</span>
                  <span className="text-muted">·</span>
                  <span className="text-pass">❌ {suitability.cannotEat.map((m) => m.memberName).join(', ')}</span>
                </span>
              )}
            </div>
          ) : (
            hidden && (
              <p className="mt-1 inline-flex items-center gap-1 text-xs font-extrabold text-pass">
                <ShieldAlert className="size-3.5" aria-hidden />
                {visibility.byAllergy ? 'Contiene alérgenos de tu perfil' : 'Alérgenos: dato no disponible'}
              </p>
            )
          )}
        </div>
      </button>
      {actions && <div className="flex shrink-0 flex-col gap-1.5">{actions}</div>}
    </li>
  )
}
