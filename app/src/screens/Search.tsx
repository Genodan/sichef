import {
  ChevronRight,
  Flame,
  MapPin,
  PackageSearch,
  Search as SearchIcon,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Product } from '../types.ts'
import { RecipeRow } from '../components/RecipeRow.tsx'
import { SafeImage } from '../components/SafeImage.tsx'
import { EmptyState, ScreenHeader } from '../components/ui.tsx'
import { normalizeText, type RecipeInfo } from '../lib/compute.ts'
import { useCatalog } from '../lib/data.ts'
import { formatEuro, formatLocation, formatNutrient, plural } from '../lib/format.ts'
import { useCurrentStore, useHouseholdSuitability, useVisibility } from '../lib/hooks.ts'
import { useUi } from '../lib/ui.ts'

function ProductButton({
  product,
  count,
  aisle,
  onClick,
}: {
  product: Product
  count: number
  aisle?: number | null
  onClick: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-2xl bg-white p-2.5 text-left shadow-soft transition active:scale-[0.99] hover:bg-canvas/50"
      >
        <SafeImage
          src={product.thumbnail}
          alt=""
          kind="producto"
          className="size-12 shrink-0 rounded-xl bg-white object-contain ring-1 ring-line"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-extrabold leading-tight text-ink">{product.name}</span>
          <span className="block truncate text-xs font-semibold text-muted">
            {product.category} · {formatEuro(product.unit_price)}
            {product.bulk_price ? ` (${formatEuro(product.bulk_price)}/${product.reference_format})` : ''}
          </span>
        </span>
        {count > 0 ? (
          <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-extrabold text-brand-dark">
            {plural(count, 'receta', 'recetas')}
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-panel px-2.5 py-0.5 text-xs font-bold text-muted">
            {aisle ? `Pasillo ${aisle}` : 'En tienda'}
          </span>
        )}
        <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
      </button>
    </li>
  )
}

