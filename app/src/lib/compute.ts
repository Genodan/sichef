// Cálculos de SíChef: funciones PURAS (sin React, sin fetch, sin estado).
// Todo sale de los productos y recetas del contrato (types.ts). Nada se estima:
// si un dato falta, el resultado lo marca como parcial o null («dato no disponible»).

import type {
  AllergenCode,
  HouseholdMember,
  Nutrition100,
  Product,
  Recipe,
  RecipeIngredient,
  Store,
  StoreLocation,
} from '../types.ts'

export type ProductIndex = ReadonlyMap<string, Product>

const EPS = 1e-9

// ---------------------------------------------------------------------------
// Constantes normativas y reglas fijas
// ---------------------------------------------------------------------------

/** Orden oficial de los 14 alérgenos (Reglamento UE 1169/2011, Anexo II). */
export const ALLERGEN_CODES = [
  'gluten',
  'crustaceos',
  'huevos',
  'pescado',
  'cacahuetes',
  'soja',
  'leche',
  'frutos_cascara',
  'apio',
  'mostaza',
  'sesamo',
  'sulfitos',
  'altramuces',
  'moluscos',
] as const satisfies readonly AllergenCode[]

export type NutrientKey = keyof Nutrition100

export const NUTRIENT_KEYS: readonly NutrientKey[] = [
  'kcal',
  'protein',
  'carbs',
  'fat',
  'sugars',
  'salt',
  'saturated_fat',
]

/** Los 6 valores que enseña la tarjeta (sin fibra ni micronutrientes). */
export const CARD_NUTRIENTS = ['kcal', 'protein', 'carbs', 'fat', 'sugars', 'salt'] as const
export type CardNutrient = (typeof CARD_NUTRIENTS)[number]

/** Ingestas de referencia de un adulto medio (Reglamento UE 1169/2011, Anexo XIII, parte B). */
export const REFERENCE_INTAKES: Record<NutrientKey, number> = {
  kcal: 2000,
  fat: 70,
  saturated_fat: 20,
  carbs: 260,
  sugars: 90,
  protein: 50,
  salt: 6,
}

/** Umbrales de las etiquetas de la tarjeta. Reglas fijas: nada de IA generativa. */
export const BADGE_RULES = {
  /** «Alta en proteína» si proteína ≥ X g por ración. */
  highProteinG: 25,
  /** «Menos de X kcal» por ración. */
  lowKcal: 500,
  /** «Menos de X €/ración». */
  cheapEurPerServing: 2,
  /** «En X min o menos». */
  quickMin: 30,
} as const

/** Recomendación: peso de las recetas con «paso» frente a las de «sí». */
export const PASS_PENALTY = 0.5
/** Similitud mínima para explicar «¿por qué esta receta?». */
export const MIN_SIMILARITY_FOR_REASON = 0.1

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

