// Integración segura con Google Gemini para SíChef («Chef IA»).
// Protege la clave GEMINI_API_KEY en el backend/servidor (Vercel Serverless Function / Vite dev server)
// sin exponer la clave en el código cliente ni en variables públicas del navegador.
//
// Cumple con AGENTS.md:
// 1. La IA no inventa datos: solo recomienda recetas del catálogo oficial (recipes.json).
// 2. Precios y nutrientes siempre «calculados», nunca «estimados».
// 3. Reglas duras de alérgenos antes de recomendar.

import type { AppState } from './appState.ts'
import type { Catalog } from './data.ts'
import type { HouseholdSuitability, RecipeInfo, Visibility } from './compute.ts'
import { formatEuro, formatNutrient } from './format.ts'

const STORAGE_KEY = 'sichef_gemini_api_key'

/** Devuelve la clave si el usuario ha configurado una manualmente en el navegador */
export function getStoredGeminiApiKey(): string {
  if (typeof window === 'undefined') return ''
  const local = window.localStorage.getItem(STORAGE_KEY)
  return local ? local.trim() : ''
}

export function saveGeminiApiKey(key: string): void {
  if (typeof window === 'undefined') return
  const clean = key.trim()
  if (clean) {
    window.localStorage.setItem(STORAGE_KEY, clean)
  } else {
    window.localStorage.removeItem(STORAGE_KEY)
  }
}

export function clearGeminiApiKey(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(STORAGE_KEY)
  }
}

/** Comprueba si el backend (servidor Vercel o Vite dev) tiene GEMINI_API_KEY configurada */
export async function checkBackendGeminiStatus(): Promise<boolean> {
  try {
    const res = await fetch('/api/chat', { method: 'GET' })
    if (!res.ok) return false
    const data = await res.json()
    return Boolean(data.hasKey)
  } catch {
    return false
  }
}

export interface RecommendationResult {
  recipeId: string | null
  reply: string
  reason: string
  source: 'gemini' | 'local'
  modelUsed?: string
}

export interface ChatContextParams {
  userPrompt: string
  history?: { role: 'user' | 'assistant'; text: string }[]
  catalog: Catalog
  state: AppState
  visibility: ReadonlyMap<string, Visibility>
  household: ReadonlyMap<string, HouseholdSuitability>
}

/** Prepara el catálogo en formato estructurado para alimentar a Google Gemini. */
function buildCatalogContext(
  catalog: Catalog,
  visibility: ReadonlyMap<string, Visibility>,
  household: ReadonlyMap<string, HouseholdSuitability>,
): string {
  return catalog.recipes
    .map((r) => {
      const info: RecipeInfo | undefined = catalog.info.get(r.id)
      const vis = visibility.get(r.id)
      const suit = household.get(r.id)
      const safeForHousehold = suit ? suit.allCanEat : vis ? vis.visible : true

      const costStr =
        info && info.cost.perServing !== null
          ? `${formatEuro(info.cost.perServing)} por ración (calculado)`
          : 'Precio por ración: dato no disponible'

      const proteinStr =
        info && info.nutrition.perServing.protein !== null
          ? `${formatNutrient('protein', info.nutrition.perServing.protein)} por ración (calculada)`
          : 'Proteína: dato no disponible'

      const kcalStr =
        info && info.nutrition.perServing.kcal !== null
          ? `${formatNutrient('kcal', info.nutrition.perServing.kcal)} por ración (calculadas)`
          : 'Kcal: dato no disponible'

      const badges = info ? info.badges.map((b) => b.label).join(', ') : ''
      const ingredients = r.ingredients.map((i) => i.name).join(', ')

      return `---
ID: "${r.id}"
Nombre: "${r.name}"
Subtítulo: "${r.subtitle}"
Tiempo de preparación: ${r.time_min !== null ? `${r.time_min} minutos` : 'dato no disponible'}
Raciones: ${r.servings}
Etiquetas: [${r.tags.join(', ')}]
Ingredientes reales Mercadona: [${ingredients}]
Coste: ${costStr}
Valores nutricionales: ${proteinStr}, ${kcalStr}
Badges destacadas: [${badges}]
Apta para alérgenos del hogar del usuario: ${safeForHousehold ? 'SÍ (segura)' : 'NO (contiene alérgenos del perfil)'}
---`
    })
    .join('\n\n')
}