export function Search() {
  const { products, productsById, recipes, info } = useCatalog()
  const store = useCurrentStore()
  const visibility = useVisibility()
  const household = useHouseholdSuitability()
  const ui = useUi()
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Todos')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // producto → recetas que lo usan
  const usage = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const r of recipes) {
      for (const ing of r.ingredients) {
        if (!ing.product_id || !productsById.has(ing.product_id)) continue
        const list = m.get(ing.product_id) ?? []
        if (!list.includes(r.id)) list.push(r.id)
        m.set(ing.product_id, list)
      }
    }
    return m
  }, [recipes, productsById])

  // Categorías dinámicas a partir de los 100 productos
  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const p of products) {
      if (p.category) set.add(p.category)
    }
    return ['Todos', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))]
  }, [products])

  const used = useMemo(() => products.filter((p) => usage.has(p.id)), [products, usage])
  const popular = useMemo(
    () => [...used].sort((a, b) => (usage.get(b.id)?.length ?? 0) - (usage.get(a.id)?.length ?? 0)).slice(0, 6),
    [used, usage],
  )

  const filteredByCategory = useMemo(() => {
    if (selectedCategory === 'Todos') return products
    return products.filter((p) => p.category === selectedCategory)
  }, [products, selectedCategory])

  const q = normalizeText(query)
  const matches = useMemo(() => {
    if (!q) return filteredByCategory

    // Búsqueda inteligente: coincide con nombre de producto, categoría, ID/EAN o nombre de plato/ingrediente
    const byRecipe = new Set<string>()
    for (const r of recipes) {
      const matchRecipe = normalizeText(r.name).includes(q)
      for (const ing of r.ingredients) {
        if (ing.product_id && (matchRecipe || normalizeText(ing.name).includes(q))) {
          byRecipe.add(ing.product_id)
        }
      }
    }

    return filteredByCategory.filter(
      (p) =>
        normalizeText(p.name).includes(q) ||
        normalizeText(p.category ?? '').includes(q) ||
        byRecipe.has(p.id) ||
        p.id === q.trim() ||
        (p.ean && p.ean.includes(q.trim())),
    )
  }, [q, filteredByCategory, recipes])

  const selected = selectedId ? productsById.get(selectedId) : undefined
  const selectedLoc = selected && store ? store.locations[selected.id] : undefined
  const selectedRecipes = (selected ? (usage.get(selected.id) ?? []) : [])
    .map((id) => info.get(id))
    .filter((x): x is RecipeInfo => x !== undefined)
  const visibleRecipes = selectedRecipes.filter((i) => {
    const s = household.get(i.recipe.id)
    return s && s.members.length > 0 ? s.canEat.length > 0 : visibility.get(i.recipe.id)?.visible
  })
  const hiddenCount = selectedRecipes.length - visibleRecipes.length

  return (
    <div className="flex h-full flex-col bg-canvas">
      <ScreenHeader
        title="Catálogo & Recetas"
        subtitle={`Explora los ${products.length} productos de Mercadona y descubre qué cocinar.`}
      >
        <div className="relative mt-4">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedId(null)
            }}
            placeholder="Buscar producto, categoría (pollo, arroz, fruta...)"
            aria-label="Buscar producto por nombre o categoría"
            className="h-12 w-full rounded-full bg-white pl-12 pr-4 font-semibold text-ink shadow-soft outline-none placeholder:text-muted/70 focus-visible:ring-4 focus-visible:ring-sun"
          />
        </div>

        {/* Chips de categorías del supermercado */}
        <div className="no-scrollbar -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat
            const count = cat === 'Todos' ? products.length : products.filter((p) => p.category === cat).length
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat)
                  setSelectedId(null)
                }}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold transition ${
                  isSelected
                    ? 'bg-brand text-white shadow-soft'
                    : 'bg-white/80 text-muted hover:bg-white hover:text-ink'
                }`}
              >
                {cat} <span className="opacity-75">({count})</span>
              </button>
            )
          })}
        </div>
      </ScreenHeader>

      <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-6 pt-4">
        {!selected && (
          <button
            type="button"
            onClick={() => ui.goTo('chat')}
            className="mb-3 flex w-full items-center justify-between gap-2 rounded-2xl border border-brand/20 bg-brand-soft/70 p-3 text-left transition-colors hover:bg-brand-soft"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand text-white shadow-2xs">
                <Sparkles className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-black text-brand-dark">¿Prefieres pedir lo que te apetece?</p>
                <p className="truncate text-[11px] font-semibold text-muted">Habla con el Chef IA para recomendaciones directas</p>
              </div>
            </div>
            <ChevronRight className="size-4 shrink-0 text-brand" aria-hidden />
          </button>
        )}
        {selected ? (
          <>
            {/* Tarjeta de producto seleccionado */}
            <div className="mb-4 rounded-3xl bg-white p-4 shadow-soft">
              <div className="flex items-start gap-3">
                <SafeImage
                  src={selected.thumbnail}
                  alt=""
                  kind="producto"
                  className="size-20 shrink-0 rounded-2xl bg-white object-contain ring-1 ring-line"
                />
                <div className="min-w-0 flex-1">
                  <span className="inline-block rounded-md bg-panel px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">
                    {selected.category}
                  </span>
                  <p className="mt-0.5 truncate text-lg font-extrabold leading-tight text-ink">{selected.name}</p>
                  <p className="text-sm font-bold text-brand">
                    {formatEuro(selected.unit_price)}
                    <span className="text-xs font-normal text-muted">
                      {' '}
                      · {formatEuro(selected.bulk_price)}/{selected.reference_format} ({selected.packaging})
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  aria-label="Quitar producto seleccionado"
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-panel text-muted transition hover:bg-line hover:text-ink"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>

              {/* Ubicación en tienda física */}
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-canvas p-2.5 text-xs font-semibold text-ink">
                <MapPin className="size-4 shrink-0 text-brand" />
                <span className="truncate">
                  {store?.name ?? 'Supermercado'}:{' '}
                  <strong className="font-extrabold">{formatLocation(selectedLoc, selected.category)}</strong>
                </span>
              </div>

              {/* Información nutricional rápida */}
              {selected.nutrition_100g && (
                <div className="mt-3 grid grid-cols-4 gap-1.5 rounded-xl bg-panel/60 p-2 text-center text-[11px]">
                  <div>
                    <span className="block text-muted">Energía</span>
                    <strong className="font-extrabold text-ink">{formatNutrient('kcal', selected.nutrition_100g.kcal)}</strong>
                  </div>
                  <div>
                    <span className="block text-muted">Proteína</span>
                    <strong className="font-extrabold text-ink">{formatNutrient('protein', selected.nutrition_100g.protein)}</strong>
                  </div>
                  <div>
                    <span className="block text-muted">Grasas</span>
                    <strong className="font-extrabold text-ink">{formatNutrient('fat', selected.nutrition_100g.fat)}</strong>
                  </div>
                  <div>
                    <span className="block text-muted">Hidratos</span>
                    <strong className="font-extrabold text-ink">{formatNutrient('carbs', selected.nutrition_100g.carbs)}</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Listado de recetas que usan este ingrediente */}
            {selectedRecipes.length > 0 ? (
              <>
                <h3 className="mb-2 px-1 text-sm font-extrabold text-muted">
                  {plural(visibleRecipes.length, 'Receta con este ingrediente', 'Recetas con este ingrediente')}
                </h3>
                {visibleRecipes.length > 0 ? (
                  <ul className="flex flex-col gap-2.5">
                    {visibleRecipes.map((i) => (
                      <RecipeRow
                        key={i.recipe.id}
                        info={i}
                        suitability={household.get(i.recipe.id)}
                        visibility={visibility.get(i.recipe.id)}
                        onOpen={() => ui.openRecipe(i.recipe.id)}
                      />
                    ))}
                  </ul>
                ) : (
                  <EmptyState icon={<ShieldCheck className="size-9" />} title="Ninguna receta para tu perfil">
                    Las recetas con este producto no encajan con tus alergias configuradas.
                  </EmptyState>
                )}
                {hiddenCount > 0 && (
                  <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-muted">
                    <ShieldCheck className="size-4" aria-hidden />
                    {plural(hiddenCount, 'receta oculta', 'recetas ocultas')} por tu perfil de alérgenos
                  </p>
                )}
              </>
            ) : (
              <div className="rounded-3xl border border-line bg-white p-5 text-center shadow-soft">
                <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
                  <ShoppingBasket className="size-6" />
                </div>
                <h3 className="font-extrabold text-ink">Producto disponible en tienda</h3>
                <p className="mt-1 text-xs font-medium text-muted">
                  Este artículo está disponible en tu Mercadona en el{' '}
                  <strong className="text-ink">{selectedLoc ? `Pasillo ${selectedLoc.aisle}` : 'lineal correspondiente'}</strong>.
                  Actualmente no está enlazado a recetas sugeridas en la app, ¡pero puedes encontrarlo directamente en la tienda!
                </p>
              </div>
            )}
          </>
        ) : q || selectedCategory !== 'Todos' ? (
          matches.length > 0 ? (
            <>
              <div className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-sm font-extrabold text-muted">
                  {selectedCategory !== 'Todos' ? `${selectedCategory} · ` : ''}
                  {plural(matches.length, 'producto', 'productos')}
                </h2>
                {selectedCategory !== 'Todos' && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('Todos')}
                    className="text-xs font-bold text-brand hover:underline"
                  >
                    Ver todos
                  </button>
                )}
              </div>
              <ul className="flex flex-col gap-2">
                {matches.map((p) => {
                  const loc = store?.locations[p.id]
                  return (
                    <ProductButton
                      key={p.id}
                      product={p}
                      count={usage.get(p.id)?.length ?? 0}
                      aisle={loc?.aisle}
                      onClick={() => setSelectedId(p.id)}
                    />
                  )
                })}
              </ul>
            </>
          ) : (
            <EmptyState icon={<PackageSearch className="size-9" />} title="Sin resultados">
              Ningún producto coincide con «{query.trim()}» {selectedCategory !== 'Todos' ? `en ${selectedCategory}` : ''}.
            </EmptyState>
          )
        ) : (
          <>
            {/* Populares en recetas */}
            {popular.length > 0 && (
              <div className="mb-5">
                <div className="mb-2 flex items-center gap-1.5 px-1">
                  <Flame className="size-4 text-accent" />
                  <h2 className="text-sm font-extrabold text-ink">Más usados en el recetario</h2>
                </div>
                <ul className="flex flex-col gap-2">
                  {popular.map((p) => {
                    const loc = store?.locations[p.id]
                    return (
                      <ProductButton
                        key={p.id}
                        product={p}
                        count={usage.get(p.id)?.length ?? 0}
                        aisle={loc?.aisle}
                        onClick={() => setSelectedId(p.id)}
                      />
                    )
                  })}
                </ul>
              </div>
            )}

            {/* Todo el catálogo disponible */}
            <div>
              <div className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-sm font-extrabold text-muted">
                  Todo el catálogo ({products.length} productos)
                </h2>
              </div>
              <ul className="flex flex-col gap-2">
                {products.map((p) => {
                  const loc = store?.locations[p.id]
                  return (
                    <ProductButton
                      key={p.id}
                      product={p}
                      count={usage.get(p.id)?.length ?? 0}
                      aisle={loc?.aisle}
                      onClick={() => setSelectedId(p.id)}
                    />
                  )
                })}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
