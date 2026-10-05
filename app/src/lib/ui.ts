// Navegación y avisos de la interfaz (no es estado persistente del usuario).

import { createContext, useContext } from 'react'

export type TabId = 'descubre' | 'buscar' | 'recetario' | 'cesta' | 'perfil'

export const TAB_IDS: readonly TabId[] = ['descubre', 'buscar', 'recetario', 'cesta', 'perfil']

export interface ToastAction {
  label: string
  run: () => void
}

export interface UiApi {
  tab: TabId
  goTo: (tab: TabId) => void
  openRecipe: (id: string) => void
  notify: (message: string, action?: ToastAction) => void
}

export const UiContext = createContext<UiApi | null>(null)

export function useUi(): UiApi {
  const ctx = useContext(UiContext)
  if (!ctx) throw new Error('useUi() fuera de <UiContext>')
  return ctx
}

export function tabFromHash(hash: string): TabId {
  const id = hash.replace(/^#\/?/, '') as TabId
  return TAB_IDS.includes(id) ? id : 'descubre'
}
