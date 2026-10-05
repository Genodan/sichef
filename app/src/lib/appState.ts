// Estado del usuario (perfil, likes, cesta, despensa): tipos, reducer puro y hook.
// El proveedor con persistencia en localStorage está en state.tsx.

import { createContext, useContext, type Dispatch } from 'react'
import type { AllergenCode, HouseholdMember } from '../types.ts'
import { ALLERGEN_CODES } from './compute.ts'

/** «Tú dices sí. SíChef hace el resto»: un «¡Sí!» guarda la receta en el Recetario. */
export const LIKE_ADDS_TO_BASKET = false

export function getHouseholdAllergies(members: readonly HouseholdMember[]): AllergenCode[] {
  const set = new Set<AllergenCode>()
  for (const m of members) {
    for (const a of m.allergies) set.add(a)
  }
  return ALLERGEN_CODES.filter((c) => set.has(c))
}

export const defaultMembers: HouseholdMember[] = [
  { id: 'yo', name: 'Yo', allergies: [] },
]

export interface Profile {
  /** Personas de la casa con sus alergias individuales. */
  members: HouseholdMember[]
  /** Alergias acumuladas de toda la casa (unión de todos los miembros). */
  allergies: AllergenCode[]
  /** Tratar «Puede contener» como alérgeno (activado por defecto). */
  excludeTraces: boolean
  /** null → la primera tienda de stores.json. */
  storeId: string | null
}

export type IngredientChoice = 'basket' | 'home'

export interface AppState {
  profile: Profile
  /** Recetas con «¡Sí!» (Recetario), en orden de decisión. */
  likes: string[]
  /** Recetas con «Paso». */
  passes: string[]
  /** Elección por ingrediente: clave `${recipeId}:${ingredientIndex}` -> 'basket' | 'home' */
  pantry: Record<string, IngredientChoice>
  basket: {
    /** IDs de recetas con al menos un ingrediente añadido a la cesta. */
    recipeIds: string[]
    /** product_id marcados en la lista de la compra. */
    checked: string[]
  }
}

export const initialState: AppState = {
  profile: {
    members: defaultMembers,
    allergies: [],
    excludeTraces: true,
    storeId: null,
  },
  likes: [],
  passes: [],
  pantry: {},
  basket: { recipeIds: [], checked: [] },
}

export type Action =
  | { type: 'addMember'; name: string; allergies?: AllergenCode[] }
  | { type: 'removeMember'; id: string }
  | { type: 'updateMemberName'; id: string; name: string }
  | { type: 'toggleMemberAllergy'; memberId: string; code: AllergenCode }
  | { type: 'setMemberAllergies'; memberId: string; allergies: AllergenCode[] }
  | { type: 'toggleAllergy'; code: AllergenCode }
  | { type: 'setExcludeTraces'; value: boolean }
  | { type: 'setStore'; storeId: string }
  | { type: 'like'; id: string }
  | { type: 'pass'; id: string }
  | { type: 'undoDecision'; id: string; wasInBasket: boolean }
  | { type: 'unlike'; id: string }
  | { type: 'clearPasses' }
  | { type: 'addToBasket'; id: string }
  | { type: 'removeFromBasket'; id: string }
  | { type: 'setIngredientStatus'; recipeId: string; ingredientIndex: number; status: 'basket' | 'home' | 'none' }
  | { type: 'setAllIngredientsStatus'; recipeId: string; totalIngredients: number; status: 'basket' | 'home' | 'none' }
  | { type: 'toggleChecked'; productId: string }
  | { type: 'clearChecked' }
  | { type: 'completeBasketPurchase'; specificKeys?: string[] }
  | { type: 'reset' }

const without = (list: string[], id: string) => list.filter((x) => x !== id)
const withItem = (list: string[], id: string) => (list.includes(id) ? list : [...list, id])

/** Comprueba si una receta tiene algún ingrediente marcado para la cesta. */
function recipeHasBasketItems(pantry: Record<string, IngredientChoice>, recipeId: string): boolean {
  const prefix = `${recipeId}:`
  for (const [k, v] of Object.entries(pantry)) {
    if (k.startsWith(prefix) && v === 'basket') return true
  }
  return false
}

export function getIngredientStatus(
  pantry: Record<string, IngredientChoice> | undefined,
  recipeId: string,
  index: number,
): 'basket' | 'home' | 'none' {
  return pantry?.[`${recipeId}:${index}`] ?? 'none'
}