export function isNum(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

/** Minúsculas y sin tildes, para comparar y buscar. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

function uniq<T>(items: Iterable<T>): T[] {
  return [...new Set(items)]
}

function sortAllergens(codes: Iterable<AllergenCode>): AllergenCode[] {
  const set = new Set(codes)
  const known = ALLERGEN_CODES.filter((c) => set.has(c))
  // Por si el contrato crece: los códigos que no están en la lista oficial van al final.
  const extra = [...set].filter((c) => !(ALLERGEN_CODES as readonly string[]).includes(c))
  return [...known, ...extra]
}

// ---------------------------------------------------------------------------
// Unidades y envases
// ---------------------------------------------------------------------------

/**
 * Convierte la cantidad de la receta a la unidad del producto (kg, L o ud).
 * Solo conversiones exactas (g→kg, ml→L, ud→ud). Si las unidades no casan
 * (p. ej. «1 ud» de un producto que se vende por kg) devuelve null: no se estima.
 */
export function convertQuantity(
  quantity: number,
  unit: RecipeIngredient['unit'],
  target: string | null | undefined,
): number | null {
  if (!isNum(quantity) || quantity < 0 || !target) return null
  const t = target.trim().toLowerCase()
  if (unit === 'g') return t === 'kg' ? quantity / 1000 : t === 'g' ? quantity : null
  if (unit === 'ml') return t === 'l' ? quantity / 1000 : t === 'ml' ? quantity : null
  if (unit === 'ud') return t === 'ud' || t === 'uds' || t === 'unidad' ? quantity : null
  return null
}

/** Unidad en la que está expresado `unit_size` (tamaño del envase). */
function sizeUnit(product: Product): string | null {
  return product.size_format ?? product.reference_format ?? null
}

/** Envases necesarios = ceil(cantidad / tamaño del envase). null si no se puede calcular. */
export function packagesFor(quantityInSizeUnit: number, product: Product): number | null {
  const size = product.unit_size
  if (!isNum(size) || size <= 0 || !isNum(quantityInSizeUnit)) return null
  if (quantityInSizeUnit <= 0) return 0
  return Math.ceil(quantityInSizeUnit / size - EPS)
}

export function packagesNeeded(
  quantity: number,
  unit: RecipeIngredient['unit'],
  product: Product,
): number | null {
  const q = convertQuantity(quantity, unit, sizeUnit(product))
  return q === null ? null : packagesFor(q, product)
}

// ---------------------------------------------------------------------------
// Coste de la receta
// ---------------------------------------------------------------------------

export interface IngredientLine {
  ingredient: RecipeIngredient
  product: Product | null
  /** € de la parte usada: bulk_price × cantidad (en kg / L / ud). */
  usedCost: number | null
  /** Envases que hay que comprar para esta receta. */
  packages: number | null
  /** € en caja: unit_price × envases. */
  packagesCost: number | null
  /** Va a la cesta (no es opcional y tiene producto). */
  countsForBasket: boolean
}

export function ingredientLine(ing: RecipeIngredient, products: ProductIndex): IngredientLine {
  const product = ing.product_id ? (products.get(ing.product_id) ?? null) : null
  let usedCost: number | null = null
  let packages: number | null = null
  let packagesCost: number | null = null
  if (product) {
    const qRef = convertQuantity(ing.quantity, ing.unit, product.reference_format)
    if (qRef !== null && isNum(product.bulk_price)) usedCost = qRef * product.bulk_price
    else {
      // Si la unidad de bulk_price no casa (p. ej. «dc»), parte proporcional del envase:
      // unit_price × cantidad / unit_size. Es aritmética sobre datos reales, no una estimación.
      const qSize = convertQuantity(ing.quantity, ing.unit, sizeUnit(product))
      if (qSize !== null && isNum(product.unit_size) && product.unit_size > 0 && isNum(product.unit_price)) {
        usedCost = (product.unit_price * qSize) / product.unit_size
      }
    }
    packages = packagesNeeded(ing.quantity, ing.unit, product)
    if (packages !== null && isNum(product.unit_price)) packagesCost = packages * product.unit_price
  }
  return {
    ingredient: ing,
    product,
    usedCost,
    packages,
    packagesCost,
    countsForBasket: !ing.optional && product !== null,
  }
}

export interface RecipeCost {
  lines: IngredientLine[]
  /** Σ coste de lo usado ÷ raciones. null si ningún ingrediente tiene precio. */
  perServing: number | null
  /** Σ coste de lo usado (receta entera). */
  total: number | null
  /** Lo que pagas en caja: Σ unit_price × envases. */
  inBasket: number | null
  /** Falta el precio de algún ingrediente no opcional. */
  partial: boolean
  inBasketPartial: boolean
  /** Ingredientes no opcionales sin precio calculable. */
  missing: string[]
}

export function recipeCost(recipe: Recipe, products: ProductIndex): RecipeCost {
  const lines = recipe.ingredients.map((ing) => ingredientLine(ing, products))
  let total = 0
  let anyUsed = false
  let inBasket = 0
  let anyBasket = false
  const missing: string[] = []
  const missingBasket: string[] = []
  for (const line of lines) {
    if (line.ingredient.optional) continue // sal, agua…: no cuentan para la cesta ni el coste
    if (line.usedCost !== null) {
      total += line.usedCost
      anyUsed = true
    } else missing.push(line.ingredient.name)
    if (line.packagesCost !== null) {
      inBasket += line.packagesCost
      anyBasket = true
    } else missingBasket.push(line.ingredient.name)
  }
  const servings = isNum(recipe.servings) && recipe.servings > 0 ? recipe.servings : null
  return {
    lines,
    total: anyUsed ? total : null,
    perServing: anyUsed && servings ? total / servings : null,
    inBasket: anyBasket ? inBasket : null,
    partial: missing.length > 0,
    inBasketPartial: missingBasket.length > 0,
    missing,
  }
}

// ---------------------------------------------------------------------------
// Nutrición por ración
// ---------------------------------------------------------------------------

export interface RecipeNutrition {
  /** Valores por ración; null = dato no disponible (ningún ingrediente aporta ese dato). */
  perServing: Record<NutrientKey, number | null>
  /** Algún ingrediente no se ha podido sumar o le falta algún campo. */
  partial: boolean
  /** Campos en los que falta el dato de algún ingrediente. */
  partialFields: NutrientKey[]
  /** Ingredientes que no se han podido sumar (sin producto, sin ficha o en «ud»). */
  missing: string[]
  /** Ingredientes sumados. */
  counted: number
  /** Fuentes de los datos (nutrition_source únicos). */
  sources: string[]
}

/** Cantidad en g o ml (los valores vienen por 100 g/ml). «ud» no se convierte: no se estima el peso. */
function nutritionAmount(ing: RecipeIngredient): number | null {
  if (!isNum(ing.quantity) || ing.quantity < 0) return null
  return ing.unit === 'g' || ing.unit === 'ml' ? ing.quantity : null
}

function emptyNutrients(): Record<NutrientKey, number | null> {
  return { kcal: null, fat: null, saturated_fat: null, carbs: null, sugars: null, protein: null, salt: null }
}

export function recipeNutrition(recipe: Recipe, products: ProductIndex): RecipeNutrition {
  const sums: Record<NutrientKey, number> = {
    kcal: 0, fat: 0, saturated_fat: 0, carbs: 0, sugars: 0, protein: 0, salt: 0,
  }
  const hasAny = new Set<NutrientKey>()
  const partialFields = new Set<NutrientKey>()
  const missing: string[] = []
  const sources: string[] = []
  let counted = 0

  for (const ing of recipe.ingredients) {
    const product = ing.product_id ? products.get(ing.product_id) : undefined
    if (!product) {
      // Agua, sal sin producto… (opcionales) no cuentan; lo demás hace la nutrición parcial.
      if (!ing.optional) missing.push(ing.name)
      continue
    }
    const amount = nutritionAmount(ing)
    const n = product.nutrition_100g
    if (amount === null || !n) {
      missing.push(ing.name)
      continue
    }
    counted++
    if (product.nutrition_source) sources.push(product.nutrition_source)
    for (const key of NUTRIENT_KEYS) {
      const v = n[key]
      if (isNum(v)) {
        sums[key] += (v * amount) / 100
        hasAny.add(key)
      } else partialFields.add(key)
    }
  }
  if (missing.length > 0) for (const key of NUTRIENT_KEYS) partialFields.add(key)

  const servings = isNum(recipe.servings) && recipe.servings > 0 ? recipe.servings : null
  const perServing = emptyNutrients()
  if (servings) for (const key of NUTRIENT_KEYS) if (hasAny.has(key)) perServing[key] = sums[key] / servings

  return {
    perServing,
    partial: partialFields.size > 0,
    partialFields: NUTRIENT_KEYS.filter((k) => partialFields.has(k)),
    missing,
    counted,
    sources: uniq(sources),
  }
}

/** % de la ingesta de referencia (para las barras). */
export function percentOfReference(key: NutrientKey, value: number | null): number | null {
  return isNum(value) ? (value / REFERENCE_INTAKES[key]) * 100 : null
}

// ---------------------------------------------------------------------------
// Alérgenos
// ---------------------------------------------------------------------------

export interface UnknownAllergenItem {
  ingredient: string
  product: string | null
  /** sin_ficha: el producto tiene alérgenos «desconocido». sin_producto: ingrediente sin producto. */
  reason: 'sin_ficha' | 'sin_producto'
}

export interface RecipeAllergens {
  contains: AllergenCode[]
  /** «Puede contener», sin los que ya están en contains. */
  traces: AllergenCode[]
  unknown: UnknownAllergenItem[]
}

/** Unión de los alérgenos de todos los productos de la receta (opcionales incluidos: seguridad primero). */
export function recipeAllergens(recipe: Recipe, products: ProductIndex): RecipeAllergens {
  const contains = new Set<AllergenCode>()
  const traces = new Set<AllergenCode>()
  const unknown: UnknownAllergenItem[] = []
  for (const ing of recipe.ingredients) {
    const product = ing.product_id ? products.get(ing.product_id) : undefined
    if (!product) {
      if (!ing.optional) unknown.push({ ingredient: ing.name, product: null, reason: 'sin_producto' })
      continue
    }
    const a = product.allergens
    if (!a || a.status === 'desconocido') {
      unknown.push({ ingredient: ing.name, product: product.name, reason: 'sin_ficha' })
    }
    for (const c of a?.contains ?? []) contains.add(c)
    for (const c of a?.traces ?? []) traces.add(c)
  }
  for (const c of contains) traces.delete(c)
  return { contains: sortAllergens(contains), traces: sortAllergens(traces), unknown }
}

// ---------------------------------------------------------------------------
// Visibilidad según el perfil (filtro duro ANTES de recomendar)
// ---------------------------------------------------------------------------

export interface AllergyProfile {
  allergies: readonly AllergenCode[]
  excludeTraces: boolean
}

export type HiddenReason =
  | { kind: 'contiene'; allergens: AllergenCode[] }
  | { kind: 'trazas'; allergens: AllergenCode[] }
  | { kind: 'dato_no_disponible'; items: UnknownAllergenItem[] }

export interface Visibility {
  visible: boolean
  /** Todos los motivos (vacío si es visible). */
  reasons: HiddenReason[]
  /** Oculta por un alérgeno del perfil (contiene o trazas). Si es false y está oculta: falta de datos. */
  byAllergy: boolean
}

export function recipeVisibility(a: RecipeAllergens, profile: AllergyProfile): Visibility {
  const mine = new Set(profile.allergies)
  const reasons: HiddenReason[] = []
  const hitContains = a.contains.filter((c) => mine.has(c))
  if (hitContains.length) reasons.push({ kind: 'contiene', allergens: hitContains })
  if (profile.excludeTraces) {
    const hitTraces = a.traces.filter((c) => mine.has(c))
    if (hitTraces.length) reasons.push({ kind: 'trazas', allergens: hitTraces })
  }
  if (mine.size > 0 && a.unknown.length > 0) reasons.push({ kind: 'dato_no_disponible', items: a.unknown })
  return {
    visible: reasons.length === 0,
    reasons,
    byAllergy: reasons.some((r) => r.kind !== 'dato_no_disponible'),
  }
}

// ---------------------------------------------------------------------------
// Idoneidad por miembro del hogar («Quién puede comer y quién no»)
// ---------------------------------------------------------------------------

export interface MemberSuitability {
  memberId: string
  memberName: string
  canEat: boolean
  reasons: HiddenReason[]
  byAllergy: boolean
  conflictAllergens: AllergenCode[]
}

export interface HouseholdSuitability {
  members: MemberSuitability[]
  canEat: MemberSuitability[]
  cannotEat: MemberSuitability[]
  allCanEat: boolean
  noneCanEat: boolean
  someCanEat: boolean
}

/** Calcula de forma determinista para cada persona de la casa si puede o no comer la receta. */
export function recipeHouseholdSuitability(
  a: RecipeAllergens,
  members: readonly HouseholdMember[],
  excludeTraces: boolean,
): HouseholdSuitability {
  const memberResults: MemberSuitability[] = members.map((m) => {
    if (m.allergies.length === 0) {
      return {
        memberId: m.id,
        memberName: m.name,
        canEat: true,
        reasons: [],
        byAllergy: false,
        conflictAllergens: [],
      }
    }
    const vis = recipeVisibility(a, { allergies: m.allergies, excludeTraces })
    const conflictAllergens = vis.reasons.flatMap((r) => (r.kind !== 'dato_no_disponible' ? r.allergens : []))
    return {
      memberId: m.id,
      memberName: m.name,
      canEat: vis.visible,
      reasons: vis.reasons,
      byAllergy: vis.byAllergy,
      conflictAllergens: [...new Set(conflictAllergens)],
    }
  })

  const canEat = memberResults.filter((m) => m.canEat)
  const cannotEat = memberResults.filter((m) => !m.canEat)

  return {
    members: memberResults,
    canEat,
    cannotEat,
    allCanEat: memberResults.length > 0 && cannotEat.length === 0,
    noneCanEat: memberResults.length > 0 && canEat.length === 0,
    someCanEat: canEat.length > 0 && cannotEat.length > 0,
  }
}

// ---------------------------------------------------------------------------
// Etiquetas («Alta en proteína»…) con umbrales fijos
// ---------------------------------------------------------------------------

export interface RecipeBadge {
  id: 'proteina' | 'kcal' | 'precio' | 'tiempo'
  label: string
}

export function recipeBadges(recipe: Recipe, nutrition: RecipeNutrition, cost: RecipeCost): RecipeBadge[] {
  const badges: RecipeBadge[] = []
  const n = nutrition.perServing
  // Una suma parcial es un mínimo: «≥ X» sigue siendo cierto aunque falten datos…
  if (isNum(n.protein) && n.protein >= BADGE_RULES.highProteinG) {
    badges.push({ id: 'proteina', label: 'Alta en proteína' })
  }
  // …pero «menos de X» solo se afirma si el dato es completo.
  if (isNum(n.kcal) && !nutrition.partialFields.includes('kcal') && n.kcal < BADGE_RULES.lowKcal) {
    badges.push({ id: 'kcal', label: `Menos de ${BADGE_RULES.lowKcal} kcal` })
  }
  if (isNum(cost.perServing) && !cost.partial && cost.perServing < BADGE_RULES.cheapEurPerServing) {
    badges.push({ id: 'precio', label: `Menos de ${BADGE_RULES.cheapEurPerServing} €/ración` })
  }
  if (isNum(recipe.time_min) && recipe.time_min <= BADGE_RULES.quickMin) {
    badges.push({ id: 'tiempo', label: `En ${BADGE_RULES.quickMin} min o menos` })
  }
  return badges
}

// ---------------------------------------------------------------------------
// Recomendación por likes (Jaccard sobre etiquetas + categorías de producto)
// ---------------------------------------------------------------------------

/** clave normalizada → texto para mostrar. Claves «tag:…» y «cat:…». */
export type FeatureSet = ReadonlyMap<string, string>

export function recipeFeatures(recipe: Recipe, products: ProductIndex): Map<string, string> {
  const f = new Map<string, string>()
  for (const t of recipe.tags ?? []) {
    const k = normalizeText(t)
    if (k) f.set(`tag:${k}`, t)
  }
  for (const ing of recipe.ingredients) {
    if (ing.optional || !ing.product_id) continue
    const p = products.get(ing.product_id)
    if (p?.category) f.set(`cat:${normalizeText(p.category)}`, p.category)
  }
  return f
}

export function jaccard(a: FeatureSet, b: FeatureSet): number {
  if (a.size === 0 && b.size === 0) return 0
  let inter = 0
  for (const k of a.keys()) if (b.has(k)) inter++
  const union = a.size + b.size - inter
  return union === 0 ? 0 : inter / union
}

export interface RankInput {
  id: string
  features: FeatureSet
}

export interface RankedRecipe {
  id: string
  score: number
  /** «Comparte X con Y, que te gustó» (null si no hay parecido suficiente). */
  because: { recipeId: string; shared: string[] } | null
}

/**
 * Orden del mazo: score = máx. Jaccard con las recetas con «sí»
 * − PASS_PENALTY × máx. Jaccard con las de «paso». Empate → orden original.
 */
export function rankRecipes(
  candidates: readonly RankInput[],
  liked: readonly RankInput[],
  passed: readonly RankInput[],
): RankedRecipe[] {
  const scored = candidates.map((c, index) => {
    let bestLike = 0
    let bestLiked: RankInput | null = null
    for (const l of liked) {
      const s = jaccard(c.features, l.features)
      if (s > bestLike) {
        bestLike = s
        bestLiked = l
      }
    }
    let bestPass = 0
    for (const p of passed) bestPass = Math.max(bestPass, jaccard(c.features, p.features))
    const score = bestLike - PASS_PENALTY * bestPass
    let because: RankedRecipe['because'] = null
    const ref: RankInput | null = bestLiked
    if (ref && bestLike >= MIN_SIMILARITY_FOR_REASON) {
      const shared = [...c.features.keys()]
        .filter((k) => ref.features.has(k))
        .map((k) => c.features.get(k) ?? k)
      if (shared.length) because = { recipeId: ref.id, shared }
    }
    return { id: c.id, score, because, index }
  })
  scored.sort((a, b) => b.score - a.score || a.index - b.index)
  return scored.map(({ id, score, because }) => ({ id, score, because }))
}

// ---------------------------------------------------------------------------
// Análisis completo de una receta (se calcula una vez al cargar los datos)
// ---------------------------------------------------------------------------

export interface RecipeInfo {
  recipe: Recipe
  cost: RecipeCost
  nutrition: RecipeNutrition
  allergens: RecipeAllergens
  badges: RecipeBadge[]
  features: Map<string, string>
  /** Productos de la receta con price_decreased (badge «Ha bajado de precio»). */
  priceDecreased: Product[]
  /** Fechas de descarga de los productos (para la trazabilidad). */
  fetchedAt: string | null
}

export function analyzeRecipe(recipe: Recipe, products: ProductIndex): RecipeInfo {
  const cost = recipeCost(recipe, products)
  const nutrition = recipeNutrition(recipe, products)
  const used = cost.lines.filter((l) => l.countsForBasket).map((l) => l.product as Product)
  const dates = cost.lines
    .map((l) => l.product?.fetched_at)
    .filter((d): d is string => typeof d === 'string' && d.length > 0)
    .sort()
  return {
    recipe,
    cost,
    nutrition,
    allergens: recipeAllergens(recipe, products),
    badges: recipeBadges(recipe, nutrition, cost),
    features: recipeFeatures(recipe, products),
    priceDecreased: uniq(used.filter((p) => p.price_decreased)),
    fetchedAt: dates.length ? dates[dates.length - 1] : null,
  }
}

// ---------------------------------------------------------------------------
// Cesta: lista unificada ordenada por pasillo (= ruta)
// ---------------------------------------------------------------------------

export interface ShoppingItem {
  product: Product
  /** Cantidad total en la unidad del envase; null si alguna receta usa una unidad no convertible. */
  quantity: number | null
  packages: number | null
  cost: number | null
  uses: { recipeId: string; recipeName: string; label: string; ingredientIndex: number }[]
  location: StoreLocation | null
  /** Stock simulado de la tienda; null si la tienda no lo indica. */
  inStock: boolean | null
}

export interface ShoppingGroup {
  aisle: number | null
  aisleName: string | null
  items: ShoppingItem[]
}

export interface ShoppingList {
  groups: ShoppingGroup[]
  items: ShoppingItem[]
  /** Σ envases × unit_price. */
  total: number | null
  partial: boolean
  /** Ingredientes sin producto en el catálogo. */
  missing: { recipeId: string; recipeName: string; ingredient: string; label: string }[]
  /** Pasillos a visitar, en orden de ruta. */
  aislesToVisit: number[]
}

const SIDE_ORDER: Record<string, number> = { izq: 0, der: 1 }

export function buildShoppingList(
  recipes: readonly Recipe[],
  products: ProductIndex,
  store: Store | null,
  isIngredientInBasket?: (recipeId: string, ingredientIndex: number) => boolean,
): ShoppingList {
  const byProduct = new Map<string, { product: Product; qty: number; ok: boolean; uses: ShoppingItem['uses'] }>()
  const missing: ShoppingList['missing'] = []

  for (const recipe of recipes) {
    for (let i = 0; i < recipe.ingredients.length; i++) {
      const ing = recipe.ingredients[i]
      if (ing.optional) continue
      if (isIngredientInBasket && !isIngredientInBasket(recipe.id, i)) continue
      const product = ing.product_id ? products.get(ing.product_id) : undefined
      if (!product) {
        missing.push({ recipeId: recipe.id, recipeName: recipe.name, ingredient: ing.name, label: ing.label })
        continue
      }
      let entry = byProduct.get(product.id)
      if (!entry) {
        entry = { product, qty: 0, ok: true, uses: [] }
        byProduct.set(product.id, entry)
      }
      const q = convertQuantity(ing.quantity, ing.unit, sizeUnit(product))
      if (q === null) entry.ok = false
      else entry.qty += q
      entry.uses.push({ recipeId: recipe.id, recipeName: recipe.name, label: ing.label, ingredientIndex: i })
    }
  }

  const items: ShoppingItem[] = [...byProduct.values()].map(({ product, qty, ok, uses }) => {
    const packages = ok ? packagesFor(qty, product) : null
    const cost = packages !== null && isNum(product.unit_price) ? packages * product.unit_price : null
    const location = store?.locations?.[product.id] ?? null
    const stock = store?.stock?.[product.id]
    return {
      product,
      quantity: ok ? qty : null,
      packages,
      cost,
      uses,
      location,
      inStock: typeof stock === 'boolean' ? stock : null,
    }
  })

  const groupsMap = new Map<number | null, ShoppingItem[]>()
  for (const item of items) {
    const key = item.location ? item.location.aisle : null
    const list = groupsMap.get(key) ?? []
    list.push(item)
    groupsMap.set(key, list)
  }
  const aisleName = (n: number | null) => (n === null ? null : (store?.aisles?.find((a) => a.number === n)?.name ?? null))
  const groups: ShoppingGroup[] = [...groupsMap.entries()]
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : a - b))
    .map(([aisle, list]) => ({
      aisle,
      aisleName: aisleName(aisle),
      items: list.sort(
        (x, y) =>
          (SIDE_ORDER[x.location?.side ?? ''] ?? 2) - (SIDE_ORDER[y.location?.side ?? ''] ?? 2) ||
          (x.location?.shelf ?? '').localeCompare(y.location?.shelf ?? '') ||
          x.product.name.localeCompare(y.product.name, 'es'),
      ),
    }))

  let total = 0
  let anyCost = false
  let partial = missing.length > 0
  for (const item of items) {
    if (item.cost === null) partial = true
    else {
      total += item.cost
      anyCost = true
    }
  }

  return {
    groups,
    items: groups.flatMap((g) => g.items),
    total: anyCost ? total : null,
    partial,
    missing,
    aislesToVisit: groups.map((g) => g.aisle).filter((a): a is number => a !== null),
  }
}

