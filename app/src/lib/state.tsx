// Proveedor del estado del usuario, persistido en localStorage.
// Tipos, reducer y hook `useAppState` en appState.ts.

import { useEffect, useMemo, useReducer, type ReactNode } from 'react'
import { AppStateContext, loadState, reducer, saveState } from './appState.ts'

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  useEffect(() => {
    saveState(state)
  }, [state])

  const value = useMemo(() => ({ state, dispatch }), [state])
  return <AppStateContext value={value}>{children}</AppStateContext>
}
