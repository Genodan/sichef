// Carga de los JSON estáticos de app/public/data/ (la app nunca llama a la API de Mercadona).

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { Allergen, AllergenCode, Product, Recipe, Store } from '../types.ts'
import { analyzeRecipe, type RecipeInfo } from './compute.ts'

export interface Catalog {
  allergens: Allergen[]
  allergenByCode: ReadonlyMap<AllergenCode, Allergen>
  products: Product[]
  productsById: ReadonlyMap<string, Product>
  recipes: Recipe[]
  info: ReadonlyMap<string, RecipeInfo>
  stores: Store[]
  /** Fecha de descarga más reciente de los productos (trazabilidad). */
  dataDate: string | null
}

export type CatalogState =
  | { status: 'loading' }
  | { status: 'error'; message: string; detail?: string }
  | { status: 'ready'; catalog: Catalog }

class DataError extends Error {}

const FILES = ['allergens', 'products', 'recipes', 'stores'] as const
type FileName = (typeof FILES)[number]

async function fetchList(name: FileName): Promise<unknown[]> {
  const url = `${import.meta.env.BASE_URL}data/${name}.json`
  let res: Response
  try {
    res = await fetch(url, { cache: 'no-cache' })
  } catch {
    throw new DataError(`No hay conexión para leer ${name}.json.`)
  }
  if (!res.ok) throw new DataError(`Falta el archivo ${name}.json (error ${res.status}).`)
  const text = await res.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    // En desarrollo, Vite devuelve index.html cuando el archivo aún no existe.
    throw new DataError(`El archivo ${name}.json todavía no existe o no es un JSON válido.`)
  }
  if (!Array.isArray(parsed)) throw new DataError(`El archivo ${name}.json debería contener una lista.`)
  return parsed
}

// Comprobaciones mínimas de forma: evitan que un registro roto tumbe la app.
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null
const isAllergen = (x: unknown): x is Allergen => isObj(x) && typeof x.code === 'string' && typeof x.name === 'string'
const isProduct = (x: unknown): x is Product => isObj(x) && typeof x.id === 'string' && typeof x.name === 'string'
const isRecipe = (x: unknown): x is Recipe =>
  isObj(x) && typeof x.id === 'string' && typeof x.name === 'string' && Array.isArray(x.ingredients) && Array.isArray(x.steps)
const isStore = (x: unknown): x is Store => isObj(x) && typeof x.id === 'string' && Array.isArray(x.aisles) && isObj(x.locations)

function keep<T>(list: unknown[], guard: (x: unknown) => x is T, name: FileName): T[] {
  const ok = list.filter(guard)
  if (ok.length !== list.length) {
    console.warn(`[SíChef] ${name}.json: ${list.length - ok.length} registro(s) ignorado(s) por no cumplir el contrato.`)
  }
  return ok
}

export async function loadCatalog(): Promise<Catalog> {
  const [a, p, r, s] = await Promise.all(FILES.map(fetchList))
  const allergens = keep(a, isAllergen, 'allergens')
  const products = keep(p, isProduct, 'products')
  const recipes = keep(r, isRecipe, 'recipes')
  const stores = keep(s, isStore, 'stores')

  const productsById = new Map(products.map((x) => [x.id, x]))
  const info = new Map(recipes.map((x) => [x.id, analyzeRecipe(x, productsById)]))
  const dates = products.map((x) => x.fetched_at).filter((d) => typeof d === 'string' && d).sort()

  return {
    allergens,
    allergenByCode: new Map(allergens.map((x) => [x.code, x])),
    products,
    productsById,
    recipes,
    info,
    stores,
    dataDate: dates.length ? dates[dates.length - 1] : null,
  }
}

/** Carga el catálogo una vez; `retry` vuelve a intentarlo. */
export function useCatalogLoader(): { state: CatalogState; retry: () => void } {
  const [state, setState] = useState<CatalogState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    loadCatalog()
      .then((catalog) => alive && setState({ status: 'ready', catalog }))
      .catch((err: unknown) => {
        if (!alive) return
        const detail = err instanceof Error ? err.message : String(err)
        setState({
          status: 'error',
          message: err instanceof DataError ? detail : 'No se han podido cargar los datos de SíChef.',
          detail: err instanceof DataError ? undefined : detail,
        })
      })
    return () => {
      alive = false
    }
  }, [attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  return { state, retry }
}

export const CatalogContext = createContext<Catalog | null>(null)

export function useCatalog(): Catalog {
  const c = useContext(CatalogContext)
  if (!c) throw new Error('useCatalog() fuera de <CatalogContext>')
  return c
}
