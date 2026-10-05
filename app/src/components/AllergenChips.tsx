import type { AllergenCode } from '../types.ts'
import type { RecipeAllergens } from '../lib/compute.ts'
import { useAllergenLabel } from '../lib/hooks.ts'
import { NA } from '../lib/format.ts'

function Chip({ code, kind, mine }: { code: AllergenCode; kind: 'contiene' | 'trazas'; mine: boolean }) {
  const label = useAllergenLabel()(code)
  const base = 'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap'
  const tone = mine
    ? 'bg-pass-soft text-pass ring-1 ring-pass/30'
    : kind === 'contiene'
      ? 'bg-panel text-ink'
      : 'border border-dashed border-muted/40 text-muted'
  return (
    <span className={`${base} ${tone}`}>
      <span aria-hidden>{label.emoji}</span>
      {kind === 'trazas' ? `Trazas: ${label.name}` : label.name}
    </span>
  )
}

interface Props {
  allergens: RecipeAllergens
  /** Alergias del perfil, para resaltarlas. */
  mine?: readonly AllergenCode[]
  /** Máximo de chips (tarjeta); el resto se resume en «+N». */
  max?: number
  /** Enseñar también trazas. */
  withTraces?: boolean
}

export function AllergenChips({ allergens, mine = [], max, withTraces = true }: Props) {
  const items: { code: AllergenCode; kind: 'contiene' | 'trazas' }[] = [
    ...allergens.contains.map((code) => ({ code, kind: 'contiene' as const })),
    ...(withTraces ? allergens.traces.map((code) => ({ code, kind: 'trazas' as const })) : []),
  ]
  const shown = max ? items.slice(0, max) : items
  const rest = items.length - shown.length
  const unknown = allergens.unknown.length > 0

  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Alérgenos">
      {shown.map((i) => (
        <li key={`${i.kind}-${i.code}`}>
          <Chip code={i.code} kind={i.kind} mine={mine.includes(i.code)} />
        </li>
      ))}
      {rest > 0 && (
        <li className="rounded-full bg-panel px-2.5 py-1 text-xs font-bold text-muted">+{rest}</li>
      )}
      {unknown && (
        <li className="inline-flex items-center gap-1 rounded-full bg-cream px-2.5 py-1 text-xs font-bold text-accent-dark">
          <span aria-hidden>❓</span> Alérgenos de {allergens.unknown.length === 1 ? '1 ingrediente' : `${allergens.unknown.length} ingredientes`}: {NA}
        </li>
      )}
      {items.length === 0 && !unknown && (
        <li className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand-dark">
          <span aria-hidden>✅</span> Sin alérgenos declarados
        </li>
      )}
    </ul>
  )
}
