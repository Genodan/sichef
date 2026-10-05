// Datos derivados que dependen del catálogo + el estado del usuario.

import { useMemo } from 'react'
import type { AllergenCode, Store } from '../types.ts'
import {
  recipeHouseholdSuitability,
  recipeVisibility,
  type HouseholdSuitability,
  type RecipeInfo,
  type Visibility,
} from './compute.ts'
import { useAppState } from './appState.ts'
import { useCatalog } from './data.ts'

/** Tienda elegida en el perfil (o la primera de stores.json). */
export function useCurrentStore(): Store | null {
  const { stores } = useCatalog()
  const { storeId } = useAppState().state.profile
  return stores.find((s) => s.id === storeId) ?? stores[0] ?? null
}

/** Visibilidad de cada receta con el perfil actual (filtro duro de alérgenos de toda la casa). */
export function useVisibility(): ReadonlyMap<string, Visibility> {
  const { info } = useCatalog()
  const { allergies, excludeTraces } = useAppState().state.profile
  return useMemo(() => {
    const out = new Map<string, Visibility>()
    for (const [id, i] of info) out.set(id, recipeVisibility(i.allergens, { allergies, excludeTraces }))
    return out
  }, [info, allergies, excludeTraces])
}

/** Idoneidad de cada receta por miembro de la casa («Quién puede comer y quién no»). */
export function useHouseholdSuitability(): ReadonlyMap<string, HouseholdSuitability> {
  const { info } = useCatalog()
  const { members, excludeTraces } = useAppState().state.profile
  return useMemo(() => {
    const out = new Map<string, HouseholdSuitability>()
    for (const [id, i] of info) {
      out.set(id, recipeHouseholdSuitability(i.allergens, members, excludeTraces))
    }
    return out
  }, [info, members, excludeTraces])
}

/** Idoneidad de una receta específica para los miembros de la casa. */
export function useRecipeHouseholdSuitability(recipeId: string | null): HouseholdSuitability | null {
  const { info } = useCatalog()
  const { members, excludeTraces } = useAppState().state.profile
  return useMemo(() => {
    if (!recipeId) return null
    const i = info.get(recipeId)
    if (!i) return null
    return recipeHouseholdSuitability(i.allergens, members, excludeTraces)
  }, [recipeId, info, members, excludeTraces])
}

/** Resumen de recetas ocultas: por alergia y por falta de datos. */
export function useHiddenSummary() {
  const { recipes, info } = useCatalog()
  const visibility = useVisibility()
  return useMemo(() => {
    const byAllergy: { info: RecipeInfo; visibility: Visibility }[] = []
    const byData: { info: RecipeInfo; visibility: Visibility }[] = []
    for (const r of recipes) {
      const v = visibility.get(r.id)
      const i = info.get(r.id)
      if (!v || !i || v.visible) continue
      ;(v.byAllergy ? byAllergy : byData).push({ info: i, visibility: v })
    }
    return { byAllergy, byData, total: byAllergy.length + byData.length }
  }, [recipes, info, visibility])
}

/** Nombre y emoji salen de allergens.json; si falta, se enseña el código tal cual. */
export function useAllergenLabel() {
  const { allergenByCode } = useCatalog()
  return (code: AllergenCode) => {
    const a = allergenByCode.get(code)
    return { emoji: a?.emoji ?? '⚠️', name: a?.name ?? code.replace(/_/g, ' ') }
  }
}
