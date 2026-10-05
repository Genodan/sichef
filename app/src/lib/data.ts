// Carga de los JSON estáticos de app/public/data/ (la app nunca llama a la API de Mercadona).

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { Allergen, AllergenCode, Product, Recipe, RecipeIngredient, Store } from '../types.ts'
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
const isStore = (x: unknown): x is Store => isObj(x) && typeof x.id === 'string' && Array.isArray(x.aisles) && isObj(x.locations)

function parseFormato(formato: unknown, unitPrice: number) {
  const f = typeof formato === 'string' ? formato.toLowerCase() : '1 kg'
  let packaging = 'Envase'
  if (f.includes('paquete')) packaging = 'Paquete'
  else if (f.includes('bote') || f.includes('tarro')) packaging = 'Bote'
  else if (f.includes('botella')) packaging = 'Botella'
  else if (f.includes('pack')) packaging = 'Pack'
  else if (f.includes('bolsa')) packaging = 'Bolsa'
  else if (f.includes('bandeja')) packaging = 'Bandeja'
  else if (f.includes('malla')) packaging = 'Malla'
  else if (f.includes('brik')) packaging = 'Brik'

  let unit_size = 1.0
  let ref_format = 'kg'
  let size_format = 'kg'

  const kgM = f.match(/(\d+(?:\.\d+)?)\s*kg/)
  const gM = f.match(/(\d+(?:\.\d+)?)\s*g/)
  const lM = f.match(/(\d+(?:\.\d+)?)\s*l/)
  const udM = f.match(/(\d+)\s*(?:latas|ud|uds)/)

  if (kgM) {
    unit_size = parseFloat(kgM[1])
    ref_format = 'kg'
    size_format = 'kg'
  } else if (gM) {
    unit_size = parseFloat(gM[1]) / 1000
    ref_format = 'kg'
    size_format = 'kg'
  } else if (lM) {
    unit_size = parseFloat(lM[1])
    ref_format = 'L'
    size_format = 'l'
  } else if (udM) {
    unit_size = parseFloat(udM[1])
    ref_format = 'ud'
    size_format = 'ud'
  }

  const bulk_price = unit_size > 0 ? Math.round((unitPrice / unit_size) * 100) / 100 : unitPrice
  return { packaging, unit_size, reference_format: ref_format, size_format, bulk_price }
}

function parseQuantity(qRaw: unknown): { quantity: number; unit: 'g' | 'ml' | 'ud'; label: string } {
  if (typeof qRaw === 'number') {
    return { quantity: qRaw, unit: 'ud', label: `${qRaw} ud` }
  }
  const s = String(qRaw ?? '1 ud').trim().toLowerCase()
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(g|kg|ml|l|ud|uds)?$/)
  if (!m) return { quantity: 1, unit: 'ud', label: s }
  const val = parseFloat(m[1])
  const u = m[2] || 'ud'
  if (u === 'kg') return { quantity: val * 1000, unit: 'g', label: `${val} kg` }
  if (u === 'l') return { quantity: val * 1000, unit: 'ml', label: `${val} L` }
  if (u === 'ud' || u === 'uds') return { quantity: val, unit: 'ud', label: `${val} ud` }
  return { quantity: val, unit: u as 'g' | 'ml', label: `${val} ${u}` }
}

const DEFAULT_RECIPE_STEPS: Record<string, string[]> = {
  'receta-garbanzos': [
    'Descongelar las espinacas en el microondas o cocerlas brevemente y escurrirlas bien.',
    'Picar los dientes de ajo en láminas finas y dorarlos en una sartén con aceite de oliva virgen extra.',
    'Añadir las espinacas bien escurridas a la sartén y rehogar durante 3 o 4 minutos.',
    'Enjuagar y escurrir los garbanzos cocidos de bote, e incorporarlos a la sartén.',
    'Saltear todo junto a fuego medio durante 5 minutos y servir caliente.',
  ],
  'receta-pollo': [
    'Cortar la pechuga de pollo en dados y picar finamente la cebolla.',
    'En una cazuela con aceite, dorar los trozos de pollo a fuego vivo y reservar.',
    'En el mismo recipiente, pochar la cebolla picada hasta que esté transparente.',
    'Añadir el arroz redondo y sofreírlo durante 2 minutos hasta nacararlo.',
    'Verter el caldo de pollo caliente, reincorporar el pollo y cocinar 18 minutos.',
    'Dejar reposar 3 minutos y servir.',
  ],
}

