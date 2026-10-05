import {
  Check,
  ChevronLeft,
  CircleDot,
  Clock,
  Euro,
  ExternalLink,
  House,
  MapPin,
  Share2,
  ShieldAlert,
  ShoppingBasket,
  Trash2,
  TrendingDown,
  Users,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Store } from '../types.ts'
import { getIngredientStatus, useAppState } from '../lib/appState.ts'
import type { IngredientLine, RecipeInfo } from '../lib/compute.ts'
import { useCatalog } from '../lib/data.ts'
import { formatDate, formatEuro, formatLocation, formatMinutes, NA, plural } from '../lib/format.ts'
import { useCurrentStore, useVisibility } from '../lib/hooks.ts'
import { useUi } from '../lib/ui.ts'
import { AllergenChips } from './AllergenChips.tsx'
import { HiddenReasons } from './HiddenReasons.tsx'
import { NutritionGrid } from './Nutrition.tsx'
import { SafeImage } from './SafeImage.tsx'

interface Props {
  recipeId: string | null
  onClose: () => void
}

/** Detalle de receta a pantalla completa (sube como una hoja). */
export function RecipeSheet({ recipeId, onClose }: Props) {
  const { info } = useCatalog()
  const item = recipeId ? info.get(recipeId) : undefined
  return (
    <AnimatePresence>{item && <SheetContent key={item.recipe.id} info={item} onClose={onClose} />}</AnimatePresence>
  )
}

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="mt-7">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-xl font-extrabold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl bg-panel px-3 py-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-brand" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
        <p className={value === NA ? 'text-xs font-semibold italic text-muted' : 'truncate text-sm font-extrabold tabular-nums'}>
          {value}
        </p>
      </div>
    </div>
  )
}

