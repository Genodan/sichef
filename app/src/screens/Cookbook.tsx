import { BookHeart, HeartOff, ShoppingBasket } from 'lucide-react'
import { RecipeRow } from '../components/RecipeRow.tsx'
import { EmptyState, PrimaryButton, ScreenHeader } from '../components/ui.tsx'
import { useAppState } from '../lib/appState.ts'
import type { RecipeInfo } from '../lib/compute.ts'
import { useCatalog } from '../lib/data.ts'
import { plural } from '../lib/format.ts'
import { useVisibility } from '../lib/hooks.ts'
import { useUi } from '../lib/ui.ts'

export function Cookbook() {
  const { info } = useCatalog()
  const { state, dispatch } = useAppState()
  const visibility = useVisibility()
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
              const inBasket = state.basket.recipeIds.includes(id)
              return (
                <RecipeRow
                  key={id}
                  info={i}
                  visibility={visibility.get(id)}
                  onOpen={() => ui.openRecipe(id)}
                  actions={
                    <>
                      <button
                        type="button"
                        aria-pressed={inBasket}
                        aria-label={inBasket ? `Quitar ${i.recipe.name} de la cesta` : `Añadir ${i.recipe.name} a la cesta`}
                        onClick={() => {
                          dispatch({ type: inBasket ? 'removeFromBasket' : 'addToBasket', id })
                          ui.notify(inBasket ? 'Quitada de la cesta' : `«${i.recipe.name}» está en tu cesta`)
                        }}
                        className={`grid size-10 place-items-center rounded-full ${inBasket ? 'bg-accent text-white' : 'bg-cream text-accent-dark'}`}
                      >
                        <ShoppingBasket className="size-5" strokeWidth={2.5} aria-hidden />
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
                              if (!inBasket) dispatch({ type: 'removeFromBasket', id })
                            },
                          })
                        }}
                        className="grid size-10 place-items-center rounded-full bg-panel text-muted"
                      >
                        <HeartOff className="size-5" aria-hidden />
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
