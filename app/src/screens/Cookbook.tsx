import { BookHeart, Check, CircleDot, HeartOff, House, ListChecks, ShoppingBasket } from 'lucide-react'
import { RecipeRow } from '../components/RecipeRow.tsx'
import { EmptyState, PrimaryButton, ScreenHeader } from '../components/ui.tsx'
import { getRecipeIngredientCounts, useAppState } from '../lib/appState.ts'
import type { RecipeInfo } from '../lib/compute.ts'
import { useCatalog } from '../lib/data.ts'
import { plural } from '../lib/format.ts'
import { useAllBasketOverlaps, useHouseholdSuitability, useVisibility } from '../lib/hooks.ts'
import { useUi } from '../lib/ui.ts'

export function Cookbook() {
  const { info } = useCatalog()
  const { state, dispatch } = useAppState()
  const visibility = useVisibility()
  const household = useHouseholdSuitability()
  const basketOverlaps = useAllBasketOverlaps()
  const ui = useUi()
  const liked = [...state.likes]
    .reverse()
    .map((id) => info.get(id))
    .filter((x): x is RecipeInfo => x !== undefined)

  return (
    <div className="flex h-full flex-col bg-canvas">
      <ScreenHeader
        title="Recetario"
        subtitle={liked.length ? `${plural(liked.length, 'receta', 'recetas')} con «¡Sí!»` : 'Tus recetas con «¡Sí!»'}
      />
      <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-6 pt-4">
        {liked.length === 0 ? (
          <EmptyState icon={<BookHeart className="size-9" />} title="Aún no has dicho «¡Sí!»">
            <p>Desliza a la derecha las recetas que te apetezcan y se guardarán aquí.</p>
            <PrimaryButton variant="brand" className="mt-4" onClick={() => ui.goTo('descubre')}>
              Ir a Descubre
            </PrimaryButton>
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {liked.map((i) => {
              const id = i.recipe.id
              const totalIngredients = i.recipe.ingredients.length
              const counts = getRecipeIngredientCounts(state.pantry, id, totalIngredients)
              return (
                <RecipeRow
                  key={id}
                  info={i}
                  visibility={visibility.get(id)}
                  suitability={household.get(id)}
                  basketOverlap={basketOverlaps.get(id)}
                  onOpen={() => ui.openRecipe(id)}
                  ingredientSummary={
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold">
                      {counts.basket > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2 py-0.5 text-accent-dark">
                          <ShoppingBasket className="size-3 shrink-0" aria-hidden />
                          {counts.basket} en cesta
                        </span>
                      )}
                      {counts.home > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-brand-dark">
                          <House className="size-3 shrink-0" aria-hidden />
                          {counts.home} en casa
                        </span>
                      )}
                      {counts.none > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-panel px-2 py-0.5 text-muted">
                          <CircleDot className="size-3 shrink-0" aria-hidden />
                          {counts.none} {plural(counts.none, 'pendiente', 'pendientes')}
                        </span>
                      )}
                      {counts.none === 0 && counts.basket === 0 && counts.home > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-brand-dark">
                          <Check className="size-3 shrink-0" aria-hidden />
                          Todo en casa
                        </span>
                      )}
                    </div>
                  }
                  actions={
                    <>
                      <button
                        type="button"
                        aria-label={`Ver ingredientes de ${i.recipe.name}`}
                        onClick={() => ui.openRecipe(id)}
                        className="flex items-center gap-1.5 rounded-2xl bg-cream px-2.5 py-2 text-xs font-black text-accent-dark hover:bg-accent hover:text-white transition-colors"
                      >
                        <ListChecks className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
                        <span>Ingredientes</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Quitar ${i.recipe.name} del Recetario`}
                        onClick={() => {
                          dispatch({ type: 'unlike', id })
                          ui.notify('Quitada del Recetario', {
                            label: 'Deshacer',
                            run: () => {
                              dispatch({ type: 'like', id })
                            },
                          })
                        }}
                        className="grid size-8 place-items-center self-end rounded-full bg-panel text-muted hover:text-pass transition-colors"
                      >
                        <HeartOff className="size-4" aria-hidden />
                      </button>
                    </>
                  }
                />
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
