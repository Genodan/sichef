// Contrato de datos de SíChef.
// Lo comparten los grupos App y Datos: los JSON de app/public/data/ deben cumplirlo.
// Regla de oro: la IA no inventa. Si un dato no existe, va a null / "desconocido"
// y la app muestra «dato no disponible».

/** Los 14 alérgenos de declaración obligatoria (Reglamento UE 1169/2011, Anexo II). */
export type AllergenCode =
  | 'gluten'
  | 'crustaceos'
  | 'huevos'
  | 'pescado'
  | 'cacahuetes'
  | 'soja'
  | 'leche'
  | 'frutos_cascara'
  | 'apio'
  | 'mostaza'
  | 'sesamo'
  | 'sulfitos'
  | 'altramuces'
  | 'moluscos'

/** allergens.json */
export interface Allergen {
  code: AllergenCode
  name: string // "Frutos de cáscara"
  emoji: string // "🌰"
}

/** Miembro del hogar para gestión independiente de alérgenos por persona. */
export interface HouseholdMember {
  id: string
  name: string
  allergies: AllergenCode[]
}

/**
 * Cómo sabemos los alérgenos de un producto:
 * - "declarado": viene de la ficha de Mercadona (nutrition_information.allergens / ingredientes en negrita)
 * - "producto_fresco": producto fresco de un solo ingrediente sin ingredientes añadidos
 *   (regla fija documentada en data/README.md; p. ej. pimiento → ninguno, merluza → pescado)
 * - "desconocido": ficha vacía, "x99" o código no reconocido → «dato no disponible»
 */
export type AllergenStatus = 'declarado' | 'producto_fresco' | 'desconocido'

/** Valores por 100 g/ml (art. 30 Reglamento 1169/2011). Cualquier campo puede faltar → null. */
export interface Nutrition100 {
  kcal: number | null
  fat: number | null // grasas (g)
  saturated_fat: number | null // saturadas (g)
  carbs: number | null // hidratos de carbono (g)
  sugars: number | null // azúcares (g)
  protein: number | null // proteínas (g)
  salt: number | null // sal (g)
}

/** products.json — productos REALES del catálogo de tienda.mercadona.es */
export interface Product {
  id: string // id de Mercadona
  ean: string | null
  name: string // display_name
  brand: string | null
  packaging: string | null // "Bandeja", "Bote"...
  thumbnail: string // ruta local (/img/products/<id>.jpg) o URL de Mercadona
  category: string // categoría de nivel 2, p. ej. "Aves y pollo"
  unit_price: number // € por envase (price_instructions.unit_price)
  bulk_price: number // € por kg / L / ud (price_instructions.bulk_price)
  reference_format: string // "kg" | "L" | "ud"
  unit_size: number | null // tamaño del envase en kg / L / ud (price_instructions.unit_size)
  size_format: string | null // "kg" | "l" | "ud"
  price_decreased: boolean // price_instructions.price_decreased → badge «Ha bajado de precio»
  previous_unit_price: number | null
  allergens: {
    status: AllergenStatus
    contains: AllergenCode[] // «Contiene»
    traces: AllergenCode[] // «Puede contener»
  }
  nutrition_100g: Nutrition100 | null // null si Open Food Facts no lo tiene
  nutrition_source: string | null // "Open Food Facts (ODbL)" | null
  source_url: string // https://tienda.mercadona.es/product/<id>/
  fetched_at: string // fecha ISO de la descarga
}

/** recipes.json — recetas REALES de una fuente con licencia, mapeadas a productos reales */
export interface RecipeIngredient {
  name: string // como lo dice la receta: "Muslos de pollo"
  quantity: number // cantidad usada en la receta, en la unidad de abajo
  unit: 'g' | 'ml' | 'ud'
  label: string // texto para mostrar: "600 g", "2 uds", "1 chorrito"
  product_id: string | null // null si no hay producto en el catálogo (no se inventa)
  optional?: boolean // sal, agua... no cuentan para la cesta
}

export interface Recipe {
  id: string
  name: string // "Pollo con pimientos"
  subtitle: string // tipo de cocina / descripción corta de la fuente
  image: {
    url: string // foto REAL del plato (nunca generada por IA)
    author: string
    license: string // "CC BY-SA 4.0"
    source_url: string
  }
  servings: number
  time_min: number | null
  tags: string[] // "mediterránea", "legumbres"... (de la fuente o por categoría de ingredientes)
  ingredients: RecipeIngredient[]
  steps: string[] // de la fuente original, nunca generados
  source: { name: string; url: string; license: string }
}

/** stores.json — tiendas SIMULADAS (el reto supone etiquetas digitales + servidor interno) */
export interface StoreLocation {
  aisle: number // número de pasillo
  side: 'izq' | 'der'
  shelf: string // "A" (abajo) … "D" (arriba)
}

export interface Store {
  id: string
  name: string // "Mercadona Ruzafa (simulada)"
  simulated: true
  aisles: { number: number; name: string }[]
  locations: Record<string, StoreLocation> // product_id → ubicación
  stock: Record<string, boolean> // product_id → hay stock (simulado)
}
