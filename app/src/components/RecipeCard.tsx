import { Sparkles, TrendingDown } from 'lucide-react'
import type { AllergenCode } from '../types.ts'
import type { HouseholdSuitability, RecipeInfo } from '../lib/compute.ts'
import { formatEuro, NA, plural } from '../lib/format.ts'
import { useAllergenLabel } from '../lib/hooks.ts'
import { AllergenChips } from './AllergenChips.tsx'
import { NutrientBars } from './Nutrition.tsx'
import { SafeImage } from './SafeImage.tsx'

/** Cinta naranja de la esquina: €/ración calculado y, si toca, «Ha bajado de precio». */
export function PriceRibbon({ info }: { info: RecipeInfo }) {
  const { cost, priceDecreased } = info
  const decreased = priceDecreased.length > 0
  const hasPrice = cost.perServing !== null
  const main = hasPrice ? `${formatEuro(cost.perServing)}/ración` : 'Precio'
  const sub = decreased ? 'Ha bajado de precio' : !hasPrice ? NA : cost.partial ? 'calculado · parcial' : 'calculado'
  return (
    <div className="pointer-events-none absolute right-0 top-0 size-[160px] overflow-hidden">
      <div className="absolute -right-[59px] top-[36px] w-[230px] rotate-45 bg-accent py-1 text-center text-white shadow-soft">
        <p className="text-[15px] font-black leading-tight tabular-nums">{main}</p>
        <p className="flex items-center justify-center gap-1 text-[9.5px] font-extrabold uppercase tracking-wide">
          {decreased && <TrendingDown className="size-3" aria-hidden />}
          {sub}
        </p>
      </div>
    </div>
  )
}

/** Indicador en la tarjeta de quién puede comer en casa y quién no. */
export function HouseholdCardBadge({ suitability }: { suitability?: HouseholdSuitability }) {
  const allergenLabel = useAllergenLabel()
  if (!suitability || suitability.members.length === 0) return null

  if (suitability.allCanEat) {
    const names = suitability.canEat.map((m) => m.memberName).join(', ')
    return (
      <div className="flex items-center gap-1.5 rounded-2xl bg-brand-soft px-2.5 py-1 text-xs font-black text-brand-dark">
        <span className="text-sm leading-none" aria-hidden>✅</span>
        <span className="truncate">
          Apto para toda la casa <span className="font-semibold text-brand-dark/80">({names})</span>
        </span>
      </div>
    )
  }

  if (suitability.someCanEat) {
    return (
      <div className="flex flex-wrap items-center gap-1 text-[11.5px] font-black leading-tight">
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-brand-dark">
          <span aria-hidden>✅</span> {suitability.canEat.map((m) => m.memberName).join(', ')}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-pass-soft px-2 py-0.5 text-pass">
          <span aria-hidden>❌</span>{' '}
          {suitability.cannotEat
            .map((m) => {
              const conflicts = m.conflictAllergens.map((c) => allergenLabel(c).name).join(', ')
              return `${m.memberName}${conflicts ? ` (${conflicts})` : ''}`
            })
            .join(' · ')}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 rounded-2xl bg-pass-soft px-2.5 py-1 text-xs font-black text-pass">
      <span className="text-sm leading-none" aria-hidden>❌</span>
      <span className="truncate">
        No apto en casa:{' '}
        <span className="font-semibold">
          {suitability.cannotEat
            .map((m) => {
              const conflicts = m.conflictAllergens.map((c) => allergenLabel(c).name).join(', ')
              return `${m.memberName}${conflicts ? ` (${conflicts})` : ''}`
            })
            .join(' · ')}
        </span>
      </span>
    </div>
  )
}

interface Props {
  info: RecipeInfo
  mine: readonly AllergenCode[]
  suitability?: HouseholdSuitability
  /** «¿Por qué esta receta?» (plantilla fija, calculada por la recomendación). */
  reason?: string
}

export function RecipeCard({ info, mine, suitability, reason }: Props) {
  const { recipe, nutrition, badges, allergens } = info
  const badge = badges[0]
  return (
    <article
      className="flex h-full select-none flex-col overflow-hidden rounded-[30px] bg-white p-2.5 shadow-card"
      aria-label={`Receta: ${recipe.name}`}
    >
      <div className="relative min-h-[110px] flex-1 overflow-hidden rounded-[22px] bg-brand-soft">
        <SafeImage
          src={recipe.image?.url}
          alt={recipe.name}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-x-0 top-0 h-3/4 bg-linear-to-b from-black/65 via-black/25 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-1/4 bg-linear-to-t from-black/25 to-transparent" />
        <div className="absolute left-4 right-24 top-4 text-white drop-shadow">
          <h2 className="text-balance text-[27px] font-black leading-[1.05]">{recipe.name}</h2>
          {recipe.subtitle && <p className="mt-1 line-clamp-2 text-sm font-semibold text-white/90">{recipe.subtitle}</p>}
        </div>
        <PriceRibbon info={info} />
        {reason && (
          <p className="absolute bottom-3 left-3 flex max-w-[calc(100%-24px)] items-center gap-1 rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-bold text-ink shadow-soft">
            <Sparkles className="size-3.5 shrink-0 text-accent" aria-hidden />
            <span className="truncate">{reason}</span>
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-2 px-2 pb-1 pt-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-extrabold">Por ración</h3>
          {badge && (
            <span className="truncate rounded-full bg-cream px-2.5 py-1 text-xs font-extrabold text-accent-dark">
              {badge.label}
            </span>
          )}
        </div>
        <NutrientBars nutrition={nutrition} />
        <HouseholdCardBadge suitability={suitability} />
        <AllergenChips allergens={allergens} mine={mine} max={2} withTraces={false} />
        {nutrition.partial && nutrition.counted > 0 && (
          <p className="truncate text-[10.5px] font-semibold text-muted">
            * Nutrición parcial:{' '}
            {nutrition.missing.length > 0
              ? `faltan datos de ${plural(nutrition.missing.length, 'ingrediente', 'ingredientes')}`
              : 'faltan algunos valores de los productos'}
          </p>
        )}
      </div>
    </article>
  )
}
