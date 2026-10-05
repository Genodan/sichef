// Formato de cifras y textos de la interfaz (español de España).

import type { StoreLocation } from '../types.ts'

/** Texto obligatorio cuando falta un dato (regla dura 2 de AGENTS.md). */
export const NA = 'dato no disponible'

const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })
const dateFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

export function formatEuro(n: number | null | undefined): string {
  return typeof n === 'number' && Number.isFinite(n) ? euro.format(n) : NA
}

export function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: decimals })
}

/** «452 kcal», «18,3 g»; null → «dato no disponible». */
export function formatNutrient(key: string, n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return NA
  if (key === 'kcal') return `${formatNumber(n, 0)} kcal`
  if (key === 'salt') return `${formatNumber(n, 2)} g`
  return `${formatNumber(n, n < 10 ? 1 : 0)} g`
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return NA
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? NA : dateFmt.format(d)
}

export function formatMinutes(min: number | null | undefined): string {
  if (typeof min !== 'number' || !Number.isFinite(min)) return NA
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

export function formatLocation(loc: StoreLocation | null | undefined, aisleName?: string | null): string {
  if (!loc) return `Ubicación: ${NA}`
  const side = loc.side === 'izq' ? 'izquierda' : loc.side === 'der' ? 'derecha' : null
  return [
    `Pasillo ${loc.aisle}`,
    aisleName || null,
    side,
    loc.shelf ? `balda ${loc.shelf}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Rutas locales («/img/…») respetan el base de Vite; las URL absolutas se dejan igual. */
export function assetUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:')) return path
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
}