export function getRecipeIngredientCounts(
  pantry: Record<string, IngredientChoice> | undefined,
  recipeId: string,
  totalIngredients: number,
): { basket: number; home: number; none: number } {
  let basket = 0
  let home = 0
  for (let i = 0; i < totalIngredients; i++) {
    const s = pantry?.[`${recipeId}:${i}`]
    if (s === 'basket') basket++
    else if (s === 'home') home++
  }
  return { basket, home, none: Math.max(0, totalIngredients - basket - home) }
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'addMember': {
      const trimmed = action.name.trim()
      if (!trimmed) return state
      const newMember: HouseholdMember = {
        id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: trimmed,
        allergies: action.allergies ? ALLERGEN_CODES.filter((c) => action.allergies?.includes(c)) : [],
      }
      const members = [...state.profile.members, newMember]
      return {
        ...state,
        profile: {
          ...state.profile,
          members,
          allergies: getHouseholdAllergies(members),
        },
      }
    }
    case 'removeMember': {
      let members = state.profile.members.filter((m) => m.id !== action.id)
      if (members.length === 0) {
        members = defaultMembers
      }
      return {
        ...state,
        profile: {
          ...state.profile,
          members,
          allergies: getHouseholdAllergies(members),
        },
      }
    }
    case 'updateMemberName': {
      const trimmed = action.name.trim()
      if (!trimmed) return state
      const members = state.profile.members.map((m) => (m.id === action.id ? { ...m, name: trimmed } : m))
      return {
        ...state,
        profile: {
          ...state.profile,
          members,
        },
      }
    }
    case 'toggleMemberAllergy': {
      const members = state.profile.members.map((m) => {
        if (m.id !== action.memberId) return m
        const has = m.allergies.includes(action.code)
        const allergies = has
          ? m.allergies.filter((c) => c !== action.code)
          : ALLERGEN_CODES.filter((c) => c === action.code || m.allergies.includes(c))
        return { ...m, allergies }
      })
      return {
        ...state,
        profile: {
          ...state.profile,
          members,
          allergies: getHouseholdAllergies(members),
        },
      }
    }
    case 'setMemberAllergies': {
      const members = state.profile.members.map((m) => {
        if (m.id !== action.memberId) return m
        return { ...m, allergies: ALLERGEN_CODES.filter((c) => action.allergies.includes(c)) }
      })
      return {
        ...state,
        profile: {
          ...state.profile,
          members,
          allergies: getHouseholdAllergies(members),
        },
      }
    }
    case 'toggleAllergy': {
      const firstId = state.profile.members[0]?.id ?? 'yo'
      const members =
        state.profile.members.length > 0
          ? state.profile.members.map((m, idx) => {
              if (idx !== 0) return m
              const has = m.allergies.includes(action.code)
              const allergies = has
                ? m.allergies.filter((c) => c !== action.code)
                : ALLERGEN_CODES.filter((c) => c === action.code || m.allergies.includes(c))
              return { ...m, allergies }
            })
          : [{ id: firstId, name: 'Yo', allergies: [action.code] }]
      return {
        ...state,
        profile: {
          ...state.profile,
          members,
          allergies: getHouseholdAllergies(members),
        },
      }
    }
    case 'setExcludeTraces':
      return { ...state, profile: { ...state.profile, excludeTraces: action.value } }
    case 'setStore':
      return { ...state, profile: { ...state.profile, storeId: action.storeId } }
    case 'like':
      return {
        ...state,
        likes: withItem(state.likes, action.id),
        passes: without(state.passes, action.id),
        basket: LIKE_ADDS_TO_BASKET
          ? { ...state.basket, recipeIds: withItem(state.basket.recipeIds, action.id) }
          : state.basket,
      }
    case 'pass':
      return { ...state, passes: withItem(state.passes, action.id), likes: without(state.likes, action.id) }
    case 'undoDecision':
      return {
        ...state,
        likes: without(state.likes, action.id),
        passes: without(state.passes, action.id),
        basket: action.wasInBasket
          ? state.basket
          : { ...state.basket, recipeIds: without(state.basket.recipeIds, action.id) },
      }
    case 'unlike': {
      const prefix = `${action.id}:`
      const newPantry = { ...state.pantry }
      for (const k of Object.keys(newPantry)) {
        if (k.startsWith(prefix)) delete newPantry[k]
      }
      return {
        ...state,
        likes: without(state.likes, action.id),
        pantry: newPantry,
        basket: { ...state.basket, recipeIds: without(state.basket.recipeIds, action.id) },
      }
    }
    case 'clearPasses':
      return { ...state, passes: [] }
    case 'addToBasket':
      return { ...state, basket: { ...state.basket, recipeIds: withItem(state.basket.recipeIds, action.id) } }
    case 'removeFromBasket': {
      const prefix = `${action.id}:`
      const newPantry = { ...state.pantry }
      for (const [k, v] of Object.entries(newPantry)) {
        if (k.startsWith(prefix) && v === 'basket') delete newPantry[k]
      }
      return {
        ...state,
        pantry: newPantry,
        basket: { ...state.basket, recipeIds: without(state.basket.recipeIds, action.id) },
      }
    }
    case 'setIngredientStatus': {
      const key = `${action.recipeId}:${action.ingredientIndex}`
      const newPantry = { ...state.pantry }
      if (action.status === 'none') {
        delete newPantry[key]
      } else {
        newPantry[key] = action.status
      }
      const hasBasket = recipeHasBasketItems(newPantry, action.recipeId)
      const newRecipeIds = hasBasket
        ? withItem(state.basket.recipeIds, action.recipeId)
        : without(state.basket.recipeIds, action.recipeId)
      return {
        ...state,
        pantry: newPantry,
        basket: { ...state.basket, recipeIds: newRecipeIds },
      }
    }
    case 'setAllIngredientsStatus': {
      const newPantry = { ...state.pantry }
      for (let i = 0; i < action.totalIngredients; i++) {
        const key = `${action.recipeId}:${i}`
        if (action.status === 'none') {
          delete newPantry[key]
        } else {
          newPantry[key] = action.status
        }
      }
      const hasBasket = recipeHasBasketItems(newPantry, action.recipeId)
      const newRecipeIds = hasBasket
        ? withItem(state.basket.recipeIds, action.recipeId)
        : without(state.basket.recipeIds, action.recipeId)
      return {
        ...state,
        pantry: newPantry,
        basket: { ...state.basket, recipeIds: newRecipeIds },
      }
    }
    case 'toggleChecked': {
      const { checked } = state.basket
      return {
        ...state,
        basket: {
          ...state.basket,
          checked: checked.includes(action.productId) ? without(checked, action.productId) : [...checked, action.productId],
        },
      }
    }
    case 'clearChecked':
      return { ...state, basket: { ...state.basket, checked: [] } }
    case 'completeBasketPurchase': {
      const newPantry = { ...state.pantry }
      const keysToUpdate = action.specificKeys ?? Object.keys(newPantry).filter((k) => newPantry[k] === 'basket')
      for (const k of keysToUpdate) {
        newPantry[k] = 'home'
      }
      const remainingRecipeIds = state.basket.recipeIds.filter((recipeId) =>
        recipeHasBasketItems(newPantry, recipeId),
      )
      return {
        ...state,
        pantry: newPantry,
        basket: {
          recipeIds: remainingRecipeIds,
          checked: remainingRecipeIds.length === 0 ? [] : state.basket.checked,
        },
      }
    }
    case 'reset':
      return initialState
  }
}

