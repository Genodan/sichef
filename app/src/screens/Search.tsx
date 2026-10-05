import { ChevronRight, PackageSearch, Search as SearchIcon, ShieldCheck, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Product } from '../types.ts'
import { RecipeRow } from '../components/RecipeRow.tsx'
import { SafeImage } from '../components/SafeImage.tsx'
import { EmptyState, ScreenHeader } from '../components/ui.tsx'
import { normalizeText, type RecipeInfo } from '../lib/compute.ts'
import { useCatalog } from '../lib/data.ts'
import { formatEuro, plural } from '../lib/format.ts'
import { useVisibility } from '../lib/hooks.ts'
import { useUi } from '../lib/ui.ts'

function ProductButton({ product, count, onClick }: { product: Product; count: number; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-2xl bg-white p-2.5 text-left shadow-soft"
      >
        <SafeImage
          src={product.thumbnail}
          alt=""
          kind="producto"
          className="size-12 shrink-0 rounded-xl bg-white object-contain ring-1 ring-line"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-extrabold leading-tight">{product.name}</span>
          <span className="block truncate text-xs font-semibold text-muted">
            {product.category} · {formatEuro(product.unit_price)}
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-extrabold text-brand-dark">
          {plural(count, 'receta', 'recetas')}
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
      </button>
    </li>
  )
}

export function Search() {
  const { products, productsById, recipes, info } = useCatalog()
  const visibility = useVisibility()
  const ui = useUi()
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // producto → recetas que lo usan (consulta a los datos, sin IA)
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

  const used = useMemo(() => products.filter((p) => usage.has(p.id)), [products, usage])
  const popular = useMemo(
    () => [...used].sort((a, b) => (usage.get(b.id)?.length ?? 0) - (usage.get(a.id)?.length ?? 0)).slice(0, 8),
    [used, usage],
  )

  const q = normalizeText(query)
  const matches = useMemo(() => {
    if (!q) return []
    // También por el nombre del ingrediente en la receta («muslos de pollo» → su producto).
    const byIngredient = new Set<string>()
    for (const r of recipes)
      for (const ing of r.ingredients) if (ing.product_id && normalizeText(ing.name).includes(q)) byIngredient.add(ing.product_id)
    return used.filter(
      (p) => normalizeText(p.name).includes(q) || normalizeText(p.category ?? '').includes(q) || byIngredient.has(p.id),
    )
  }, [q, used, recipes])

  const selected = selectedId ? productsById.get(selectedId) : undefined
  const selectedRecipes = (selected ? (usage.get(selected.id) ?? []) : [])
    .map((id) => info.get(id))
    .filter((x): x is RecipeInfo => x !== undefined)
  const visibleRecipes = selectedRecipes.filter((i) => visibility.get(i.recipe.id)?.visible)
  const hiddenCount = selectedRecipes.length - visibleRecipes.length

  return (
    <div className="flex h-full flex-col bg-canvas">
      <ScreenHeader title="¿Qué cocino con esto?" subtitle="Elige un producto y te enseñamos recetas reales que lo usan.">
        <div className="relative mt-4">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedId(null)
            }}
            placeholder="Pollo, garbanzos, pimiento…"
            aria-label="Buscar producto por nombre"
            className="h-12 w-full rounded-full bg-white pl-12 pr-4 font-semibold text-ink shadow-soft outline-none placeholder:text-muted/70 focus-visible:ring-4 focus-visible:ring-sun"
          />
        </div>
      </ScreenHeader>

      <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-6 pt-4">
        {selected ? (
          <>
            <div className="mb-4 flex items-center gap-3 rounded-3xl bg-white p-3 shadow-soft">
              <SafeImage
                src={selected.thumbnail}
                alt=""
                kind="producto"
                className="size-16 shrink-0 rounded-2xl bg-white object-contain ring-1 ring-line"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Recetas con</p>
                <p className="truncate text-lg font-extrabold leading-tight">{selected.name}</p>
                <p className="text-xs font-semibold text-muted">
                  {formatEuro(selected.unit_price)} · {formatEuro(selected.bulk_price)}/{selected.reference_format}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Quitar producto seleccionado"
                className="grid size-9 shrink-0 place-items-center rounded-full bg-panel text-muted"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            {visibleRecipes.length > 0 ? (
              <ul className="flex flex-col gap-2.5">
                {visibleRecipes.map((i) => (
                  <RecipeRow key={i.recipe.id} info={i} onOpen={() => ui.openRecipe(i.recipe.id)} />
                ))}
              </ul>
            ) : (
              <EmptyState icon={<ShieldCheck className="size-9" />} title="Ninguna receta para tu perfil">
                Las recetas con este producto no encajan con tus alergias.
              </EmptyState>
            )}
            {hiddenCount > 0 && (
              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-muted">
                <ShieldCheck className="size-4" aria-hidden />
                {plural(hiddenCount, 'receta oculta', 'recetas ocultas')} por tu perfil
              </p>
            )}
          </>
        ) : q ? (
          matches.length > 0 ? (
            <>
              <h2 className="mb-2 px-1 text-sm font-extrabold text-muted">{plural(matches.length, 'producto', 'productos')}</h2>
              <ul className="flex flex-col gap-2">
                {matches.map((p) => (
                  <ProductButton key={p.id} product={p} count={usage.get(p.id)?.length ?? 0} onClick={() => setSelectedId(p.id)} />
                ))}
              </ul>
            </>
          ) : (
            <EmptyState icon={<PackageSearch className="size-9" />} title="Sin resultados">
              Ningún producto de las recetas coincide con «{query.trim()}».
            </EmptyState>
          )
        ) : popular.length > 0 ? (
          <>
            <h2 className="mb-2 px-1 text-sm font-extrabold text-muted">Los productos que más salen en las recetas</h2>
            <ul className="flex flex-col gap-2">
              {popular.map((p) => (
                <ProductButton key={p.id} product={p} count={usage.get(p.id)?.length ?? 0} onClick={() => setSelectedId(p.id)} />
              ))}
            </ul>
          </>
        ) : (
          <EmptyState icon={<PackageSearch className="size-9" />} title="Aún no hay productos">
            Cuando las recetas estén enlazadas a productos de Mercadona, podrás buscar aquí.
          </EmptyState>
        )}
      </div>
    </div>
  )
}
