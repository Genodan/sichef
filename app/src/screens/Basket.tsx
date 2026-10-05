import { Check, Info, MapPin, PackageX, RotateCcw, ShoppingBasket, Store as StoreIcon, X } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import type { Recipe, Store } from '../types.ts'
import { SafeImage } from '../components/SafeImage.tsx'
import { EmptyState, PrimaryButton, ScreenHeader } from '../components/ui.tsx'
import { getIngredientStatus, useAppState } from '../lib/appState.ts'
import { buildShoppingList, type ShoppingItem } from '../lib/compute.ts'
import { useCatalog } from '../lib/data.ts'
import { formatDate, formatEuro, NA, plural } from '../lib/format.ts'
import { useCurrentStore, useVisibility } from '../lib/hooks.ts'
import { useUi } from '../lib/ui.ts'

/** Mini-mapa en rejilla: resalta los pasillos que hay que visitar y en qué orden. */
function StoreMap({ store, route, done }: { store: Store; route: number[]; done: ReadonlySet<number> }) {
  const aisles = [...(store.aisles ?? [])].sort((a, b) => a.number - b.number)
  if (aisles.length === 0) return <p className="text-sm italic text-muted">Mapa: {NA}</p>
  const cols = Math.min(6, aisles.length)
  return (
    <div>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        role="img"
        aria-label={
          route.length
            ? `Mapa de la tienda: visita los pasillos ${route.join(', ')} en este orden.`
            : 'Mapa de la tienda: no hay pasillos que visitar.'
        }
      >
        {aisles.map((a) => {
          const step = route.indexOf(a.number)
          const active = step >= 0
          const isDone = done.has(a.number)
          return (
            <div
              key={a.number}
              title={a.name}
              className={`relative flex h-16 flex-col items-center justify-center rounded-xl px-0.5 text-center ${
                active ? (isDone ? 'bg-brand-soft text-brand' : 'bg-brand text-white') : 'bg-panel text-muted/70'
              }`}
            >
              <span className="text-base font-black leading-none">{a.number}</span>
              <span className="mt-1 line-clamp-2 text-[8.5px] font-bold leading-tight">{a.name}</span>
              {active && (
                <span className="absolute -right-1 -top-1.5 grid size-5 place-items-center rounded-full bg-accent text-[10px] font-black text-white ring-2 ring-white">
                  {isDone ? <Check className="size-3" strokeWidth={4} /> : step + 1}
                </span>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] font-extrabold uppercase tracking-wide text-muted" aria-hidden>
        <span>↑ Entrada</span>
        <span>Cajas ↑</span>
      </div>
    </div>
  )
}

function ItemRow({ item, checked, onToggle }: { item: ShoppingItem; checked: boolean; onToggle: () => void }) {
  const { product } = item
  return (
    <li>
      <label className="relative flex items-center gap-3 py-2.5">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={onToggle}
          aria-label={`${product.name}: ${checked ? 'en el carro' : 'por coger'}`}
        />
        <span
          className="grid size-6 shrink-0 place-items-center rounded-lg border-2 border-line bg-white text-white transition-colors peer-checked:border-brand peer-checked:bg-brand peer-focus-visible:ring-4 peer-focus-visible:ring-sun"
          aria-hidden
        >
          {checked && <Check className="size-4" strokeWidth={4} />}
        </span>
        <SafeImage
          src={product.thumbnail}
          alt=""
          kind="producto"
          className={`size-12 shrink-0 rounded-xl bg-white object-contain ring-1 ring-line transition-opacity ${checked ? 'opacity-50' : ''}`}
        />
        <span className="min-w-0 flex-1">
          <span className={`block font-extrabold leading-tight ${checked ? 'text-muted line-through' : ''}`}>{product.name}</span>
          <span className="block text-xs font-semibold text-muted">
            {item.packages !== null ? `${item.packages} × ${formatEuro(product.unit_price)}` : `Envases: ${NA}`}
            {' · '}
            {item.uses.map((u) => `${u.recipeName} (${u.label})`).join(', ')}
          </span>
          {item.location && (
            <span className="block text-[11px] font-bold text-brand-dark">
              {item.location.side === 'izq' ? 'Izquierda' : 'Derecha'} · balda {item.location.shelf}
            </span>
          )}
          {item.inStock === false && <span className="block text-[11px] font-extrabold text-pass">Sin stock en esta tienda (simulado)</span>}
        </span>
        <span className={`shrink-0 text-sm font-extrabold tabular-nums ${checked ? 'text-muted' : ''}`}>
          {item.cost !== null ? formatEuro(item.cost) : <span className="text-[11px] italic font-semibold text-muted">{NA}</span>}
        </span>
      </label>
    </li>
  )
}

export function Basket() {
  const catalog = useCatalog()
  const { state, dispatch } = useAppState()
  const store = useCurrentStore()
  const visibility = useVisibility()
  const ui = useUi()

  const recipes = useMemo(
    () => state.basket.recipeIds.map((id) => catalog.info.get(id)?.recipe).filter((r): r is Recipe => r !== undefined),
    [state.basket.recipeIds, catalog],
  )
  const isIngredientInBasket = useCallback(
    (recipeId: string, ingredientIndex: number) =>
      getIngredientStatus(state.pantry, recipeId, ingredientIndex) === 'basket',
    [state.pantry],
  )

  const list = useMemo(
    () => buildShoppingList(recipes, catalog.productsById, store, isIngredientInBasket),
    [recipes, catalog, store, isIngredientInBasket],
  )
  const checked = useMemo(() => new Set(state.basket.checked), [state.basket.checked])
  const doneCount = list.items.filter((i) => checked.has(i.product.id)).length
  const doneAisles = useMemo(
    () =>
      new Set(
        list.groups
          .filter((g) => g.aisle !== null && g.items.every((i) => checked.has(i.product.id)))
          .map((g) => g.aisle as number),
      ),
    [list, checked],
  )
  const flagged = recipes.filter((r) => visibility.get(r.id)?.visible === false)

  return (
    <div className="flex h-full flex-col bg-canvas">
      <ScreenHeader title="Cesta" subtitle="Tu lista, ordenada por pasillo: es tu ruta por la tienda.">
        {catalog.stores.length > 0 ? (
          <label className="relative mt-3 flex h-11 items-center gap-2 rounded-full bg-white/15 pl-3.5 pr-3 text-sm font-bold">
            <StoreIcon className="size-4 shrink-0 text-sun" aria-hidden />
            <span className="sr-only">Tienda</span>
            <select
              value={store?.id ?? ''}
              onChange={(e) => dispatch({ type: 'setStore', storeId: e.target.value })}
              className="h-full min-w-0 flex-1 appearance-none bg-transparent font-bold text-white outline-none [&>option]:text-ink"
            >
              {catalog.stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <span aria-hidden className="text-white/80">
              ▾
            </span>
          </label>
        ) : (
          <p className="mt-3 text-sm font-semibold text-white/85">Tienda: {NA}</p>
        )}
      </ScreenHeader>

      <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-8 pt-4">
        <p className="mb-3 flex gap-2 rounded-2xl bg-cream px-3.5 py-2.5 text-xs font-semibold text-accent-dark">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <strong className="font-extrabold">Tienda simulada.</strong> Pasillos y stock son de demostración; en una tienda real
            vendrían de su servidor interno y de las etiquetas digitales.
          </span>
        </p>

        {recipes.length === 0 ? (
          <EmptyState icon={<ShoppingBasket className="size-9" />} title="Tu cesta está vacía">
            <p>Entra en tus recetas del Recetario y añade a la cesta los ingredientes que necesites comprar.</p>
            <div className="mt-4 flex flex-col items-center gap-2">
              <PrimaryButton variant="brand" onClick={() => ui.goTo('recetario')}>
                Ir a mi Recetario
              </PrimaryButton>
              <PrimaryButton variant="ghost" onClick={() => ui.goTo('descubre')}>
                Descubrir recetas
              </PrimaryButton>
            </div>
          </EmptyState>
        ) : (
          <>
            <ul className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Recetas en la cesta">
              {recipes.map((r) => (
                <li key={r.id} className="flex shrink-0 items-center gap-2 rounded-full bg-white py-1 pl-1 pr-1 shadow-soft">
                  <button type="button" onClick={() => ui.openRecipe(r.id)} className="flex items-center gap-2">
                    <SafeImage src={r.image?.url} alt="" className="size-8 rounded-full object-cover" />
                    <span className="max-w-36 truncate text-sm font-extrabold">{r.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'removeFromBasket', id: r.id })}
                    aria-label={`Quitar ${r.name} de la cesta`}
                    className="grid size-7 place-items-center rounded-full bg-panel text-muted"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>

            {flagged.length > 0 && (
              <p className="mb-3 rounded-2xl bg-pass-soft px-3.5 py-2.5 text-xs font-bold text-pass" role="alert">
                Ojo: {flagged.map((r) => `«${r.name}»`).join(', ')} no {flagged.length === 1 ? 'encaja' : 'encajan'} con tus
                alergias actuales.
              </p>
            )}

            <section className="mb-3 rounded-3xl bg-white p-4 shadow-soft" aria-label="Resumen">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wide text-muted">Total en caja</p>
                  <p className="text-[32px] font-black leading-none tabular-nums text-brand-dark">
                    {formatEuro(list.total)}
                    {list.partial && list.total !== null && <span className="text-lg text-accent-dark">*</span>}
                  </p>
                </div>
                <p className="pb-1 text-right text-xs font-bold text-muted">
                  {plural(list.items.length, 'producto', 'productos')}
                  <br />
                  {doneCount}/{list.items.length} en el carro
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-brand transition-all"
                  style={{ width: `${list.items.length ? (doneCount / list.items.length) * 100 : 0}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] font-semibold text-muted">
                Calculado: envases completos × precio de tienda.mercadona.es ({formatDate(catalog.dataDate)}).
                {list.partial && ' * Parcial: falta el precio o el producto de algún ingrediente.'}
              </p>
            </section>

            {store && (
              <section className="mb-3 rounded-3xl bg-white p-4 shadow-soft" aria-labelledby="ruta-titulo">
                <h2 id="ruta-titulo" className="mb-3 flex items-center gap-1.5 text-base font-extrabold">
                  <MapPin className="size-4 text-brand" aria-hidden /> Tu ruta por la tienda
                </h2>
                <StoreMap store={store} route={list.aislesToVisit} done={doneAisles} />
              </section>
            )}

            <div className="flex flex-col gap-3">
              {list.groups.map((g) => (
                <section key={g.aisle ?? 'sin'} className="rounded-3xl bg-white px-4 pb-1.5 pt-3.5 shadow-soft">
                  <h2 className="flex items-center gap-2 text-base font-extrabold">
                    <span
                      className={`grid size-7 place-items-center rounded-full text-sm font-black ${
                        g.aisle === null ? 'bg-panel text-muted' : doneAisles.has(g.aisle) ? 'bg-brand-soft text-brand' : 'bg-brand text-white'
                      }`}
                      aria-hidden
                    >
                      {g.aisle ?? '?'}
                    </span>
                    {g.aisle === null ? `Ubicación: ${NA}` : `Pasillo ${g.aisle}${g.aisleName ? ` · ${g.aisleName}` : ''}`}
                    <span className="ml-auto text-xs font-bold text-muted">{g.items.length}</span>
                  </h2>
                  <ul className="divide-y divide-line">
                    {g.items.map((item) => (
                      <ItemRow
                        key={item.product.id}
                        item={item}
                        checked={checked.has(item.product.id)}
                        onToggle={() => dispatch({ type: 'toggleChecked', productId: item.product.id })}
                      />
                    ))}
                  </ul>
                </section>
              ))}

              {list.missing.length > 0 && (
                <section className="rounded-3xl bg-white p-4 shadow-soft">
                  <h2 className="mb-2 flex items-center gap-2 text-base font-extrabold">
                    <PackageX className="size-5 text-muted" aria-hidden /> Sin producto en el catálogo
                  </h2>
                  <ul className="flex flex-col gap-1 text-sm">
                    {list.missing.map((m, i) => (
                      <li key={`${m.recipeId}-${i}`}>
                        <strong className="font-extrabold">{m.ingredient}</strong> ({m.label}) · {m.recipeName}:{' '}
                        <span className="italic text-muted">{NA}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {doneCount > 0 && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'clearChecked' })}
                  className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-extrabold text-muted hover:bg-white"
                >
                  <RotateCcw className="size-4" aria-hidden /> Desmarcar todo
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
