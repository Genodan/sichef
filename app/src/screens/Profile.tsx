import { Check, Database, RotateCcw, ShieldCheck, Store as StoreIcon } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { BottomSheet } from '../components/BottomSheet.tsx'
import { PrimaryButton, ScreenHeader } from '../components/ui.tsx'
import { useAppState } from '../lib/appState.ts'
import { ALLERGEN_CODES } from '../lib/compute.ts'
import { useCatalog } from '../lib/data.ts'
import { formatDate, NA, plural } from '../lib/format.ts'
import { useCurrentStore, useHiddenSummary } from '../lib/hooks.ts'
import { useUi } from '../lib/ui.ts'

function Card({ title, icon, children, description }: { title: string; icon: ReactNode; children: ReactNode; description?: string }) {
  return (
    <section className="rounded-3xl bg-white p-4 shadow-soft">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <span className="text-brand" aria-hidden>
          {icon}
        </span>
        {title}
      </h2>
      {description && <p className="mt-1 text-sm font-semibold text-muted">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

export function Profile() {
  const catalog = useCatalog()
  const { state, dispatch } = useAppState()
  const store = useCurrentStore()
  const hidden = useHiddenSummary()
  const ui = useUi()
  const [confirmReset, setConfirmReset] = useState(false)
  const { allergies, excludeTraces } = state.profile

  // Orden oficial del Reglamento; nombre y emoji de allergens.json.
  const allergens = ALLERGEN_CODES.map((c) => catalog.allergenByCode.get(c)).filter((a) => a !== undefined)
  const nutritionSources = useMemo(
    () => [...new Set(catalog.products.map((p) => p.nutrition_source).filter((s): s is string => !!s))],
    [catalog.products],
  )

  return (
    <div className="flex h-full flex-col bg-canvas">
      <ScreenHeader title="Perfil" subtitle="Tus alergias mandan: lo que no puedes comer no aparece." />
      <div className="no-scrollbar flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-8 pt-4">
        <Card
          title="Mis alergias"
          icon={<ShieldCheck className="size-5" />}
          description="Filtro duro con reglas fijas: las recetas con estos alérgenos no te aparecerán."
        >
          {allergens.length === 0 ? (
            <p className="text-sm italic text-muted">Lista de alérgenos: {NA}</p>
          ) : (
            <ul className="grid grid-cols-2 gap-2">
              {allergens.map((a) => {
                const on = allergies.includes(a.code)
                return (
                  <li key={a.code}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => dispatch({ type: 'toggleAllergy', code: a.code })}
                      className={`flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm font-extrabold transition-colors ${
                        on ? 'bg-pass-soft text-pass ring-2 ring-pass' : 'bg-panel text-ink ring-1 ring-line hover:bg-line/60'
                      }`}
                    >
                      <span className="text-lg leading-none" aria-hidden>
                        {a.emoji}
                      </span>
                      <span className="min-w-0 flex-1 leading-tight">{a.name}</span>
                      {on && <Check className="size-4 shrink-0" strokeWidth={3.5} aria-hidden />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <label className="relative mt-4 flex items-center gap-3 rounded-2xl bg-panel p-3">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold">Excluir también trazas</span>
              <span className="block text-xs font-semibold text-muted">
                «Puede contener» cuenta como alérgeno. Recomendado.
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="peer sr-only"
              checked={excludeTraces}
              onChange={(e) => dispatch({ type: 'setExcludeTraces', value: e.target.checked })}
            />
            <span
              aria-hidden
              className="relative h-7 w-12 shrink-0 rounded-full bg-muted/40 transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-6 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-brand peer-checked:after:translate-x-5 peer-focus-visible:ring-4 peer-focus-visible:ring-sun"
            />
          </label>

          {allergies.length > 0 && (
            <p className="mt-3 text-xs font-bold text-muted">
              {hidden.total === 0
                ? 'Ninguna receta queda oculta con tu perfil.'
                : `${plural(hidden.byAllergy.length, 'receta oculta', 'recetas ocultas')} por tus alergias · ${hidden.byData.length} por falta de datos.`}
            </p>
          )}
        </Card>

        <Card
          title="Mi tienda"
          icon={<StoreIcon className="size-5" />}
          description="Para ordenar la cesta por pasillo. Las tiendas son simuladas."
        >
          {catalog.stores.length === 0 ? (
            <p className="text-sm italic text-muted">Tiendas: {NA}</p>
          ) : (
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">Tienda</legend>
              {catalog.stores.map((s) => {
                const on = store?.id === s.id
                return (
                  <label
                    key={s.id}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${on ? 'bg-brand-soft ring-2 ring-brand' : 'bg-panel ring-1 ring-line'}`}
                  >
                    <input
                      type="radio"
                      name="tienda"
                      value={s.id}
                      checked={on}
                      onChange={() => dispatch({ type: 'setStore', storeId: s.id })}
                      className="size-4 accent-brand"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-extrabold">{s.name}</span>
                      <span className="block text-xs font-semibold text-muted">
                        {plural(s.aisles?.length ?? 0, 'pasillo', 'pasillos')} · simulada
                      </span>
                    </span>
                  </label>
                )
              })}
            </fieldset>
          )}
        </Card>

        <Card title="De dónde salen los datos" icon={<Database className="size-5" />}>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm font-semibold leading-snug text-ink/85">
            <li>
              {plural(catalog.products.length, 'producto real', 'productos reales')} del catálogo público de
              tienda.mercadona.es (copiado el {formatDate(catalog.dataDate)}).
            </li>
            <li>Nutrición de los productos: {nutritionSources.length ? nutritionSources.join(', ') : NA}.</li>
            <li>
              {plural(catalog.recipes.length, 'receta real', 'recetas reales')} de fuentes con licencia; la foto, el autor y la
              licencia están en cada receta.
            </li>
            <li>Precio y nutrición de cada receta: calculados sumando los productos, nunca estimados.</li>
            <li>Si falta un dato, verás «{NA}».</li>
            <li>Tiendas, pasillos y stock: simulados para la demo.</li>
          </ul>
        </Card>

        <div className="mt-2 flex justify-center">
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="inline-flex h-12 items-center gap-2 rounded-full border-2 border-pass/40 px-5 font-extrabold text-pass hover:bg-pass-soft"
          >
            <RotateCcw className="size-4" aria-hidden /> Reiniciar demo
          </button>
        </div>
      </div>

      <BottomSheet open={confirmReset} onClose={() => setConfirmReset(false)} title="¿Reiniciar la demo?">
        <p className="text-sm font-semibold text-muted">
          Se borran de este navegador tus alergias, tus «¡Sí!», tus «Paso», la tienda elegida y la cesta.
        </p>
        <div className="mt-5 flex gap-2">
          <PrimaryButton variant="white" className="flex-1 ring-1 ring-line" onClick={() => setConfirmReset(false)}>
            Cancelar
          </PrimaryButton>
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'reset' })
              setConfirmReset(false)
              ui.goTo('descubre')
              ui.notify('Demo reiniciada')
            }}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-pass font-extrabold text-white shadow-button"
          >
            <RotateCcw className="size-4" aria-hidden /> Reiniciar
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
