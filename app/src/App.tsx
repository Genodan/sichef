import { LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { BottomNav } from './components/BottomNav.tsx'
import { Logo } from './components/Logo.tsx'
import { PhoneFrame } from './components/PhoneFrame.tsx'
import { RecipeSheet } from './components/RecipeSheet.tsx'
import { Toast, type ToastData } from './components/ui.tsx'
import { useAppState } from './lib/appState.ts'
import { CatalogContext, useCatalogLoader } from './lib/data.ts'
import { AppStateProvider } from './lib/state.tsx'
import { tabFromHash, UiContext, type TabId, type ToastAction, type UiApi } from './lib/ui.ts'
import { Basket } from './screens/Basket.tsx'
import { Chatbot } from './screens/Chatbot.tsx'
import { Cookbook } from './screens/Cookbook.tsx'
import { Discover } from './screens/Discover.tsx'
import { Profile } from './screens/Profile.tsx'
import { Search } from './screens/Search.tsx'

const TOAST_MS = 3500

function Shell() {
  const { state } = useAppState()
  const [tab, setTab] = useState<TabId>(() => tabFromHash(window.location.hash))
  const [recipeId, setRecipeId] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastData | null>(null)

  useEffect(() => {
    const onHash = () => setTab(tabFromHash(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), TOAST_MS)
    return () => clearTimeout(t)
  }, [toast])

  const goTo = useCallback((next: TabId) => {
    setRecipeId(null)
    setTab(next)
    if (window.location.hash !== `#/${next}`) window.location.hash = `/${next}`
  }, [])
  const notify = useCallback((message: string, action?: ToastAction) => setToast({ id: Date.now(), message, action }), [])
  const closeRecipe = useCallback(() => setRecipeId(null), [])

  const ui = useMemo<UiApi>(() => ({ tab, goTo, openRecipe: setRecipeId, notify }), [tab, goTo, notify])

  const basketCount = useMemo(
    () => Object.values(state.pantry).filter((s) => s === 'basket').length,
    [state.pantry],
  )

  return (
    <UiContext value={ui}>
      <main className="relative min-h-0 flex-1 overflow-hidden">
        {tab === 'descubre' && <Discover />}
        {tab === 'buscar' && <Search />}
        {tab === 'recetario' && <Cookbook />}
        {tab === 'cesta' && <Basket />}
        {tab === 'perfil' && <Profile />}
        {tab === 'chat' && <Chatbot />}
      </main>
      <BottomNav tab={tab} onChange={goTo} basketCount={basketCount} />
      <RecipeSheet recipeId={recipeId} onClose={closeRecipe} />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </UiContext>
  )
}

function Splash({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-brand px-8 text-center text-white">
      <Logo className="text-[52px]" />
      {children}
    </div>
  )
}

export default function App() {
  const { state, retry } = useCatalogLoader()

  return (
    <PhoneFrame>
      {state.status === 'loading' && (
        <Splash>
          <p className="flex items-center gap-2 font-bold text-white/90" role="status">
            <LoaderCircle className="size-5 animate-spin" aria-hidden /> Cargando recetas y productos…
          </p>
        </Splash>
      )}
      {state.status === 'error' && (
        <Splash>
          <div className="w-full rounded-3xl bg-white p-5 text-ink shadow-card" role="alert">
            <TriangleAlert className="mx-auto mb-2 size-8 text-accent" aria-hidden />
            <p className="text-lg font-extrabold">No se han podido cargar los datos</p>
            <p className="mt-1 text-sm font-semibold text-muted">{state.message}</p>
            {state.detail && <p className="mt-1 break-words text-xs text-muted">{state.detail}</p>}
            <button
              type="button"
              onClick={retry}
              className="mt-4 inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 font-extrabold text-white shadow-button"
            >
              <RefreshCw className="size-4" aria-hidden /> Reintentar
            </button>
          </div>
        </Splash>
      )}
      {state.status === 'ready' && (
        <CatalogContext value={state.catalog}>
          <AppStateProvider>
            <Shell />
          </AppStateProvider>
        </CatalogContext>
      )}
    </PhoneFrame>
  )
}