const SYSTEM_INSTRUCTION = `Eres el Chef IA de SíChef, la app de recetas y compra inteligente para el supermercado Mercadona.
Tu misión es hablar con el usuario en tono cercano, simpático y gastronómico, recomendando DIRECTAMENTE una receta de nuestro catálogo oficial que encaje con lo que pide en lenguaje natural.

REGLAS ESTRICTAS DE SÍCHEF (OBLIGATORIAS):
1. Solo puedes recomendar recetas que existan en la lista de recetas disponibles. NUNCA inventes nombres de recetas, ingredientes ni cifras que no figuren en la lista.
2. Si recomiendas una receta, debes proporcionar exactamente su "recipeId" (por ejemplo "receta-garbanzos" o "receta-pollo").
3. NUNCA digas "estimado", "estimamos" ni "aproximado". Debes usar la palabra "calculado" (ej: "Aporta 28 g de proteína calculada por ración").
4. Nunca hables de descuentos porcentuales, rebajas ni ofertas. En Mercadona rige Siempre Precios Bajos.
5. Filtro duro de alérgenos: NUNCA recomiendes una receta si en su ficha indica "Apta para alérgenos del hogar del usuario: NO". Si el usuario pide algo que solo tiene opciones no aptas por sus alergias, explícale que no se la puedes recomendar por seguridad alimentaria.
6. Si el usuario saluda o pregunta en general qué puedes hacer, dale la bienvenida calurosamente, sugiérele pedirte cosas como "un plato caliente con arroz", "algo alto en proteína" o "una receta rápida", y devuelve "recipeId": null.
7. Devuelve SIEMPRE tu respuesta en formato JSON válido con los campos exactos:
{
  "recipeId": string | null,
  "reply": string,
  "reason": string
}`

/** Realiza la petición segura a través del endpoint /api/chat (servidor backend) */
async function callChatBackend(
  systemPrompt: string,
  userMessage: string,
  history: { role: 'user' | 'assistant'; text: string }[],
  customKey?: string,
): Promise<{ text: string }> {
  const contents = [
    ...history.slice(-4).map((h) => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }],
    })),
    {
      role: 'user',
      parts: [{ text: userMessage }],
    },
  ]

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (customKey && customKey.trim()) {
    headers['x-gemini-api-key'] = customKey.trim()
  }

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents,
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    }),
  })

  if (!res.ok) {
    const errData = await res.json().catch(() => null)
    throw new Error(errData?.error || `Error del servidor (${res.status})`)
  }

  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new Error('No se recibió respuesta del asistente')
  }

  return { text }
}