// ---------------------------------------------------------------------------
// Ingredientes compartidos entre recetas y la cesta
// ---------------------------------------------------------------------------

export interface SharedBasketIngredient {
  ingredientName: string
  ingredientIndex: number
  productId: string
  product: Product
  recipeQuantity: number
  recipeUnit: RecipeIngredient['unit']
  recipeLabel: string
  /** Otras recetas en la cesta que usan este mismo producto */
  otherUses: {
    recipeId: string
    recipeName: string
    label: string
  }[]
  /** Envases actuales en la cesta para este producto sumando las otras recetas */
  currentBasketPackages: number
  /** Envases totales necesarios sumando las otras recetas + esta receta */
  totalPackagesNeeded: number
  /** Si hace falta comprar envases adicionales (totalPackagesNeeded > currentBasketPackages) */
  needsExtraPackage: boolean
  /** Envases adicionales recomendados (totalPackagesNeeded - currentBasketPackages) */
  extraPackagesNeeded: number
  /** Si este ingrediente ya ha sido añadido a la cesta para esta receta */
  isAddedToBasketForThisRecipe: boolean
}

export interface RecipeBasketOverlap {
  recipeId: string
  recipeName: string
  /** Todos los ingredientes de la receta que coinciden con productos en la cesta por otras recetas */
  sharedIngredients: SharedBasketIngredient[]
  /** Ingredientes compartidos que necesitan envases adicionales y aún no se han añadido para esta receta */
  needsMore: SharedBasketIngredient[]
  /** Ingredientes compartidos que necesitaban más envases y ya fueron añadidos para esta receta */
  alreadyAddedExtra: SharedBasketIngredient[]
  /** Ingredientes compartidos donde el envase en la cesta es suficiente para ambas recetas */
  sufficient: SharedBasketIngredient[]
}

