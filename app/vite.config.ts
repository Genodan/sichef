import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import { execSync } from 'node:child_process'
import path from 'node:path'

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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), watchDataPlugin()],
})
