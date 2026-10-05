import { CARD_NUTRIENTS, percentOfReference, type RecipeNutrition } from '../lib/compute.ts'
import { formatNumber, formatNutrient, NA } from '../lib/format.ts'
import { NUTRIENT_META } from '../lib/nutrientMeta.ts'

/** Barras de la tarjeta (3 columnas × 2 filas, compacto). Escala = % de la ingesta de referencia. */
export function NutrientBars({ nutrition }: { nutrition: RecipeNutrition }) {
  return (
    <dl className="grid grid-cols-3 gap-x-3 gap-y-1.5">
      {CARD_NUTRIENTS.map((key) => {
        const meta = NUTRIENT_META[key]
        const value = nutrition.perServing[key]
        const pct = percentOfReference(key, value)
        const partial = nutrition.partialFields.includes(key)
        return (
          <div key={key} className="min-w-0">
            <div className="flex items-center gap-1">
              <meta.Icon className={`size-3.5 shrink-0 ${meta.text}`} aria-hidden />
              <dt className="truncate text-[11px] font-bold">{meta.label}</dt>
            </div>
            <div className="flex items-center">
              <dd className="text-[13px] font-extrabold leading-tight tabular-nums">
                {value === null ? '' : formatNutrient(key, value)}
                {value !== null && partial && <span className="text-accent-dark" aria-label="(parcial)">*</span>}
              </dd>
            </div>
            {value === null ? (
              <p className="truncate text-[10px] font-semibold italic text-muted">{NA}</p>
            ) : (
              <div
                className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-line"
                role="meter"
                aria-label={`${meta.label}: ${formatNumber(pct ?? 0)} % de la ingesta de referencia`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(Math.min(100, pct ?? 0))}
              >
                <div
                  className={`h-full rounded-full ${meta.bar}`}
                  style={{ width: `${Math.max(4, Math.min(100, pct ?? 0))}%` }}
                />
              </div>
            )}
          </div>
        )
      })}
    </dl>
  )
}

/** Rejilla de la hoja de receta (3 × 2, como el mockup) con % de ingesta de referencia. */
export function NutritionGrid({ nutrition }: { nutrition: RecipeNutrition }) {
  return (
    <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-line ring-1 ring-line">
      {CARD_NUTRIENTS.map((key) => {
        const meta = NUTRIENT_META[key]
        const value = nutrition.perServing[key]
        const pct = percentOfReference(key, value)
        const partial = nutrition.partialFields.includes(key)
        return (
          <div key={key} className="flex flex-col items-center gap-0.5 bg-panel px-1 py-3 text-center">
            <dt className="flex items-center gap-1 text-xs font-bold text-muted">
              <meta.Icon className={`size-3.5 ${meta.text}`} aria-hidden />
              {meta.label}
            </dt>
            <dd className={value === null ? 'text-[11px] font-semibold italic leading-tight text-muted' : 'text-base font-extrabold tabular-nums'}>
              {formatNutrient(key, value)}
              {value !== null && partial && <span className="text-accent-dark" aria-label="(parcial)">*</span>}
            </dd>
            {pct !== null && <dd className="text-[10px] font-semibold text-muted">{formatNumber(pct)} % IR</dd>}
          </div>
        )
      })}
    </dl>
  )
}