// --- Persistencia (validada: un localStorage viejo o manipulado no rompe la app) ---

export const STORAGE_KEY = 'sichef:estado:v1'

const strings = (x: unknown): string[] =>
  Array.isArray(x) ? [...new Set(x.filter((v): v is string => typeof v === 'string'))] : []

const parsePantry = (raw: unknown): Record<string, IngredientChoice> => {
  if (typeof raw !== 'object' || raw === null) return {}
  const res: Record<string, IngredientChoice> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (typeof k === 'string' && (v === 'basket' || v === 'home')) {
      res[k] = v
    }
  }
  return res
}

export function sanitizeState(raw: unknown): AppState {
  if (typeof raw !== 'object' || raw === null) return initialState
  const r = raw as Record<string, unknown>
  const p = (typeof r.profile === 'object' && r.profile !== null ? r.profile : {}) as Record<string, unknown>
  const b = (typeof r.basket === 'object' && r.basket !== null ? r.basket : {}) as Record<string, unknown>
  
  let members: HouseholdMember[] = []
  if (Array.isArray(p.members) && p.members.length > 0) {
    members = p.members
      .filter((m): m is Record<string, unknown> => typeof m === 'object' && m !== null)
      .map((m, idx) => ({
        id: typeof m.id === 'string' && m.id ? m.id : `m-${idx + 1}`,
        name: typeof m.name === 'string' && m.name.trim() ? m.name.trim() : `Persona ${idx + 1}`,
        allergies: ALLERGEN_CODES.filter((c) => strings(m.allergies).includes(c)),
      }))
  }

  // Migración de perfil antiguo (solo allergies) o si members quedó vacío
  if (members.length === 0) {
    const legacyAllergies = ALLERGEN_CODES.filter((c) => strings(p.allergies).includes(c))
    members = [{ id: 'yo', name: 'Yo', allergies: legacyAllergies }]
  }

  const pantry = parsePantry(r.pantry)
  const rawRecipeIds = strings(b.recipeIds)
  const pantryRecipeIds = Object.entries(pantry)
    .filter(([, v]) => v === 'basket')
    .map(([k]) => k.split(':')[0])
  const recipeIds = [...new Set([...rawRecipeIds, ...pantryRecipeIds])]

  return {
    profile: {
      members,
      allergies: getHouseholdAllergies(members),
      excludeTraces: typeof p.excludeTraces === 'boolean' ? p.excludeTraces : true,
      storeId: typeof p.storeId === 'string' ? p.storeId : null,
    },
    likes: strings(r.likes),
    passes: strings(r.passes),
    pantry,
    basket: { recipeIds, checked: strings(b.checked) },
  }
}

export function loadState(): AppState {
  try {
    const text = localStorage.getItem(STORAGE_KEY)
    return text ? sanitizeState(JSON.parse(text)) : initialState
  } catch {
    return initialState
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Navegación privada o almacenamiento bloqueado: la demo sigue funcionando en memoria.
  }
}

// --- Contexto ---

export interface AppStateApi {
  state: AppState
  dispatch: Dispatch<Action>
}

export const AppStateContext = createContext<AppStateApi | null>(null)

export function useAppState(): AppStateApi {
  const ctx = useContext(AppStateContext)
  if (!ctx) throw new Error('useAppState() fuera de <AppStateProvider>')
  return ctx
}