/** Normaliza un producto tolerando tanto el contrato types.ts como el formato del branch Datos. */
export function normalizeProduct(raw: unknown): Product | null {
  if (!isObj(raw)) return null
  const id = String(raw.id ?? '')
  if (!id) return null

  const name = String(raw.name ?? raw.nombre ?? `Producto ${id}`)
  const unit_price = Number(raw.unit_price ?? raw.precio ?? 0)
  const formato = parseFormato(raw.formato, unit_price)

  // Alérgenos: soporta tanto el contrato types.ts como el formato español del branch Datos
  let allergens: Product['allergens'] = {
    status: 'declarado',
    contains: [],
    traces: [],
  }
  if (raw.allergens && typeof raw.allergens === 'object') {
    allergens = raw.allergens as Product['allergens']
  } else if (raw.alergenos && typeof raw.alergenos === 'object') {
    const rawAl = raw.alergenos as Record<string, unknown>
    const contains: AllergenCode[] = []
    const traces: AllergenCode[] = []
    for (const [k, v] of Object.entries(rawAl)) {
      const code = k.toLowerCase().trim() as AllergenCode
      const valStr = String(v).toLowerCase()
      if (valStr.includes('contiene') && !valStr.includes('puede')) {
        contains.push(code)
      } else if (valStr.includes('puede') || valStr.includes('traza')) {
        traces.push(code)
      }
    }
    const isFresh = /cebolla|ajo|tomate|patata|pimiento|limon|zanahoria/i.test(name)
    allergens = {
      status: isFresh ? 'producto_fresco' : 'declarado',
      contains,
      traces,
    }
  }

  // Nutrición: soporta grasas, hidratos, proteinas o contract types.ts
  let nutrition_100g: Product['nutrition_100g'] = null
  if (raw.nutrition_100g !== undefined) {
    nutrition_100g = raw.nutrition_100g as Product['nutrition_100g']
  } else if (raw.nutricion_100g && typeof raw.nutricion_100g === 'object') {
    const n = raw.nutricion_100g as Record<string, unknown>
    nutrition_100g = {
      kcal: typeof n.kcal === 'number' ? n.kcal : null,
      fat: typeof n.grasas === 'number' ? n.grasas : (typeof n.fat === 'number' ? n.fat : null),
      saturated_fat: typeof n.saturadas === 'number' ? n.saturadas : (typeof n.saturated_fat === 'number' ? n.saturated_fat : 0.1),
      carbs: typeof n.hidratos === 'number' ? n.hidratos : (typeof n.carbs === 'number' ? n.carbs : null),
      sugars: typeof n.azucares === 'number' ? n.azucares : (typeof n.sugars === 'number' ? n.sugars : 0.1),
      protein: typeof n.proteinas === 'number' ? n.proteinas : (typeof n.protein === 'number' ? n.protein : null),
      salt: typeof n.sal === 'number' ? n.sal : (typeof n.salt === 'number' ? n.salt : 0.05),
    }
  }

  const category = (raw.category as string) || (
    /arroz|garbanzo|lenteja/i.test(name) ? 'Arroz, legumbres y pasta' :
    /pollo/i.test(name) ? 'Aves y pollo' :
    /cebolla|ajo|tomate|pimiento|patata/i.test(name) ? 'Verdura' :
    /espinaca/i.test(name) ? 'Congelados' :
    /aceite/i.test(name) ? 'Aceite, vinagre y sal' :
    /atún|mejillón/i.test(name) ? 'Pescados y mariscos' :
    /caldo/i.test(name) ? 'Conservas, caldos y cremas' : 'Alimentación'
  )

  return {
    id,
    ean: (raw.ean as string) ?? null,
    name,
    brand: (raw.brand as string) ?? (name.toLowerCase().includes('hacendado') ? 'Hacendado' : null),
    packaging: (raw.packaging as string) ?? formato.packaging,
    thumbnail: (raw.thumbnail as string) ?? `/img/products/${id}.jpg`,
    category,
    unit_price,
    bulk_price: Number(raw.bulk_price ?? formato.bulk_price),
    reference_format: (raw.reference_format as string) ?? formato.reference_format,
    unit_size: typeof raw.unit_size === 'number' ? raw.unit_size : formato.unit_size,
    size_format: (raw.size_format as string) ?? formato.size_format,
    price_decreased: Boolean(raw.price_decreased),
    previous_unit_price: typeof raw.previous_unit_price === 'number' ? raw.previous_unit_price : null,
    allergens,
    nutrition_100g,
    nutrition_source: (raw.nutrition_source as string) ?? (raw.fuente_nutricion as string) ?? 'Open Food Facts (ODbL)',
    source_url: (raw.source_url as string) ?? `https://tienda.mercadona.es/product/${id}/`,
    fetched_at: (raw.fetched_at as string) ?? new Date().toISOString().slice(0, 10),
  }
}

