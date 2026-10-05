import { BookHeart, ChefHat, ChevronRight, RotateCcw, ShieldCheck, ShieldQuestion, UserRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { BottomSheet } from '../components/BottomSheet.tsx'
import { HiddenReasons } from '../components/HiddenReasons.tsx'
import { Logo } from '../components/Logo.tsx'
import { SwipeDeck, type Decision } from '../components/SwipeDeck.tsx'
import { EmptyState, PrimaryButton } from '../components/ui.tsx'
import { LIKE_ADDS_TO_BASKET, useAppState } from '../lib/appState.ts'
import { rankRecipes, type RankInput, type RecipeInfo } from '../lib/compute.ts'
import { useCatalog } from '../lib/data.ts'
import { useHiddenSummary, useVisibility } from '../lib/hooks.ts'
import { useUi } from '../lib/ui.ts'

function hiddenText(byAllergy: number, byData: number): string {
  const recetas = (n: number) => `${n} ${n === 1 ? 'receta oculta' : 'recetas ocultas'}`
  const ocultas = (n: number) => `${n} ${n === 1 ? 'oculta' : 'ocultas'}`
  if (byAllergy && byData) return `${ocultas(byAllergy)} por tus alergias · ${byData} por falta de datos`
  if (byAllergy) return `${recetas(byAllergy)} por tus alergias`
  return `${recetas(byData)} por falta de datos`
}

export function Discover() {
  const catalog = useCatalog()
  const { state, dispatch } = useAppState()
  const ui = useUi()
  const visibility = useVisibility()
  const hidden = useHiddenSummary()
  const [showHidden, setShowHidden] = useState(false)
  /** La carta que asomaba detrás pasa delante aunque el ranking cambie tras decidir. */
  const [sticky, setSticky] = useState<string | null>(null)

  const ranked = useMemo(() => {
    const decided = new Set([...state.likes, ...state.passes])
    const input = (id: string): RankInput | null => {
      const i = catalog.info.get(id)
      return i ? { id, features: i.features } : null
    }
    const candidates = catalog.recipes
      .filter((r) => visibility.get(r.id)?.visible && !decided.has(r.id))
      .map((r) => input(r.id))
      .filter((x): x is RankInput => x !== null)
    const liked = state.likes.map(input).filter((x): x is RankInput => x !== null)
    const passed = state.passes.map(input).filter((x): x is RankInput => x !== null)
    return rankRecipes(candidates, liked, passed)
  }, [catalog, visibility, state.likes, state.passes])

  const { items, reasons } = useMemo(() => {
    const order = [...ranked]
    const at = sticky ? order.findIndex((r) => r.id === sticky) : -1
    if (at > 0) order.unshift(...order.splice(at, 1))
    const reasons = new Map<string, string>()
    for (const r of order) {
      if (!r.because) continue
      const liked = catalog.info.get(r.because.recipeId)?.recipe.name
      if (!liked) continue
      const shared = r.because.shared.slice(0, 2).join(', ').toLowerCase()
      reasons.set(r.id, `Porque te gustó «${liked}»${shared ? ` · ${shared}` : ''}`)
    }
    return {
      items: order.map((r) => catalog.info.get(r.id)).filter((x): x is RecipeInfo => x !== undefined),
      reasons,
    }
  }, [ranked, sticky, catalog])

  const onDecide = (id: string, decision: Decision) => {
    const wasInBasket = state.basket.recipeIds.includes(id)
    const name = catalog.info.get(id)?.recipe.name ?? 'la receta'
    setSticky(items[1]?.recipe.id ?? null)
    dispatch({ type: decision, id })
    ui.notify(
      decision === 'like'
        ? LIKE_ADDS_TO_BASKET
          ? `¡Sí! «${name}» va a tu cesta`
          : `«${name}» guardada en tu Recetario`
        : `Paso de «${name}»`,
      {
        label: 'Deshacer',
        run: () => {
          setSticky(id)
          dispatch({ type: 'undoDecision', id, wasInBasket })
        },
      },
    )
  }

  const visibleCount = catalog.recipes.length - hidden.total
  const noAllergies = state.profile.allergies.length === 0

  const empty =
    catalog.recipes.length === 0 ? (
      <EmptyState tone="dark" icon={<ChefHat className="size-9" />} title="Aún no hay recetas">
        El archivo de recetas está vacío. En cuanto haya recetas reales, aparecerán aquí.
      </EmptyState>
    ) : visibleCount === 0 ? (
      <EmptyState tone="dark" icon={<ShieldCheck className="size-9" />} title="Ninguna receta encaja con tu perfil">
        <p>Las {catalog.recipes.length} recetas están ocultas por tus alergias o por falta de datos.</p>
        <div className="mt-4 flex flex-col items-center gap-2">
          <PrimaryButton variant="white" onClick={() => setShowHidden(true)}>
            Ver por qué
          </PrimaryButton>
          <PrimaryButton variant="ghost" onClick={() => ui.goTo('perfil')}>
            Revisar mis alergias
          </PrimaryButton>
        </div>
      </EmptyState>
    ) : (
      <EmptyState tone="dark" icon={<BookHeart className="size-9" />} title="¡Ya las has visto todas!">
        <p>Has decidido sobre las {visibleCount} recetas disponibles para tu perfil.</p>
        <div className="mt-4 flex flex-col items-center gap-2">
          <PrimaryButton variant="white" onClick={() => ui.goTo('recetario')}>
            Ir a mi Recetario
          </PrimaryButton>
          {state.passes.length > 0 && (
            <PrimaryButton variant="ghost" onClick={() => dispatch({ type: 'clearPasses' })}>
              <RotateCcw className="size-4" aria-hidden /> Repasar las que pasaste
            </PrimaryButton>
          )}
        </div>
      </EmptyState>
    )

  return (
    <div className="flex h-full flex-col bg-brand bg-[radial-gradient(120%_70%_at_50%_0%,#27a65c_0%,transparent_60%)]">
      <header className="flex shrink-0 items-end justify-between gap-3 px-6 pb-2 pt-[calc(var(--top-inset)+12px)]">
        <h1>
          <Logo className="text-[34px]" />
        </h1>
      </header>

      <div className="flex min-h-7 shrink-0 px-5 pb-2">
        {hidden.total > 0 ? (
          <button
            type="button"
            onClick={() => setShowHidden(true)}
            className="flex min-w-0 items-center gap-1.5 rounded-full bg-white/15 py-1 pl-2.5 pr-2 text-xs font-bold text-white hover:bg-white/25"
          >
            <ShieldCheck className="size-4 shrink-0 text-sun" aria-hidden />
            <span className="truncate">{hiddenText(hidden.byAllergy.length, hidden.byData.length)}</span>
            <ChevronRight className="size-4 shrink-0" aria-hidden />
          </button>
        ) : noAllergies ? (
          <button
            type="button"
            onClick={() => ui.goTo('perfil')}
            className="flex items-center gap-1.5 rounded-full bg-white/15 py-1 pl-2.5 pr-2 text-xs font-bold text-white hover:bg-white/25"
          >
            <UserRound className="size-4 text-sun" aria-hidden />
            ¿Tienes alergias? Añádelas en tu perfil
            <ChevronRight className="size-4" aria-hidden />
          </button>
        ) : (
          <p className="flex items-center gap-1.5 py-1 text-xs font-bold text-white/85">
            <ShieldCheck className="size-4 text-sun" aria-hidden /> Filtrando por tus alergias
          </p>
        )}
      </div>

      <SwipeDeck
        items={items}
        mine={state.profile.allergies}
        reasons={reasons}
        onDecide={onDecide}
        onOpen={ui.openRecipe}
        empty={
          <div className="grid h-full place-items-center overflow-y-auto rounded-[30px] border-2 border-dashed border-white/30">
            {empty}
          </div>
        }
      />

      <BottomSheet open={showHidden} onClose={() => setShowHidden(false)} title="Recetas ocultas">
        <p className="mb-4 text-sm font-semibold text-muted">
          Reglas fijas, sin IA: si una receta lleva un alérgeno de tu perfil (o trazas, si las excluyes), no aparece. Si
          falta el dato de alérgenos de algún producto y tienes alergias, tampoco: preferimos no arriesgar.
        </p>
        {[...hidden.byAllergy, ...hidden.byData].length === 0 ? (
          <p className="text-sm font-semibold">No hay recetas ocultas.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {[...hidden.byAllergy, ...hidden.byData].map(({ info, visibility: v }) => (
              <li key={info.recipe.id} className="rounded-2xl bg-panel p-3.5">
                <p className="mb-1 flex items-center gap-1.5 font-extrabold">
                  {v.byAllergy ? (
                    <ShieldCheck className="size-4 text-pass" aria-hidden />
                  ) : (
                    <ShieldQuestion className="size-4 text-accent-dark" aria-hidden />
                  )}
                  {info.recipe.name}
                </p>
                <HiddenReasons reasons={v.reasons} />
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 flex justify-center">
          <PrimaryButton
            variant="brand"
            onClick={() => {
              setShowHidden(false)
              ui.goTo('perfil')
            }}
          >
            Revisar mis alergias
          </PrimaryButton>
        </div>
      </BottomSheet>
    </div>
  )
}