/** Motor de recomendación local inteligente (fallback si no hay clave configurada o no hay red) */
function localChefFallback({
  userPrompt,
  catalog,
  visibility,
  household,
}: ChatContextParams): RecommendationResult {
  const norm = userPrompt.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

  // 1. Filtrar recetas aptas para alérgenos
  const safeRecipes = catalog.recipes.filter((r) => {
    const suit = household.get(r.id)
    if (suit && !suit.allCanEat) return false
    const vis = visibility.get(r.id)
    if (vis && !vis.visible) return false
    return true
  })

  if (safeRecipes.length === 0) {
    return {
      recipeId: null,
      reply: 'He revisado nuestro recetario, pero todas las recetas disponibles contienen o pueden contener alérgenos incompatibles con tu perfil de hogar.',
      reason: 'Por seguridad alimentaria estricta de SíChef, no puedo sugerirte platos que pongan en riesgo a ningún miembro de tu hogar.',
      source: 'local',
    }
  }

  // Si es un saludo general
  const isGreeting = /^(hola|buenas|buenos dias|buenas tardes|que tal|menu|ayuda|que sabes hacer)/i.test(norm.trim())
  if (isGreeting && !norm.includes('arroz') && !norm.includes('proteina') && !norm.includes('caliente')) {
    return {
      recipeId: null,
      reply: '¡Hola! Soy tu Chef IA de SíChef. Estoy aquí para recomendarte el plato perfecto con ingredientes reales de Mercadona según lo que te apetezca.',
      reason: 'Pídeme cosas como: «Me apetece un plato caliente con arroz», «Algo con mucha proteína» o «Una cena rápida con legumbres» y te daré una recomendación directa.',
      source: 'local',
    }
  }

  // 2. Sistema de puntuación para seleccionar la receta más idónea
  let bestRecipe = safeRecipes[0]
  let bestScore = -1
  let matchReason = ''

  for (const recipe of safeRecipes) {
    let score = 0
    const reasons: string[] = []
    const info = catalog.info.get(recipe.id)

    // Palabras clave de arroz
    if (norm.includes('arroz')) {
      const hasRice = recipe.ingredients.some((i) => i.name.toLowerCase().includes('arroz')) || recipe.tags.includes('arroz')
      if (hasRice) {
        score += 10
        reasons.push('lleva arroz redondo como base principal')
      }
    }

    // Palabras clave de caliente / guiso
    if (norm.includes('caliente') || norm.includes('guiso') || norm.includes('meloso') || norm.includes('caldo')) {
      if (recipe.subtitle.toLowerCase().includes('guiso') || recipe.subtitle.toLowerCase().includes('meloso') || recipe.tags.includes('tradicional')) {
        score += 6
        reasons.push('es un plato caliente, reconfortante y de cuchara')
      }
    }

    // Palabras clave de proteína
    if (norm.includes('proteina') || norm.includes('fitness') || norm.includes('musculo') || norm.includes('pollo')) {
      const prot = info?.nutrition.perServing.protein ?? 0
      if (prot >= 20) {
        score += 8
        reasons.push(`aporta una cantidad destacada de proteína (${prot.toFixed(1)} g calculadas por ración)`)
      }
    }

    // Palabras clave de legumbres / garbanzos
    if (norm.includes('garbanzo') || norm.includes('legumbre') || norm.includes('espinaca') || norm.includes('verdura')) {
      const hasLegumes = recipe.tags.includes('legumbres') || recipe.ingredients.some((i) => i.name.toLowerCase().includes('garbanzo'))
      if (hasLegumes) {
        score += 9
        reasons.push('está elaborado a base de legumbres y verduras frescas')
      }
    }

    // Palabras clave de rápido / tiempo
    if (norm.includes('rapido') || norm.includes('rapida') || norm.includes('tiempo') || norm.includes('prisa') || norm.includes('minuto')) {
      if (recipe.time_min && recipe.time_min <= 20) {
        score += 7
        reasons.push(`se prepara en solo ${recipe.time_min} minutos`)
      }
    }

    // Palabras clave de barato / económico
    if (norm.includes('barato') || norm.includes('economico') || norm.includes('precio') || norm.includes('ahorro')) {
      if (info && info.cost.perServing !== null && info.cost.perServing < 2.5) {
        score += 5
        reasons.push(`sale a solo ${formatEuro(info.cost.perServing)} por ración calculada`)
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestRecipe = recipe
      matchReason = reasons.length > 0 ? reasons.join(', ') : 'encaja con tus preferencias actuales y los ingredientes disponibles de Mercadona'
    }
  }

  const recipeInfo = catalog.info.get(bestRecipe.id)
  const proteinText =
    recipeInfo?.nutrition.perServing.protein !== null && recipeInfo?.nutrition.perServing.protein !== undefined
      ? `${recipeInfo.nutrition.perServing.protein.toFixed(1)} g de proteína calculada`
      : 'alto valor nutricional'
  const costText =
    recipeInfo?.cost.perServing !== null && recipeInfo?.cost.perServing !== undefined
      ? `${formatEuro(recipeInfo.cost.perServing)}/ración`
      : 'precio siempre bajo'

  const reply = `¡Te recomiendo directamente **${bestRecipe.name}**! Es una opción deliciosa con ingredientes 100% de Mercadona.`
  const reason = `Te lo sugiero porque ${matchReason}. Además aporta ${proteinText}, sale a ${costText} y está listo en ${bestRecipe.time_min ?? 'pocos'} minutos.`

  return {
    recipeId: bestRecipe.id,
    reply,
    reason,
    source: 'local',
  }
}

/**
 * Función principal para interactuar con el Chef IA:
 * 1. Intenta consultar el backend seguro /api/chat (que usa GEMINI_API_KEY del servidor).
 * 2. Si el servidor no tiene clave o falla, usa el motor local fallback.
 */
export async function askGeminiChef(params: ChatContextParams): Promise<RecommendationResult> {
  const customKey = getStoredGeminiApiKey()

  try {
    const catalogContext = buildCatalogContext(params.catalog, params.visibility, params.household)
    const userMessage = `Petición del usuario: "${params.userPrompt}"\n\nCatálogo de recetas oficiales de SíChef:\n${catalogContext}`

    const { text } = await callChatBackend(
      SYSTEM_INSTRUCTION,
      userMessage,
      params.history ?? [],
      customKey,
    )

    // Extraer y limpiar JSON de la respuesta
    let parsed: { recipeId?: string | null; reply?: string; reason?: string }
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      const cleanJson = jsonMatch ? jsonMatch[0] : text
      parsed = JSON.parse(cleanJson)
    } catch {
      parsed = {
        recipeId: null,
        reply: text,
        reason: 'Recomendación basada en tus preferencias y el catálogo de SíChef.',
      }
    }

    // Validar si el recipeId existe en el catálogo
    let validRecipeId: string | null = null
    if (parsed.recipeId && typeof parsed.recipeId === 'string') {
      const found = params.catalog.recipes.find((r) => r.id === parsed.recipeId)
      if (found) {
        validRecipeId = found.id
      }
    }

    return {
      recipeId: validRecipeId,
      reply: parsed.reply || 'Aquí tienes mi recomendación de SíChef.',
      reason: parsed.reason || 'Basado en los ingredientes y valores nutricionales de nuestro catálogo.',
      source: 'gemini',
    }
  } catch (err) {
    console.warn('Llamada a backend de Gemini no disponible, usando motor local:', err)
    // En caso de que el backend no tenga GEMINI_API_KEY o falle la red, fallback a motor local
    const local = localChefFallback(params)
    return {
      ...local,
      reply: `${local.reply}`,
    }
  }
}