/**
 * Comprueba si la receta requiere ingredientes que ya están en la cesta por otras recetas,
 * y determina si los envases actuales bastan o si se necesita añadir más (p. ej. 2 envases, 1 por receta).
 */
export function computeRecipeBasketOverlap(
  recipe: Recipe,
  basketRecipeIds: readonly string[],
  pantry: Record<string, string> | undefined,
  allRecipes: readonly Recipe[],
  products: ProductIndex,
): RecipeBasketOverlap {
  const recipeMap = new Map<string, Recipe>()
  for (const r of allRecipes) recipeMap.set(r.id, r)

  // 1. Recolectar ingredientes en la cesta de OTRAS recetas
  interface OtherBasketUsage {
    product: Product
    totalQty: number
    isConvertible: boolean
    uses: { recipeId: string; recipeName: string; label: string }[]
  }

  const otherBasketProducts = new Map<string, OtherBasketUsage>()

  for (const rId of basketRecipeIds) {
    if (rId === recipe.id) continue
    const otherRecipe = recipeMap.get(rId)
    if (!otherRecipe) continue

    for (let j = 0; j < otherRecipe.ingredients.length; j++) {
      if (pantry?.[`${rId}:${j}`] !== 'basket') continue
      const ing = otherRecipe.ingredients[j]
      if (ing.optional || !ing.product_id) continue

      const product = products.get(ing.product_id)
      if (!product) continue

      let entry = otherBasketProducts.get(product.id)
      if (!entry) {
        entry = { product, totalQty: 0, isConvertible: true, uses: [] }
        otherBasketProducts.set(product.id, entry)
      }

      const q = convertQuantity(ing.quantity, ing.unit, sizeUnit(product))
      if (q === null) {
        entry.isConvertible = false
      } else {
        entry.totalQty += q
      }
      entry.uses.push({
        recipeId: otherRecipe.id,
        recipeName: otherRecipe.name,
        label: ing.label,
      })
    }
  }

  // 2. Analizar cada ingrediente de la receta evaluada
  const sharedIngredients: SharedBasketIngredient[] = []

  for (let i = 0; i < recipe.ingredients.length; i++) {
    const ing = recipe.ingredients[i]
    if (ing.optional || !ing.product_id) continue

    const otherUsage = otherBasketProducts.get(ing.product_id)
    if (!otherUsage) continue

    const product = otherUsage.product
    const qThis = convertQuantity(ing.quantity, ing.unit, sizeUnit(product))

    // Calcular envases de las otras recetas
    let currentBasketPackages = 1
    if (otherUsage.isConvertible) {
      const p = packagesFor(otherUsage.totalQty, product)
      currentBasketPackages = p !== null && p > 0 ? p : 1
    } else {
      currentBasketPackages = Math.max(1, otherUsage.uses.length)
    }

    // Calcular envases combinados (otras recetas + esta receta)
    let totalPackagesNeeded = currentBasketPackages + 1
    if (otherUsage.isConvertible && qThis !== null) {
      const pTotal = packagesFor(otherUsage.totalQty + qThis, product)
      if (pTotal !== null) {
        totalPackagesNeeded = pTotal
      }
    }

    if (totalPackagesNeeded < currentBasketPackages) {
      totalPackagesNeeded = currentBasketPackages
    }

    const extraPackagesNeeded = totalPackagesNeeded - currentBasketPackages
    const needsExtraPackage = extraPackagesNeeded > 0
    const isAddedToBasketForThisRecipe = pantry?.[`${recipe.id}:${i}`] === 'basket'

    sharedIngredients.push({
      ingredientName: ing.name,
      ingredientIndex: i,
      productId: product.id,
      product,
      recipeQuantity: ing.quantity,
      recipeUnit: ing.unit,
      recipeLabel: ing.label,
      otherUses: otherUsage.uses,
      currentBasketPackages,
      totalPackagesNeeded,
      needsExtraPackage,
      extraPackagesNeeded,
      isAddedToBasketForThisRecipe,
    })
  }

  const needsMore = sharedIngredients.filter((s) => s.needsExtraPackage && !s.isAddedToBasketForThisRecipe)
  const alreadyAddedExtra = sharedIngredients.filter((s) => s.needsExtraPackage && s.isAddedToBasketForThisRecipe)
  const sufficient = sharedIngredients.filter((s) => !s.needsExtraPackage)

  return {
    recipeId: recipe.id,
    recipeName: recipe.name,
    sharedIngredients,
    needsMore,
    alreadyAddedExtra,
    sufficient,
  }
}
