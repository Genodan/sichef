// Función de Vercel: puente seguro entre la app y Google Gemini.
// La clave vive SOLO en el servidor (variable de entorno GEMINI_API_KEY en Vercel)
// y nunca llega al navegador.
//   GET  /api/gemini → { configured: boolean }
//   POST /api/gemini { systemPrompt, userMessage, history } → { text, model }

const API = 'https://generativelanguage.googleapis.com/v1beta'
const FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-2.5-flash']
const MAX_CHARS = 120_000

function apiKey(): string {
  return (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim()
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

let cachedModels: string[] | null = null

/** Modelos «flash» de texto disponibles para esta clave (los nombres antiguos dan 404). */
async function usableModels(key: string): Promise<string[]> {
  if (cachedModels) return cachedModels
  try {
    const res = await fetch(`${API}/models?pageSize=200&key=${key}`)
    if (!res.ok) throw new Error(String(res.status))
    const data = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] }
    const names = (data.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''))
      .filter((n) => n.startsWith('gemini') && !/(image|tts|audio|live|embedding|vision|thinking-exp)/.test(n))
    const score = (n: string) => {
      const v = Number(n.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? 0)
      return v * 10 + (n.includes('flash') ? 3 : 0) - (n.includes('lite') ? 1 : 0) - (/preview|exp/.test(n) ? 2 : 0)
    }
    const best = [...new Set(names)].sort((a, b) => score(b) - score(a)).slice(0, 6)
    cachedModels = [...best, ...FALLBACK_MODELS.filter((m) => !best.includes(m))]
  } catch {
    cachedModels = FALLBACK_MODELS
  }
  return cachedModels
}

export function GET() {
  return json({ configured: apiKey() !== '' })
}

export async function POST(request: Request) {
  const key = apiKey()
  if (!key) return json({ error: 'GEMINI_API_KEY no está configurada en el servidor' }, 503)

  let body: { systemPrompt?: unknown; userMessage?: unknown; history?: unknown }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'JSON no válido' }, 400)
  }
  const systemPrompt = typeof body.systemPrompt === 'string' ? body.systemPrompt : ''
  const userMessage = typeof body.userMessage === 'string' ? body.userMessage : ''
  const history = Array.isArray(body.history) ? body.history.slice(-4) : []
  if (!userMessage || systemPrompt.length + userMessage.length > MAX_CHARS) {
    return json({ error: 'Petición vacía o demasiado larga' }, 400)
  }

  const contents = [
    ...history
      .filter((h): h is { role: string; text: string } => typeof h?.text === 'string')
      .map((h) => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.text.slice(0, 4000) }] })),
    { role: 'user', parts: [{ text: userMessage }] },
  ]

  let lastError = 'No se pudo conectar con Google Gemini'
  for (const model of await usableModels(key)) {
    const res = await fetch(`${API}/models/${model}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
    })
    // 404 = modelo retirado; 429/500/503 = cuota o saturación → probar el siguiente modelo
    if ([404, 429, 500, 503].includes(res.status)) {
      lastError = `Modelo ${model} no disponible (${res.status})`
      continue
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return json({ error: `Error de Google Gemini (${res.status})`, detail: detail.slice(0, 500) }, 502)
    }
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return json({ error: 'Respuesta vacía de Google Gemini' }, 502)
    return json({ text, model })
  }
  return json({ error: lastError }, 502)
}