function IngredientRow({
  line,
  store,
  status,
  onToggleBasket,
  onToggleHome,
}: {
  line: IngredientLine
  store: Store | null
  status: 'basket' | 'home' | 'none'
  onToggleBasket: () => void
  onToggleHome: () => void
}) {
  const { ingredient, product } = line
  const location = product && store ? (store.locations?.[product.id] ?? null) : null
  const aisleName = location ? store?.aisles?.find((a) => a.number === location.aisle)?.name : null
  const stock = product && store ? store.stock?.[product.id] : undefined

  return (
    <li className="flex flex-col gap-2.5 py-3.5">
      <div className="flex gap-3">
        <SafeImage
          src={product?.thumbnail}
          alt={product?.name ?? ''}
          kind="producto"
          className="size-14 shrink-0 rounded-2xl bg-white object-contain ring-1 ring-line"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-extrabold leading-tight">
              {ingredient.name}
              {ingredient.optional && (
                <span className="ml-1.5 rounded-full bg-panel px-1.5 py-0.5 align-middle text-[10px] font-bold text-muted">
                  opcional
                </span>
              )}
            </p>
            <p className="shrink-0 text-right text-sm font-extrabold tabular-nums">
              {line.usedCost !== null ? formatEuro(line.usedCost) : <span className="text-xs font-semibold italic text-muted">{NA}</span>}
            </p>
          </div>
          <p className="text-sm font-semibold text-muted">
            {ingredient.label}
            {product ? (
              <>
                {' · '}
                <span className="text-ink/80">{product.name}</span>
                {product.packaging ? ` (${product.packaging.toLowerCase()})` : ''}
              </>
            ) : (
              <> · Producto: <span className="italic">{NA}</span></>
            )}
          </p>
          {product && (
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs font-semibold text-muted">
              <span>
                Envase {formatEuro(product.unit_price)}
                {line.packages !== null && line.packages > 1 ? ` × ${line.packages}` : ''}
              </span>
              {product.price_decreased && (
                <span className="inline-flex items-center gap-0.5 font-bold text-brand">
                  <TrendingDown className="size-3" aria-hidden /> Ha bajado de precio
                </span>
              )}
            </p>
          )}
          {product && (
            <p className="mt-1 flex items-center gap-1 text-xs font-bold text-brand-dark">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              {formatLocation(location, aisleName)}
              {stock === false && <span className="ml-1 font-extrabold text-pass">· Sin stock</span>}
            </p>
          )}
        </div>
      </div>

      {/* Selector de opciones: Añadir a la cesta / Tengo en casa */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-panel/75 p-2">
        <div className="text-xs font-extrabold">
          {status === 'basket' && (
            <span className="inline-flex items-center gap-1 text-accent-dark">
              <ShoppingBasket className="size-3.5 shrink-0" aria-hidden /> En tu cesta
            </span>
          )}
          {status === 'home' && (
            <span className="inline-flex items-center gap-1 text-brand-dark">
              <House className="size-3.5 shrink-0" aria-hidden /> En casa
            </span>
          )}
          {status === 'none' && (
            <span className="inline-flex items-center gap-1 text-muted">
              <CircleDot className="size-3.5 shrink-0" aria-hidden /> Sin seleccionar
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleBasket}
            aria-pressed={status === 'basket'}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-extrabold transition-all ${
              status === 'basket'
                ? 'bg-accent text-white shadow-soft'
                : 'bg-white text-ink hover:bg-cream hover:text-accent-dark'
            }`}
          >
            <ShoppingBasket className="size-3.5" strokeWidth={2.5} aria-hidden />
            {status === 'basket' ? 'En la cesta' : 'A la cesta'}
          </button>
          <button
            type="button"
            onClick={onToggleHome}
            aria-pressed={status === 'home'}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-extrabold transition-all ${
              status === 'home'
                ? 'bg-brand text-white shadow-soft'
                : 'bg-white text-ink hover:bg-brand-soft hover:text-brand-dark'
            }`}
          >
            <House className="size-3.5" strokeWidth={2.5} aria-hidden />
            {status === 'home' ? 'En casa' : 'Tengo en casa'}
          </button>
        </div>
      </div>
    </li>
  )
}

function SheetContent({ info, onClose }: { info: RecipeInfo; onClose: () => void }) {
  const { recipe, cost, nutrition, allergens, badges, priceDecreased } = info
  const { state, dispatch } = useAppState()
  const ui = useUi()
  const store = useCurrentStore()
  const visibility = useVisibility().get(recipe.id)
  const backRef = useRef<HTMLButtonElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const [filter, setFilter] = useState<'todos' | 'basket' | 'home' | 'none'>('todos')
  const isLiked = state.likes.includes(recipe.id)

  const ingredients = cost.lines
  const basketCount = ingredients.filter((_, i) => getIngredientStatus(state.pantry, recipe.id, i) === 'basket').length
  const homeCount = ingredients.filter((_, i) => getIngredientStatus(state.pantry, recipe.id, i) === 'home').length
  const noneCount = Math.max(0, ingredients.length - basketCount - homeCount)

  const displayedIngredients = ingredients
    .map((line, index) => ({
      line,
      index,
      status: getIngredientStatus(state.pantry, recipe.id, index),
    }))
    .filter((item) => filter === 'todos' || item.status === filter)

  useEffect(() => {
    backRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const share = async () => {
    const text = `${recipe.name} — receta de ${recipe.source?.name ?? 'su fuente original'}`
    const url = recipe.source?.url
    try {
      if (navigator.share) {
        await navigator.share({ title: recipe.name, text, url })
        return
      }
      await navigator.clipboard.writeText(url ? `${text}: ${url}` : text)
      ui.notify('Enlace de la receta copiado')
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      ui.notify('No se ha podido compartir')
    }
  }

  const toggleBasket = (index: number) => {
    if (!isLiked) dispatch({ type: 'like', id: recipe.id })
    const current = getIngredientStatus(state.pantry, recipe.id, index)
    const next = current === 'basket' ? 'none' : 'basket'
    dispatch({ type: 'setIngredientStatus', recipeId: recipe.id, ingredientIndex: index, status: next })
  }

  const toggleHome = (index: number) => {
    if (!isLiked) dispatch({ type: 'like', id: recipe.id })
    const current = getIngredientStatus(state.pantry, recipe.id, index)
    const next = current === 'home' ? 'none' : 'home'
    dispatch({ type: 'setIngredientStatus', recipeId: recipe.id, ingredientIndex: index, status: next })
  }

  const addAllPendingToBasket = () => {
    if (!isLiked) dispatch({ type: 'like', id: recipe.id })
    for (let i = 0; i < ingredients.length; i++) {
      if (getIngredientStatus(state.pantry, recipe.id, i) === 'none') {
        dispatch({ type: 'setIngredientStatus', recipeId: recipe.id, ingredientIndex: i, status: 'basket' })
      }
    }
    ui.notify('Ingredientes pendientes añadidos a la cesta')
  }

  const markAllPendingAsHome = () => {
    if (!isLiked) dispatch({ type: 'like', id: recipe.id })
    for (let i = 0; i < ingredients.length; i++) {
      if (getIngredientStatus(state.pantry, recipe.id, i) === 'none') {
        dispatch({ type: 'setIngredientStatus', recipeId: recipe.id, ingredientIndex: i, status: 'home' })
      }
    }
    ui.notify('Ingredientes marcados como que los tienes en casa')
  }

  const nutritionSources = nutrition.sources.length ? nutrition.sources.join(', ') : NA

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="receta-titulo"
      className="absolute inset-0 z-40 flex flex-col bg-white"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 34, stiffness: 320 }}
    >
      {/* Cabecera compacta al hacer scroll (mantiene legibles los botones y la barra de estado) */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-[5] flex items-end justify-center bg-brand px-16 pb-3 pt-[calc(var(--top-inset)+8px)] shadow-soft"
        initial={false}
        animate={{ opacity: scrolled ? 1 : 0, y: scrolled ? 0 : -12 }}
        transition={{ duration: 0.18 }}
      >
        <p className="h-11 truncate text-lg font-extrabold leading-[44px] text-white">{recipe.name}</p>
      </motion.div>

      {/* Botones fijos sobre la foto */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-between px-4 pt-[calc(var(--top-inset)+8px)]">
        <button
          ref={backRef}
          type="button"
          onClick={onClose}
          aria-label="Volver"
          className="pointer-events-auto grid size-11 place-items-center rounded-full bg-white/85 text-ink shadow-soft backdrop-blur"
        >
          <ChevronLeft className="size-6" strokeWidth={2.5} aria-hidden />
        </button>
        <button
          type="button"
          onClick={share}
          aria-label={`Compartir ${recipe.name}`}
          className="pointer-events-auto grid size-11 place-items-center rounded-full bg-white/85 text-ink shadow-soft backdrop-blur"
        >
          <Share2 className="size-5" strokeWidth={2.5} aria-hidden />
        </button>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto" onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 250)}>
        <div className="relative h-[330px] bg-brand-soft">
          <SafeImage src={recipe.image?.url} alt={recipe.name} className="h-full w-full object-cover" />
          <div className="absolute inset-x-0 top-0 h-28 bg-linear-to-b from-black/45 to-transparent" />
        </div>

        <div className="relative -mt-9 rounded-t-[32px] bg-white px-5 pb-32 pt-3">
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line" aria-hidden />
          <h1 id="receta-titulo" className="text-[28px] font-black leading-tight">
            {recipe.name}
          </h1>
          {recipe.subtitle && <p className="mt-1 font-semibold text-muted">{recipe.subtitle}</p>}

          {(badges.length > 0 || priceDecreased.length > 0) && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {priceDecreased.length > 0 && (
                <li className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-extrabold text-white">
                  <TrendingDown className="size-3.5" aria-hidden /> Ha bajado de precio
                </li>
              )}
              {badges.map((b) => (
                <li key={b.id} className="rounded-full bg-cream px-2.5 py-1 text-xs font-extrabold text-accent-dark">
                  {b.label}
                </li>
              ))}
            </ul>
          )}

          {visibility && !visibility.visible && (
            <div className="mt-4 flex gap-3 rounded-2xl bg-pass-soft p-3.5 text-pass" role="alert">
              <ShieldAlert className="size-5 shrink-0" aria-hidden />
              <div>
                <p className="font-extrabold">Ojo: no encaja con tu perfil</p>
                <div className="text-ink">
                  <HiddenReasons reasons={visibility.reasons} />
                </div>
              </div>
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2">
            <Stat icon={<Users className="size-4" />} label="Raciones" value={recipe.servings ? String(recipe.servings) : NA} />
            <Stat icon={<Clock className="size-4" />} label="Tiempo" value={formatMinutes(recipe.time_min)} />
            <Stat
              icon={<Euro className="size-4" />}
              label={cost.partial ? 'Por ración · parcial' : 'Por ración'}
              value={formatEuro(cost.perServing)}
            />
            <Stat
              icon={<ShoppingBasket className="size-4" />}
              label={cost.inBasketPartial ? 'En caja · parcial' : 'En caja'}
              value={formatEuro(cost.inBasket)}
            />
          </div>
          <p className="mt-2 text-xs font-semibold text-muted">
            Precios <strong>calculados</strong> sumando los productos: por ración = lo que usas; en caja = envases completos.
            {cost.partial && ` Sin precio: ${cost.missing.join(', ')}.`}
          </p>

          <Section title="Nutrición por ración" aside={<span className="text-xs font-bold text-muted">calculada</span>}>
            <NutritionGrid nutrition={nutrition} />
            <p className="mt-2 text-xs font-semibold text-muted">
              Suma de {plural(nutrition.counted, 'producto', 'productos')} ÷ {recipe.servings || '—'} raciones. IR = ingesta de
              referencia de un adulto (8400 kJ / 2000 kcal).
              {nutrition.partial &&
                ` * Parcial: ${nutrition.missing.length ? `sin datos de ${nutrition.missing.join(', ')}` : 'faltan algunos valores'}.`}
            </p>
          </Section>

          <Section title="Alérgenos">
            <AllergenChips allergens={allergens} mine={state.profile.allergies} />
            {allergens.unknown.length > 0 && (
              <p className="mt-2 text-xs font-semibold text-muted">
                {NA}:{' '}
                {allergens.unknown
                  .map((u) => (u.reason === 'sin_producto' ? `${u.ingredient} (sin producto)` : (u.product ?? u.ingredient)))
                  .join(', ')}
                .
              </p>
            )}
          </Section>

          <Section
            title="Ingredientes"
            aside={<span className="text-xs font-bold text-muted">{store ? store.name : `Tienda: ${NA}`}</span>}
          >
            {ingredients.length === 0 ? (
              <p className="text-sm italic text-muted">{NA}</p>
            ) : (
              <>
                {/* Pestañas para ver qué tienes en casa, en la cesta y sin acción */}
                <div className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1" role="tablist" aria-label="Filtro de ingredientes">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={filter === 'todos'}
                    onClick={() => setFilter('todos')}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-extrabold transition-colors ${
                      filter === 'todos' ? 'bg-ink text-white' : 'bg-panel text-muted hover:text-ink'
                    }`}
                  >
                    Todos ({ingredients.length})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={filter === 'basket'}
                    onClick={() => setFilter('basket')}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold transition-colors ${
                      filter === 'basket' ? 'bg-accent text-white' : 'bg-cream text-accent-dark hover:bg-accent/20'
                    }`}
                  >
                    <ShoppingBasket className="size-3.5" aria-hidden />
                    En la cesta ({basketCount})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={filter === 'home'}
                    onClick={() => setFilter('home')}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold transition-colors ${
                      filter === 'home' ? 'bg-brand text-white' : 'bg-brand-soft text-brand-dark hover:bg-brand/20'
                    }`}
                  >
                    <House className="size-3.5" aria-hidden />
                    En casa ({homeCount})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={filter === 'none'}
                    onClick={() => setFilter('none')}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold transition-colors ${
                      filter === 'none' ? 'bg-ink/75 text-white' : 'bg-panel text-muted hover:text-ink'
                    }`}
                  >
                    <CircleDot className="size-3.5" aria-hidden />
                    Sin acción ({noneCount})
                  </button>
                </div>

                {/* Acciones rápidas en bloque si hay ingredientes pendientes */}
                {noneCount > 0 && filter !== 'basket' && filter !== 'home' && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={addAllPendingToBasket}
                      className="inline-flex items-center gap-1 rounded-xl bg-cream px-3 py-1.5 text-xs font-extrabold text-accent-dark hover:bg-accent/20 transition-colors"
                    >
                      <ShoppingBasket className="size-3.5" aria-hidden />
                      Añadir pendientes a la cesta ({noneCount})
                    </button>
                    <button
                      type="button"
                      onClick={markAllPendingAsHome}
                      className="inline-flex items-center gap-1 rounded-xl bg-brand-soft px-3 py-1.5 text-xs font-extrabold text-brand-dark hover:bg-brand/20 transition-colors"
                    >
                      <House className="size-3.5" aria-hidden />
                      Tengo todo lo pendiente en casa
                    </button>
                  </div>
                )}

                {displayedIngredients.length === 0 ? (
                  <div className="rounded-2xl bg-panel p-4 text-center text-sm font-semibold text-muted">
                    {filter === 'basket' && 'No has añadido ningún ingrediente a la cesta.'}
                    {filter === 'home' && 'No has marcado ningún ingrediente como que lo tienes en casa.'}
                    {filter === 'none' && '¡Has decidido sobre todos los ingredientes de esta receta!'}
                  </div>
                ) : (
                  <ul className="divide-y divide-line">
                    {displayedIngredients.map(({ line, index, status }) => (
                      <IngredientRow
                        key={`${line.ingredient.name}-${index}`}
                        line={line}
                        store={store}
                        status={status}
                        onToggleBasket={() => toggleBasket(index)}
                        onToggleHome={() => toggleHome(index)}
                      />
                    ))}
                  </ul>
                )}
              </>
            )}
          </Section>

          <Section title="Preparación">
            {recipe.steps.length === 0 ? (
              <p className="text-sm italic text-muted">{NA}</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {recipe.steps.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand text-sm font-black text-white">
                      {i + 1}
                    </span>
                    <p className="pt-0.5 leading-relaxed">{step}</p>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          <section className="mt-8 rounded-3xl bg-brand-soft p-4 text-sm" aria-labelledby="fuentes-titulo">
            <h2 id="fuentes-titulo" className="mb-2 text-base font-extrabold text-brand-dark">
              De dónde salen los datos
            </h2>
            <ul className="flex flex-col gap-2 leading-snug">
              <li>
                <strong>Foto:</strong> {recipe.image?.author || NA} · {recipe.image?.license || NA}
                {recipe.image?.source_url && <SourceLink href={recipe.image.source_url} />}
              </li>
              <li>
                <strong>Receta y pasos:</strong> {recipe.source?.name || NA} · {recipe.source?.license || NA}
                {recipe.source?.url && <SourceLink href={recipe.source.url} />}
              </li>
              <li>
                <strong>Productos, precios y alérgenos:</strong> catálogo público de tienda.mercadona.es, copiado el{' '}
                {formatDate(info.fetchedAt)}.
              </li>
              <li>
                <strong>Nutrición de los productos:</strong> {nutritionSources}.
              </li>
              <li>
                <strong>Precio y nutrición de la receta:</strong> calculados por SíChef sumando los productos (nunca estimados).
              </li>
              <li>
                <strong>Pasillos y stock:</strong> tienda simulada para la demo.
              </li>
            </ul>
          </section>
        </div>
      </div>

      {/* CTA fija */}
      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-white via-white to-white/0 px-5 pb-[calc(var(--bottom-inset)+14px)] pt-6">
        {basketCount > 0 ? (
          <div className="flex gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                onClose()
                ui.goTo('cesta')
              }}
              className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-brand text-lg font-extrabold text-white shadow-button"
            >
              <ShoppingBasket className="size-5" strokeWidth={2.5} aria-hidden />
              Ver cesta ({basketCount} {plural(basketCount, 'producto', 'productos')})
            </motion.button>
            <button
              type="button"
              onClick={() => {
                dispatch({ type: 'removeFromBasket', id: recipe.id })
                ui.notify('Ingredientes quitados de la cesta')
              }}
              aria-label={`Quitar ingredientes de ${recipe.name} de la cesta`}
              title="Quitar de la cesta"
              className="grid size-14 place-items-center rounded-full bg-panel text-pass"
            >
              <Trash2 className="size-5" aria-hidden />
            </button>
          </div>
        ) : noneCount > 0 ? (
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={addAllPendingToBasket}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-accent text-lg font-extrabold text-white shadow-button"
          >
            <ShoppingBasket className="size-5" strokeWidth={2.5} aria-hidden />
            Añadir pendientes a la cesta ({noneCount})
          </motion.button>
        ) : (
          <div className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-brand-soft text-base font-extrabold text-brand-dark">
            <Check className="size-5" strokeWidth={3} aria-hidden />
            Todos los ingredientes los tienes en casa
          </div>
        )}
      </div>
    </motion.div>
  )
}

function SourceLink({ href }: { href: string }) {
  return (
    <>
      {' · '}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-0.5 font-bold text-brand-dark underline underline-offset-2"
      >
        fuente <ExternalLink className="size-3" aria-hidden />
      </a>
    </>
  )
}
