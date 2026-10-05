import {
  CheckCircle2,
  Clock,
  Compass,
  Info,
  ListFilter,
  MapPin,
  PackageCheck,
  PackageX,
  RotateCcw,
  ShoppingBag,
  ShoppingBasket,
  Sparkles,
  Store as StoreIcon,
  Truck,
  X,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import type { Recipe } from '../types.ts'
import { SafeImage } from '../components/SafeImage.tsx'
import { EmptyState, PrimaryButton, ScreenHeader } from '../components/ui.tsx'
import { DigitalPriceTag } from '../components/DigitalPriceTag.tsx'
import { InteractiveStoreMap } from '../components/InteractiveStoreMap.tsx'
import { StoreSimulator } from '../components/StoreSimulator.tsx'
import { getIngredientStatus, useAppState } from '../lib/appState.ts'
import { buildShoppingList } from '../lib/compute.ts'
import { useCatalog } from '../lib/data.ts'
import { formatDate, formatEuro, NA, plural } from '../lib/format.ts'
import { useCurrentStore, useVisibility } from '../lib/hooks.ts'
import { useUi } from '../lib/ui.ts'

export function Basket() {
  const catalog = useCatalog()
  const { state, dispatch } = useAppState()
  const store = useCurrentStore()
  const visibility = useVisibility()
  const ui = useUi()

  // Modo de compra: 'tienda' (compra física asistida con etiquetas digitales) vs 'online' (pedido a domicilio)
  const [buyMode, setBuyMode] = useState<'tienda' | 'online'>('tienda')
  const [tiendaView, setTiendaView] = useState<'simulador' | 'etiquetas'>('simulador')

  // Modales
  const [showInStoreModal, setShowInStoreModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState<null | {
    kind: 'tienda' | 'online'
    count: number
  }>(null)

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

  // Recolectar claves de pantry de productos marcados
  const getCheckedPantryKeys = useCallback(() => {
    return list.items
      .filter((i) => checked.has(i.product.id))
      .flatMap((i) => i.uses.map((u) => `${u.recipeId}:${u.ingredientIndex}`))
  }, [list.items, checked])

  // Recolectar todas las claves de pantry de la cesta
  const getAllBasketPantryKeys = useCallback(() => {
    return list.items.flatMap((i) => i.uses.map((u) => `${u.recipeId}:${u.ingredientIndex}`))
  }, [list.items])

  // Finalizar compra en tienda
  const handleFinishInStoreClick = () => {
    if (doneCount === 0 || doneCount < list.items.length) {
      // Si no ha marcado todo, abrir modal para darle a elegir
      setShowInStoreModal(true)
    } else {
      // Ha marcado todo
      executeFinishInStore(true)
    }
  }

  const executeFinishInStore = (all: boolean) => {
    const keys = all ? undefined : getCheckedPantryKeys()
    const count = all ? list.items.length : doneCount
    dispatch({ type: 'completeBasketPurchase', specificKeys: keys })
    setShowInStoreModal(false)
    setShowSuccessModal({ kind: 'tienda', count })
  }

  // Finalizar pedido a domicilio online
  const handleConfirmOnlineOrder = () => {
    const allKeys = getAllBasketPantryKeys()
    dispatch({ type: 'completeBasketPurchase', specificKeys: allKeys.length > 0 ? allKeys : undefined })
    setShowSuccessModal({ kind: 'online', count: list.items.length })
  }

  return (
    <div className="flex h-full flex-col bg-canvas">
      <ScreenHeader title="Cesta" subtitle="Tus ingredientes listos para comprar online o en tienda.">
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

      <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-12 pt-4">
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
            {/* Recetas en la cesta */}
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
                    className="grid size-7 place-items-center rounded-full bg-panel text-muted hover:text-pass transition-colors"
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

            {/* Selector de Opción de Compra */}
            <section className="mb-4 rounded-3xl bg-white p-2 shadow-soft">
              <p className="mb-1.5 px-2 pt-1 text-[11px] font-black uppercase tracking-wider text-muted">
                Elige cómo comprar tus ingredientes:
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setBuyMode('tienda')}
                  className={`flex flex-col items-center justify-center gap-1 rounded-2xl p-2.5 text-center transition-all ${
                    buyMode === 'tienda'
                      ? 'bg-brand text-white shadow-soft ring-2 ring-brand/30'
                      : 'bg-panel text-muted hover:bg-cream hover:text-accent-dark'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-black">
                    <StoreIcon className="size-4" />
                    <span>Compra en tienda</span>
                  </div>
                  <span className={`text-[10px] font-semibold ${buyMode === 'tienda' ? 'text-white/85' : 'text-muted'}`}>
                    Mapa y etiquetas digitales
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setBuyMode('online')}
                  className={`flex flex-col items-center justify-center gap-1 rounded-2xl p-2.5 text-center transition-all ${
                    buyMode === 'online'
                      ? 'bg-accent text-white shadow-soft ring-2 ring-accent/30'
                      : 'bg-panel text-muted hover:bg-cream hover:text-accent-dark'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-black">
                    <Truck className="size-4" />
                    <span>Pedido online</span>
                  </div>
                  <span className={`text-[10px] font-semibold ${buyMode === 'online' ? 'text-white/85' : 'text-muted'}`}>
                    A domicilio desde Colmena
                  </span>
                </button>
              </div>
            </section>

            {/* CONTENIDO SEGÚN MODO DE COMPRA */}
            {buyMode === 'tienda' ? (
              /* =================== OPCIÓN 2: COMPRA EN TIENDA =================== */
              <>
                {/* Resumen de compra en tienda */}
                <section className="mb-3 rounded-3xl bg-white p-4 shadow-soft" aria-label="Resumen de compra en tienda">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs font-extrabold uppercase tracking-wide text-muted">Total en caja</p>
                      <p className="text-[32px] font-black leading-none tabular-nums text-brand-dark">
                        {formatEuro(list.total)}
                        {list.partial && list.total !== null && <span className="text-lg text-accent-dark">*</span>}
                      </p>
                    </div>
                    <div className="pb-1 text-right text-xs font-bold text-muted">
                      <p>{plural(list.items.length, 'producto', 'productos')}</p>
                      <p className="font-black text-brand-dark">
                        {doneCount}/{list.items.length} en el carro
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-brand transition-all duration-300"
                      style={{ width: `${list.items.length ? (doneCount / list.items.length) * 100 : 0}%` }}
                    />
                  </div>

                  <p className="mt-2 text-[11px] font-semibold text-muted">
                    Calculado: envases completos × precio de tienda.mercadona.es ({formatDate(catalog.dataDate)}).
                    {list.partial && ' * Parcial: falta el precio o el producto de algún ingrediente.'}
                  </p>

                  <div className="mt-3.5 pt-3 border-t border-line">
                    <PrimaryButton
                      variant="brand"
                      onClick={handleFinishInStoreClick}
                      className="w-full flex items-center justify-center gap-2 py-3 text-sm font-black shadow-button"
                    >
                      <CheckCircle2 className="size-5" />
                      <span>He terminado la compra</span>
                    </PrimaryButton>
                  </div>
                </section>

                {/* Selector de vista dentro de Compra en tienda: Demo Simulador vs Lista */}
                <div className="mb-3.5 flex rounded-2xl bg-panel p-1">
                  <button
                    type="button"
                    onClick={() => setTiendaView('simulador')}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black transition-all ${
                      tiendaView === 'simulador' ? 'bg-brand text-white shadow-soft' : 'text-muted hover:text-ink'
                    }`}
                  >
                    <Compass className="size-4" />
                    <span>Demo Simulador (Tu posición)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTiendaView('etiquetas')}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black transition-all ${
                      tiendaView === 'etiquetas' ? 'bg-brand text-white shadow-soft' : 'text-muted hover:text-ink'
                    }`}
                  >
                    <ListFilter className="size-4" />
                    <span>Lista y mapa ESL</span>
                  </button>
                </div>

                {tiendaView === 'simulador' && store ? (
                  <StoreSimulator
                    store={store}
                    items={list.items}
                    checkedProductIds={checked}
                    onToggleProduct={(productId) => dispatch({ type: 'toggleChecked', productId })}
                    onFinishPurchase={handleFinishInStoreClick}
                  />
                ) : (
                  <>
                    {/* Banner de tecnología ESL y tienda simulada */}
                    <p className="mb-3 flex gap-2 rounded-2xl bg-cream px-3.5 py-2.5 text-xs font-semibold text-accent-dark">
                      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                      <span>
                        <strong className="font-extrabold">Tarjetas de precio digitales (ESL):</strong> Ubicación exacta en lineal
                        y balda sincronizada con la tienda. Pulsa «Localizar» para hacer parpadear su luz LED.
                      </span>
                    </p>

                    {/* Mapa interactivo de la tienda con lugares de cada producto */}
                    {store && (
                      <section className="mb-4 rounded-3xl bg-white p-4 shadow-soft" aria-labelledby="mapa-titulo">
                        <h2 id="mapa-titulo" className="mb-3 flex items-center gap-1.5 text-base font-extrabold text-ink">
                          <MapPin className="size-4 text-brand" aria-hidden /> Mapa de la tienda y productos
                        </h2>
                        <InteractiveStoreMap
                          store={store}
                          items={list.items}
                          checkedProductIds={checked}
                          route={list.aislesToVisit}
                          doneAisles={doneAisles}
                          onToggleProduct={(productId) => dispatch({ type: 'toggleChecked', productId })}
                        />
                      </section>
                    )}

                    {/* Listado de pasillos con Tarjetas de Precio Digitales */}
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between px-1">
                        <h2 className="text-sm font-black uppercase tracking-wide text-muted">
                          Ruta guiada por pasillos ({list.groups.length})
                        </h2>
                        {doneCount > 0 && (
                          <button
                            type="button"
                            onClick={() => dispatch({ type: 'clearChecked' })}
                            className="inline-flex items-center gap-1 text-xs font-extrabold text-muted hover:text-ink"
                          >
                            <RotateCcw className="size-3" /> Desmarcar todo
                          </button>
                        )}
                      </div>

                      {list.groups.map((g) => (
                        <section key={g.aisle ?? 'sin'} className="rounded-3xl bg-white p-4 shadow-soft">
                          <div className="mb-3 flex items-center gap-2">
                            <span
                              className={`grid size-7 place-items-center rounded-full text-sm font-black ${
                                g.aisle === null
                                  ? 'bg-panel text-muted'
                                  : doneAisles.has(g.aisle)
                                    ? 'bg-brand-soft text-brand'
                                    : 'bg-brand text-white'
                              }`}
                              aria-hidden
                            >
                              {g.aisle ?? '?'}
                            </span>
                            <div>
                              <h3 className="font-black text-ink text-sm">
                                {g.aisle === null ? `Ubicación: ${NA}` : `Pasillo ${g.aisle}${g.aisleName ? ` · ${g.aisleName}` : ''}`}
                              </h3>
                              <span className="text-[11px] font-semibold text-muted">
                                {plural(g.items.length, 'tarjeta digital', 'tarjetas digitales')}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col gap-3">
                            {g.items.map((item) => (
                              <DigitalPriceTag
                                key={item.product.id}
                                item={item}
                                checked={checked.has(item.product.id)}
                                onToggle={() => dispatch({ type: 'toggleChecked', productId: item.product.id })}
                                aisleName={g.aisleName}
                              />
                            ))}
                          </div>
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

                    {/* Botón flotante inferior de finalizar compra */}
                    <div className="mt-4 flex flex-col items-center gap-2">
                      <PrimaryButton
                        variant="brand"
                        onClick={handleFinishInStoreClick}
                        className="w-full flex items-center justify-center gap-2 py-3.5 text-base font-black shadow-button"
                      >
                        <CheckCircle2 className="size-5" />
                        <span>He terminado la compra</span>
                      </PrimaryButton>
                      <p className="text-center text-[11px] font-semibold text-muted">
                        Al terminar, los ingredientes recogidos se marcarán como «En casa» en tu Recetario.
                      </p>
                    </div>
                  </>
                )}
              </>
            ) : (
              /* =================== OPCIÓN 1: PEDIDO A DOMICILIO ONLINE =================== */
              <>
                <section className="mb-4 rounded-3xl bg-white p-4 shadow-soft">
                  <div className="flex items-center gap-2.5 text-brand-dark mb-3">
                    <span className="grid size-9 place-items-center rounded-2xl bg-brand-soft text-brand">
                      <Truck className="size-5" />
                    </span>
                    <div>
                      <h2 className="text-base font-black leading-tight">Mercadona Online a Domicilio</h2>
                      <p className="text-xs font-semibold text-muted">Preparado en Colmena y entregado en tu puerta</p>
                    </div>
                  </div>

                  {/* Datos de entrega simulados */}
                  <div className="flex flex-col gap-2 rounded-2xl bg-panel p-3 text-xs font-bold text-ink">
                    <div className="flex items-center gap-2">
                      <MapPin className="size-4 shrink-0 text-brand" />
                      <div>
                        <span className="text-muted block text-[10px] uppercase font-black">Dirección de entrega</span>
                        <span>C/ Colón, 14, 46004 Valencia (Simulada)</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 border-t border-line pt-2">
                      <Clock className="size-4 shrink-0 text-accent-dark" />
                      <div>
                        <span className="text-muted block text-[10px] uppercase font-black">Franja horaria</span>
                        <span>Hoy · 19:30 - 21:30 (Reparto en frío garantizado)</span>
                      </div>
                    </div>
                  </div>

                  {/* Resumen del importe */}
                  <div className="mt-4 flex flex-col gap-1.5 border-t border-line pt-3 text-xs font-bold">
                    <div className="flex justify-between text-muted">
                      <span>Subtotal productos ({list.items.length})</span>
                      <span className="tabular-nums font-black text-ink">{formatEuro(list.total)}</span>
                    </div>
                    <div className="flex justify-between text-muted">
                      <span>Tarifa de servicio a domicilio</span>
                      <span className="tabular-nums font-black text-ink">7,21 €</span>
                    </div>
                    <div className="flex items-end justify-between border-t border-line pt-2 text-sm">
                      <span className="font-black text-ink">Total del pedido</span>
                      <span className="text-2xl font-black tabular-nums text-brand-dark leading-none">
                        {list.total !== null ? formatEuro(list.total + 7.21) : NA}
                      </span>
                    </div>
                  </div>

                  {/* Botón para efectuar pedido online */}
                  <div className="mt-4 pt-1">
                    <PrimaryButton
                      variant="accent"
                      onClick={handleConfirmOnlineOrder}
                      className="w-full flex items-center justify-center gap-2 py-3.5 text-base font-black shadow-button"
                    >
                      <Truck className="size-5" />
                      <span>Confirmar pedido a domicilio</span>
                    </PrimaryButton>
                    <p className="mt-2 text-center text-[11px] font-semibold text-muted">
                      Al confirmar el pedido online, todos los ingredientes se marcarán automáticamente como «En casa» en tu
                      Recetario.
                    </p>
                  </div>
                </section>

                {/* Lista de productos para el pedido a domicilio */}
                <section className="rounded-3xl bg-white p-4 shadow-soft">
                  <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-muted">
                    Productos del pedido ({list.items.length})
                  </h3>
                  <ul className="divide-y divide-line">
                    {list.items.map((item) => (
                      <li key={item.product.id} className="flex items-center gap-3 py-3">
                        <SafeImage
                          src={item.product.thumbnail}
                          alt=""
                          kind="producto"
                          className="size-12 shrink-0 rounded-xl bg-white object-contain ring-1 ring-line"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-extrabold text-sm leading-tight text-ink">{item.product.name}</p>
                          <p className="text-xs font-semibold text-muted">
                            {item.packages !== null ? `${item.packages} envase${item.packages > 1 ? 's' : ''}` : `Envases: ${NA}`}
                            {' · '}
                            {item.uses.map((u) => u.recipeName).join(', ')}
                          </p>
                          <p className="text-[11px] font-extrabold text-brand-dark">Stock garantizado en Colmena</p>
                        </div>
                        <span className="text-sm font-black tabular-nums text-ink">
                          {item.cost !== null ? formatEuro(item.cost) : <span className="italic text-muted">{NA}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}
          </>
        )}
      </div>

      {/* DIÁLOGO: Confirmar compra parcial en tienda */}
      {showInStoreModal && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialogo-tienda-titulo"
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-phone animate-in fade-in zoom-in-95 duration-200">
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-cream text-accent-dark">
              <ShoppingBag className="size-6" />
            </div>
            <h3 id="dialogo-tienda-titulo" className="text-lg font-black text-ink">
              ¿Finalizar compra en tienda?
            </h3>
            <p className="mt-1 text-sm font-semibold text-muted">
              Has marcado <strong className="text-ink font-black">{doneCount}</strong> de{' '}
              <strong className="text-ink font-black">{list.items.length}</strong> productos en tu carro.
            </p>

            <div className="mt-4 flex flex-col gap-2">
              {doneCount > 0 && (
                <button
                  type="button"
                  onClick={() => executeFinishInStore(false)}
                  className="rounded-2xl bg-brand px-4 py-3 text-sm font-black text-white hover:bg-brand-dark transition-colors"
                >
                  Marcar los {doneCount} cogidos como «En casa»
                </button>
              )}
              <button
                type="button"
                onClick={() => executeFinishInStore(true)}
                className="rounded-2xl bg-brand-soft px-4 py-3 text-sm font-black text-brand-dark hover:bg-brand hover:text-white transition-colors"
              >
                Marcar TODOS ({list.items.length}) como «En casa»
              </button>
              <button
                type="button"
                onClick={() => setShowInStoreModal(false)}
                className="rounded-2xl bg-panel px-4 py-2.5 text-xs font-black text-muted hover:text-ink transition-colors"
              >
                Seguir en la tienda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ÉXITO: Compra completada (Tienda u Online) */}
      {showSuccessModal && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="exito-titulo"
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-phone text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="mx-auto mb-3.5 grid size-16 place-items-center rounded-3xl bg-brand-soft text-brand">
              {showSuccessModal.kind === 'tienda' ? (
                <PackageCheck className="size-9" />
              ) : (
                <Truck className="size-9" />
              )}
            </div>

            <div className="inline-flex items-center gap-1 rounded-full bg-cream px-3 py-1 text-xs font-black text-accent-dark mb-2">
              <Sparkles className="size-3.5" />
              <span>{showSuccessModal.kind === 'tienda' ? 'Compra en tienda completada' : 'Pedido online confirmado'}</span>
            </div>

            <h3 id="exito-titulo" className="text-xl font-black text-ink">
              {showSuccessModal.kind === 'tienda' ? '¡Todo en tu carro!' : '¡Pedido en camino!'}
            </h3>

            <p className="mt-2 text-sm font-semibold text-muted leading-relaxed">
              Tus ingredientes han sido marcados automáticamente como{' '}
              <strong className="text-brand-dark font-black">«En casa»</strong> en tu Recetario. Ya tienes todo lo
              necesario para cocinar tus platos favoritos.
            </p>

            <div className="mt-5 flex flex-col gap-2">
              <PrimaryButton
                variant="brand"
                onClick={() => {
                  setShowSuccessModal(null)
                  ui.goTo('recetario')
                }}
                className="w-full py-3 text-sm font-black"
              >
                Ir a mi Recetario
              </PrimaryButton>
              <button
                type="button"
                onClick={() => setShowSuccessModal(null)}
                className="rounded-2xl py-2 text-xs font-black text-muted hover:text-ink transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
