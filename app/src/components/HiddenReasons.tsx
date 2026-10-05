import type { AllergenCode } from '../types.ts'
import type { HiddenReason } from '../lib/compute.ts'
import { NA } from '../lib/format.ts'
import { useAllergenLabel } from '../lib/hooks.ts'

/** Explica con reglas fijas por qué una receta está oculta para este perfil. */
export function HiddenReasons({ reasons }: { reasons: readonly HiddenReason[] }) {
  const label = useAllergenLabel()
  const names = (codes: readonly AllergenCode[]) =>
    codes
      .map((c) => {
        const l = label(c)
        return `${l.emoji} ${l.name}`
      })
      .join(', ')

  return (
    <ul className="flex flex-col gap-1 text-sm">
      {reasons.map((r) => (
        <li key={r.kind} className="leading-snug">
          {r.kind === 'contiene' && (
            <>
              <strong className="font-extrabold">Contiene</strong> {names(r.allergens)}.
            </>
          )}
          {r.kind === 'trazas' && (
            <>
              <strong className="font-extrabold">Puede contener</strong> {names(r.allergens)} (excluyes las trazas).
            </>
          )}
          {r.kind === 'dato_no_disponible' && (
            <>
              <strong className="font-extrabold">Alérgenos: {NA}</strong> en{' '}
              {r.items
                .map((i) => (i.reason === 'sin_producto' ? `«${i.ingredient}» (sin producto en el catálogo)` : `«${i.product ?? i.ingredient}»`))
                .join(', ')}
              . Como tienes alergias, no te la enseñamos.
            </>
          )}
        </li>
      ))}
    </ul>
  )
}
