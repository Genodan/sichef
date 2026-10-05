// api/chat.ts
// Función serverless para Vercel (Edge Runtime).
// Mantiene GEMINI_API_KEY en el servidor, completamente protegida sin exponerla a los clientes.

export const config = {
  runtime: 'edge',
}

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']

function getApiKey(req: Request): string | null {
  const clientHeaderKey = req.headers.get('x-gemini-api-key')
  if (clientHeaderKey && clientHeaderKey.trim()) return clientHeaderKey.trim()

  const serverKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  if (serverKey && serverKey.trim()) return serverKey.trim()

  return null
}

export default async function handler(req: Request): Promise<Response> {
  // Comprobación de estado (GET /api/chat): permite a la app saber si hay clave configurada
  if (req.method === 'GET') {
    const apiKey = getApiKey(req)
    return new Response(
      JSON.stringify({
        status: 'ok',
        hasKey: Boolean(apiKey),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const apiKey = getApiKey(req)
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: 'GEMINI_API_KEY no está configurada en las variables de entorno del servidor.',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  try {
    const body = await req.json()
    let lastError: Error | null = null

    for (const model of GEMINI_MODELS) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.status === 404) {
        lastError = new Error(`Modelo ${model} no disponible (404)`)
        continue
      }

      const data = await res.text()
      return new Response(data, {
        status: res.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        error: lastError?.message || 'Error al conectar con los modelos de Google Gemini',
      }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
