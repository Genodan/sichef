// Estado del usuario (perfil, likes, cesta, despensa): tipos, reducer puro y hook.
// El proveedor con persistencia en localStorage está en state.tsx.

import { createContext, useContext, type Dispatch } from 'react'
import type { AllergenCode } from '../types.ts'
import { ALLERGEN_CODES } from './compute.ts'

/** «Tú dices sí. SíChef hace el resto»: un «¡Sí!» guarda la receta en el Recetario. */
export const LIKE_ADDS_TO_BASKET = false

export interface Profile {
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
  profile: { allergies: [], excludeTraces: true, storeId: null },
  likes: [],
  passes: [],
  pantry: {},
  basket: { recipeIds: [], checked: [] },
}

export type Action =
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
    case 'toggleAllergy': {
      const has = state.profile.allergies.includes(action.code)
      const allergies = has
        ? state.profile.allergies.filter((c) => c !== action.code)
        : ALLERGEN_CODES.filter((c) => c === action.code || state.profile.allergies.includes(c))
      return { ...state, profile: { ...state.profile, allergies } }
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
  const allergies = strings(p.allergies)
  const pantry = parsePantry(r.pantry)
  const rawRecipeIds = strings(b.recipeIds)
  const pantryRecipeIds = Object.entries(pantry)
    .filter(([, v]) => v === 'basket')
    .map(([k]) => k.split(':')[0])
  const recipeIds = [...new Set([...rawRecipeIds, ...pantryRecipeIds])]

  return {
    profile: {
      allergies: ALLERGEN_CODES.filter((c) => allergies.includes(c)),
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