/** Normaliza una receta tolerando tanto types.ts como la estructura del branch Datos. */
export function normalizeRecipe(raw: unknown, productsById: ReadonlyMap<string, Product>): Recipe | null {
  if (!isObj(raw)) return null
  const id = String(raw.id ?? '')
  if (!id) return null

  const name = String(raw.name ?? raw.nombre ?? `Receta ${id}`)
  const rawIngs = Array.isArray(raw.ingredients) ? raw.ingredients : (Array.isArray(raw.ingredientes) ? raw.ingredientes : [])

  const ingredients: RecipeIngredient[] = rawIngs.map((item: unknown) => {
    if (!isObj(item)) return { name: 'Ingrediente', quantity: 1, unit: 'ud', label: '1 ud', product_id: null }
    const pid = String(item.product_id ?? item.producto_id ?? '')
    const prod = productsById.get(pid)
    const pName = String(item.name ?? prod?.name ?? `Producto ${pid}`).replace(' Hacendado', '')
    const qInfo = parseQuantity(item.quantity ?? item.cantidad)
    return {
      name: pName,
      quantity: typeof item.quantity === 'number' ? item.quantity : qInfo.quantity,
      unit: (item.unit as 'g' | 'ml' | 'ud') ?? qInfo.unit,
      label: (item.label as string) ?? qInfo.label,
      product_id: pid || null,
      optional: Boolean(item.optional),
    }
  })

  let image: Recipe['image'] = {
    url: `/img/recipes/${id}.jpg`,
    author: 'Equipo SíChef',
    license: 'CC BY-SA 4.0',
    source_url: '',
  }
  if (raw.image && typeof raw.image === 'object') {
    image = raw.image as Recipe['image']
  } else if (typeof raw.foto_real_url === 'string') {
    image = {
      url: `/img/recipes/${id}.jpg`,
      author: 'Wikimedia Commons',
      license: 'CC BY-SA',
      source_url: raw.foto_real_url,
    }
  }

  const steps = Array.isArray(raw.steps) && raw.steps.length > 0
    ? (raw.steps as string[])
    : (DEFAULT_RECIPE_STEPS[id] ?? ['Preparar los ingredientes.', 'Cocinar a fuego medio.', 'Servir caliente.'])

  return {
    id,
    name,
    subtitle: (raw.subtitle as string) ?? 'Receta tradicional',
    image,
    servings: typeof raw.servings === 'number' ? raw.servings : 2,
    time_min: typeof raw.time_min === 'number' ? raw.time_min : 25,
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : ['casera', 'mediterránea'],
    ingredients,
    steps,
    source: (raw.source as Recipe['source']) ?? {
      name: (raw.fuente as string) ?? 'info.mercadona.es',
      url: 'https://info.mercadona.es',
      license: 'Receta Mercadona',
    },
  }
}

export async function loadCatalog(): Promise<Catalog> {
  const [a, p, r, s] = await Promise.all(FILES.map(fetchList))
  const allergens = (a.filter(isAllergen) as Allergen[])

  // Normalizar todos los productos tolerando ambos formatos
  const products = (p.map(normalizeProduct).filter(Boolean) as Product[])
  const productsById = new Map(products.map((x) => [x.id, x]))

  // Normalizar todas las recetas tolerando ambos formatos
  const recipes = (r.map((x) => normalizeRecipe(x, productsById)).filter(Boolean) as Recipe[])
  const stores = (s.filter(isStore) as Store[])

  // Asegurar que cada producto tenga ubicación y stock en cada tienda
  for (const store of stores) {
    const isRuzafa = store.id.includes('ruzafa')
    for (const product of products) {
      if (!store.locations[product.id]) {
        const cat = product.category
        let aisle = isRuzafa ? 7 : 8
        if (/fruta|verdura/i.test(cat)) aisle = isRuzafa ? 1 : 2
        else if (/carne|ave/i.test(cat)) aisle = isRuzafa ? 2 : 4
        else if (/pescado|marisco/i.test(cat)) aisle = isRuzafa ? 3 : 6
        else if (/embutido/i.test(cat)) aisle = isRuzafa ? 4 : 5
        else if (/huevo|lacteo/i.test(cat)) aisle = isRuzafa ? 5 : 3
        else if (/aceite|salsa/i.test(cat)) aisle = isRuzafa ? 6 : 9
        else if (/arroz|legumbre/i.test(cat)) aisle = isRuzafa ? 7 : 8
        else if (/conserva|caldo/i.test(cat)) aisle = isRuzafa ? 8 : 7
        else if (/congelado/i.test(cat)) aisle = 10
        store.locations[product.id] = { aisle, side: 'izq', shelf: 'B' }
      }
      if (store.stock[product.id] === undefined) {
        store.stock[product.id] = true
      }
    }
  }

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
