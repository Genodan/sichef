import { Check, Database, Pencil, Plus, RotateCcw, Store as StoreIcon, Trash2, Users } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { BottomSheet } from '../components/BottomSheet.tsx'
import { PrimaryButton, ScreenHeader } from '../components/ui.tsx'
import { useAppState } from '../lib/appState.ts'
import { ALLERGEN_CODES } from '../lib/compute.ts'
import { useCatalog } from '../lib/data.ts'
import { formatDate, NA, plural } from '../lib/format.ts'
import { useCurrentStore, useHiddenSummary } from '../lib/hooks.ts'
import { useUi } from '../lib/ui.ts'
import type { HouseholdMember } from '../types.ts'

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
  const [openAddModal, setOpenAddModal] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')
  const [memberToDelete, setMemberToDelete] = useState<HouseholdMember | null>(null)
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameEditInput, setNameEditInput] = useState('')

  const { members, excludeTraces } = state.profile
  const [activeMemberId, setActiveMemberId] = useState<string>(members[0]?.id ?? 'yo')

  // Miembro activo (asegurando que si se borra, no quede huérfano)
  const activeMember = members.find((m) => m.id === activeMemberId) ?? members[0] ?? {
    id: 'yo',
    name: 'Yo',
    allergies: [],
  }

  // Orden oficial del Reglamento; nombre y emoji de allergens.json.
  const allergens = ALLERGEN_CODES.map((c) => catalog.allergenByCode.get(c)).filter((a) => a !== undefined)
  const nutritionSources = useMemo(
    () => [...new Set(catalog.products.map((p) => p.nutrition_source).filter((s): s is string => !!s))],
    [catalog.products],
  )

  const handleAddMember = (e?: React.FormEvent) => {
    e?.preventDefault()
    const trimmed = newMemberName.trim()
    if (!trimmed) return
    const newId = `m-${Date.now()}`
    dispatch({ type: 'addMember', name: trimmed })
    setNewMemberName('')
    setOpenAddModal(false)
    setActiveMemberId(newId)
    ui.notify(`Persona «${trimmed}» añadida`)
  }

  const handleDeleteMember = () => {
    if (!memberToDelete) return
    const name = memberToDelete.name
    dispatch({ type: 'removeMember', id: memberToDelete.id })
    if (activeMemberId === memberToDelete.id) {
      const remaining = members.filter((m) => m.id !== memberToDelete.id)
      setActiveMemberId(remaining[0]?.id ?? 'yo')
    }
    setMemberToDelete(null)
    ui.notify(`Persona «${name}» eliminada`)
  }

  return (
    <div className="flex h-full flex-col bg-canvas">
      <ScreenHeader
        title="Perfil"
        subtitle="Alérgenos por persona: en cada plato sabrás quién puede comer y quién no."
      />
      <div className="no-scrollbar flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-8 pt-4">
        <Card
          title="Personas de la casa y alérgenos"
          icon={<Users className="size-5" />}
          description="Añade a cada persona y selecciona sus alergias de forma independiente."
        >
          {/* Selector de personas en la casa */}
          <div className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
            {members.map((m) => {
              const isActive = activeMember.id === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setActiveMemberId(m.id)
                    setIsEditingName(false)
                  }}
                  className={`flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2 text-sm font-black transition-all ${
                    isActive
                      ? 'bg-brand text-white shadow-soft ring-2 ring-brand'
                      : 'bg-panel text-ink hover:bg-line/60 ring-1 ring-line'
                  }`}
                >
                  <span
                    className={`grid size-6 place-items-center rounded-full text-xs font-black ${
                      isActive ? 'bg-white text-brand' : 'bg-line text-ink'
                    }`}
                  >
                    {m.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="truncate max-w-[110px]">{m.name}</span>
                  {m.allergies.length > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                        isActive ? 'bg-white/20 text-white' : 'bg-pass-soft text-pass'
                      }`}
                    >
                      {m.allergies.length}
                    </span>
                  )}
                </button>
              )
            })}

            <button
              type="button"
              onClick={() => setOpenAddModal(true)}
              className="flex shrink-0 items-center gap-1 rounded-2xl bg-panel px-3 py-2 text-sm font-extrabold text-brand hover:bg-brand-soft ring-1 ring-dashed ring-brand/50 transition-colors"
            >
              <Plus className="size-4" strokeWidth={3} />
              <span>Añadir persona</span>
            </button>
          </div>

          {/* Cabecera del miembro activo con opción de renombrar o borrar */}
          <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl bg-panel p-3">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-white text-sm font-black shadow-soft">
                {activeMember.name.charAt(0).toUpperCase()}
              </span>

              {isEditingName ? (
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <input
                    type="text"
                    value={nameEditInput}
                    onChange={(e) => setNameEditInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (nameEditInput.trim()) {
                          dispatch({ type: 'updateMemberName', id: activeMember.id, name: nameEditInput.trim() })
                        }
                        setIsEditingName(false)
                      } else if (e.key === 'Escape') {
                        setIsEditingName(false)
                      }
                    }}
                    className="h-8 w-full max-w-[140px] rounded-lg bg-white px-2.5 text-sm font-black text-ink outline-none ring-2 ring-brand"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (nameEditInput.trim()) {
                        dispatch({ type: 'updateMemberName', id: activeMember.id, name: nameEditInput.trim() })
                      }
                      setIsEditingName(false)
                    }}
                    className="rounded-lg bg-brand px-2.5 py-1 text-xs font-black text-white"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingName(false)}
                    className="rounded-lg bg-line px-2 py-1 text-xs font-bold text-muted hover:text-ink"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-base font-black text-ink">{activeMember.name}</p>
                    <button
                      type="button"
                      aria-label={`Editar nombre de ${activeMember.name}`}
                      onClick={() => {
                        setNameEditInput(activeMember.name)
                        setIsEditingName(true)
                      }}
                      className="text-muted hover:text-brand transition-colors"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  </div>
                  <p className="text-xs font-semibold text-muted">
                    {activeMember.allergies.length === 0
                      ? 'Sin alergias seleccionadas · Puede comer de todo'
                      : plural(activeMember.allergies.length, 'alérgeno seleccionado', 'alérgenos seleccionados')}
                  </p>
                </div>
              )}
            </div>

            {members.length > 1 && !isEditingName && (
              <button
                type="button"
                onClick={() => setMemberToDelete(activeMember)}
                aria-label={`Eliminar a ${activeMember.name}`}
                title="Eliminar persona"
                className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-pass-soft hover:text-pass transition-colors"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>

          {/* Cuadrícula de alérgenos para el miembro activo */}
          <div className="mt-3">
            <p className="mb-2 text-xs font-extrabold text-muted">
              Alérgenos que afectan a <span className="text-ink font-black">{activeMember.name}</span>:
            </p>
            {allergens.length === 0 ? (
              <p className="text-sm italic text-muted">Lista de alérgenos: {NA}</p>
            ) : (
              <ul className="grid grid-cols-2 gap-2">
                {allergens.map((a) => {
                  const on = activeMember.allergies.includes(a.code)
                  return (
                    <li key={a.code}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          dispatch({ type: 'toggleMemberAllergy', memberId: activeMember.id, code: a.code })
                        }
                        className={`flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm font-extrabold transition-colors ${
                          on
                            ? 'bg-pass-soft text-pass ring-2 ring-pass'
                            : 'bg-panel text-ink ring-1 ring-line hover:bg-line/60'
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
          </div>

          {/* Resumen del hogar */}
          {members.length > 1 && (
            <div className="mt-4 rounded-2xl bg-panel p-3.5">
              <h3 className="text-xs font-black uppercase tracking-wide text-muted">Resumen de la casa</h3>
              <ul className="mt-2 divide-y divide-line/60">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-2 text-xs font-bold">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-ink text-[11px] font-black shadow-soft">
                        {m.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="truncate font-extrabold text-ink">{m.name}</span>
                    </span>
                    <span className="text-muted ml-2 text-right truncate">
                      {m.allergies.length === 0 ? (
                        <span className="font-semibold text-brand-dark">Apto todo</span>
                      ) : (
                        <span className="font-extrabold text-pass">
                          {m.allergies
                            .map((c) => {
                              const item = catalog.allergenByCode.get(c)
                              return item ? `${item.emoji} ${item.name}` : c
                            })
                            .join(', ')}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <label className="relative mt-4 flex items-center gap-3 rounded-2xl bg-panel p-3">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold">Excluir también trazas</span>
              <span className="block text-xs font-semibold text-muted">
                «Puede contener» cuenta como alérgeno para toda la casa. Recomendado.
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

          {state.profile.allergies.length > 0 && (
            <p className="mt-3 text-xs font-bold text-muted">
              {hidden.total === 0
                ? 'Ninguna receta queda oculta con el perfil de la casa.'
                : `${plural(hidden.byAllergy.length, 'receta oculta', 'recetas ocultas')} para toda la casa · ${hidden.byData.length} por falta de datos.`}
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

      {/* Modal para añadir nueva persona a la casa */}
      <BottomSheet open={openAddModal} onClose={() => setOpenAddModal(false)} title="Añadir persona a la casa">
        <form onSubmit={handleAddMember} className="flex flex-col gap-4">
          <p className="text-sm font-semibold text-muted">
            Introduce el nombre de la persona para configurarle sus propios alérgenos.
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-ink">Nombre de la persona</span>
            <input
              type="text"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              placeholder="Ej. Laura, Mamá, Hugo, Pablo…"
              className="h-12 rounded-2xl bg-panel px-3.5 font-bold text-ink outline-none ring-1 ring-line focus-visible:ring-2 focus-visible:ring-brand"
              autoFocus
            />
          </label>
          <div className="mt-2 flex gap-2">
            <PrimaryButton variant="white" className="flex-1 ring-1 ring-line" onClick={() => setOpenAddModal(false)}>
              Cancelar
            </PrimaryButton>
            <button
              type="submit"
              disabled={!newMemberName.trim()}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-brand font-extrabold text-white shadow-button disabled:opacity-40"
            >
              <Plus className="size-4" strokeWidth={3} /> Añadir a la casa
            </button>
          </div>
        </form>
      </BottomSheet>

      {/* Modal de confirmación para eliminar persona */}
      <BottomSheet open={memberToDelete !== null} onClose={() => setMemberToDelete(null)} title="¿Eliminar persona?">
        <p className="text-sm font-semibold text-muted">
          Se eliminará a <strong className="text-ink">{memberToDelete?.name}</strong> de la casa y sus alérgenos configurados.
        </p>
        <div className="mt-5 flex gap-2">
          <PrimaryButton variant="white" className="flex-1 ring-1 ring-line" onClick={() => setMemberToDelete(null)}>
            Cancelar
          </PrimaryButton>
          <button
            type="button"
            onClick={handleDeleteMember}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-pass font-extrabold text-white shadow-button"
          >
            <Trash2 className="size-4" /> Eliminar
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
