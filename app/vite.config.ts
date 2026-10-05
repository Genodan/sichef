import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { execSync } from 'node:child_process'
import path from 'node:path'

const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
]

function watchDataPlugin(): Plugin {
  return {
    name: 'watch-data-folder',
    configureServer(server) {
      const dataDir = path.resolve(import.meta.dirname, '../data')
      const recipesFile = path.resolve(dataDir, 'recipes.json')
      const productsFile = path.resolve(dataDir, 'products.json')

      server.watcher.add(recipesFile)
      server.watcher.add(productsFile)

      server.watcher.on('change', (file) => {
        if (file === recipesFile || file === productsFile) {
          console.log('[SíChef] Archivo de datos modificado en data/, sincronizando con app/public/data...')
          try {
            execSync('python3 ../data/scripts/ingest_datos_branch.py', { cwd: import.meta.dirname, stdio: 'inherit' })
          } catch (e) {
            console.error('[SíChef] Error sincronizando datos:', e)
          }
        }
      })
    },
  }
}

function chatApiPlugin(apiKey: string): Plugin {
  return {
    name: 'chat-api-dev',
    configureServer(server) {
      const handleApiRequest = (req: any, res: any) => {
        if (req.method === 'GET') {
          const clientHeaderKey = req.headers['x-gemini-api-key']
          const activeKey =
            (typeof clientHeaderKey === 'string' && clientHeaderKey.trim()) || apiKey
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ status: 'ok', configured: Boolean(activeKey), hasKey: Boolean(activeKey) }))
          return
        }

        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        const clientHeaderKey = req.headers['x-gemini-api-key']
        const activeKey =
          (typeof clientHeaderKey === 'string' && clientHeaderKey.trim()) || apiKey

        if (!activeKey) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              error: 'GEMINI_API_KEY no está configurada en el servidor local ni en las variables de entorno.',
            }),
          )
          return
        }

        let bodyStr = ''
        req.on('data', (chunk: any) => {
          bodyStr += chunk
        })
        req.on('end', async () => {
          try {
            const body = JSON.parse(bodyStr)
            let lastError: Error | null = null

            for (const model of GEMINI_MODELS) {
              const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + activeKey
              const geminiRes = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              })

              if (geminiRes.status === 404 || geminiRes.status === 429 || geminiRes.status === 503) {
                lastError = new Error('Modelo ' + model + ' no disponible (' + geminiRes.status + ')')
                continue
              }

              const data = await geminiRes.text()
              res.statusCode = geminiRes.status
              res.setHeader('Content-Type', 'application/json')
              res.end(data)
              return
            }

            res.statusCode = 502
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                error: lastError?.message || 'Error al procesar la respuesta del asistente',
              }),
            )
          } catch (err) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: String(err) }))
          }
        })
      }

      server.middlewares.use('/api/chat', handleApiRequest)
      server.middlewares.use('/api/gemini', handleApiRequest)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Carga todas las variables de entorno sin requerir prefijo VITE_ (GEMINI_API_KEY protegida en servidor)
  const env = loadEnv(mode, process.cwd(), '')
  const apiKey = (
    env.GEMINI_API_KEY ||
    env.GOOGLE_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ''
  ).trim()

  return {
    plugins: [react(), tailwindcss(), watchDataPlugin(), chatApiPlugin(apiKey)],
  }
})
