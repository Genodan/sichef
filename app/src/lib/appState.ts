// Estado del usuario (perfil, likes, cesta): tipos, reducer puro y hook.
// El proveedor con persistencia en localStorage está en state.tsx.

import { createContext, useContext, type Dispatch } from 'react'
import type { AllergenCode } from '../types.ts'
import { ALLERGEN_CODES } from './compute.ts'

/** «Tú dices sí. SíChef hace el resto»: un «¡Sí!» guarda la receta y la mete en la cesta. */
export const LIKE_ADDS_TO_BASKET = true

export interface Profile {
  allergies: AllergenCode[]
  /** Tratar «Puede contener» como alérgeno (activado por defecto). */
  excludeTraces: boolean
  /** null → la primera tienda de stores.json. */
  storeId: string | null
}

export interface AppState {
  profile: Profile
  /** Recetas con «¡Sí!» (Recetario), en orden de decisión. */
  likes: string[]
  /** Recetas con «Paso». */
  passes: string[]
  basket: {
    recipeIds: string[]
    /** product_id marcados en la lista de la compra. */
    checked: string[]
  }
}

export const initialState: AppState = {
  profile: { allergies: [], excludeTraces: true, storeId: null },
  likes: [],
  passes: [],
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
  | { type: 'toggleChecked'; productId: string }
  | { type: 'clearChecked' }
  | { type: 'reset' }

const without = (list: string[], id: string) => list.filter((x) => x !== id)
const withItem = (list: string[], id: string) => (list.includes(id) ? list : [...list, id])

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
    case 'unlike':
      return { ...state, likes: without(state.likes, action.id) }
    case 'clearPasses':
      return { ...state, passes: [] }
    case 'addToBasket':
      return { ...state, basket: { ...state.basket, recipeIds: withItem(state.basket.recipeIds, action.id) } }
    case 'removeFromBasket':
      return { ...state, basket: { ...state.basket, recipeIds: without(state.basket.recipeIds, action.id) } }
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
    case 'reset':
      return initialState
  }
}

// --- Persistencia (validada: un localStorage viejo o manipulado no rompe la app) ---

export const STORAGE_KEY = 'sichef:estado:v1'

const strings = (x: unknown): string[] =>
  Array.isArray(x) ? [...new Set(x.filter((v): v is string => typeof v === 'string'))] : []

export function sanitizeState(raw: unknown): AppState {
  if (typeof raw !== 'object' || raw === null) return initialState
  const r = raw as Record<string, unknown>
  const p = (typeof r.profile === 'object' && r.profile !== null ? r.profile : {}) as Record<string, unknown>
  const b = (typeof r.basket === 'object' && r.basket !== null ? r.basket : {}) as Record<string, unknown>
  const allergies = strings(p.allergies)
  return {
    profile: {
      allergies: ALLERGEN_CODES.filter((c) => allergies.includes(c)),
      excludeTraces: typeof p.excludeTraces === 'boolean' ? p.excludeTraces : true,
      storeId: typeof p.storeId === 'string' ? p.storeId : null,
    },
    likes: strings(r.likes),
    passes: strings(r.passes),
    basket: { recipeIds: strings(b.recipeIds), checked: strings(b.checked) },
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
