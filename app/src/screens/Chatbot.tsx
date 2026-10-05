import {
  BookHeart,
  Bot,
  Check,
  ChevronRight,
  Flame,
  ListChecks,
  LoaderCircle,
  RotateCcw,
  Send,
  Settings,
  Sparkles,
  Timer,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { SafeImage } from '../components/SafeImage.tsx'
import { ScreenHeader } from '../components/ui.tsx'
import { useAppState } from '../lib/appState.ts'
import { useCatalog } from '../lib/data.ts'
import { formatEuro, formatNutrient } from '../lib/format.ts'
import {
  askGeminiChef,
  checkBackendGeminiStatus,
  clearGeminiApiKey,
  getStoredGeminiApiKey,
  saveGeminiApiKey,
} from '../lib/gemini.ts'
import { useHouseholdSuitability, useVisibility } from '../lib/hooks.ts'
import { useUi } from '../lib/ui.ts'

interface ChatItem {
  id: string
  role: 'user' | 'assistant'
  text: string
  recipeId?: string | null
  reason?: string
  source?: 'gemini' | 'local'
  modelUsed?: string
  timestamp: number
}

const QUICK_PROMPTS = [
  '🍲 Me apetece un plato caliente con arroz',
  '💪 Un plato con mucha proteína',
  '⏱️ Cena rápida en menos de 20 min',
  '🌱 Plato tradicional con legumbres',
  '💶 Algo económico y saludable',
]

let nextId = 0
function createId(prefix: string): string {
  nextId += 1
  return `${prefix}-${nextId}`
}

export function Chatbot() {
  const catalog = useCatalog()
  const { state, dispatch } = useAppState()
  const visibility = useVisibility()
  const household = useHouseholdSuitability()
  const ui = useUi()

  const [apiKey, setApiKey] = useState<string>(() => getStoredGeminiApiKey())
  const [backendReady, setBackendReady] = useState<boolean>(false)
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false)
  const [keyInput, setKeyInput] = useState<string>(apiKey)

  useEffect(() => {
    checkBackendGeminiStatus().then((hasKey) => {
      setBackendReady(hasKey)
    })
  }, [apiKey])

  const isAiActive = backendReady || Boolean(apiKey)

  const [messages, setMessages] = useState<ChatItem[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      text: '¡Hola! Soy tu **Chef IA** de SíChef 👨‍🍳✨\n\nPuedes pedirme en lenguaje natural lo que te apetezca hoy (por ejemplo: *«me apetece un plato caliente con arroz»* o *«un plato con mucha proteína»*). Te daré una recomendación directa con productos de Mercadona, te explicaré por qué y podrás añadirla a tu Recetario.',
      timestamp: 0,
      source: 'local',
    },
  ])

  const [input, setInput] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  const handleSend = useCallback(async (textToSend?: string) => {
    const query = (textToSend ?? input).trim()
    if (!query || loading) return

    const now = Date.now()
    const userMsg: ChatItem = {
      id: createId('user'),
      role: 'user',
      text: query,
      timestamp: now,
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const history = messages.map((m) => ({
        role: m.role,
        text: m.text,
      }))

      const result = await askGeminiChef({
        userPrompt: query,
        history,
        catalog,
        state,
        visibility,
        household,
      })

      const botMsg: ChatItem = {
        id: createId('bot'),
        role: 'assistant',
        text: result.reply,
        recipeId: result.recipeId,
        reason: result.reason,
        source: result.source,
        modelUsed: result.modelUsed,
        timestamp: Date.now(),
      }

      setMessages((prev) => [...prev, botMsg])
    } catch (err) {
      const errMsg: ChatItem = {
        id: createId('err'),
        role: 'assistant',
        text: `Lo siento, ha ocurrido un error al procesar tu petición: ${err instanceof Error ? err.message : 'Error desconocido'}.`,
        timestamp: Date.now(),
        source: 'local',
      }
      setMessages((prev) => [...prev, errMsg])
    } finally {
      setLoading(false)
    }
  }, [catalog, household, input, loading, messages, state, visibility])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    handleSend()
  }

  const handleSaveKeySubmit = (e: FormEvent) => {
    e.preventDefault()
    saveGeminiApiKey(keyInput)
    setApiKey(keyInput.trim())
    setShowKeyModal(false)
    ui.notify(keyInput.trim() ? 'Ajustes guardados' : 'Clave eliminada')
  }

  const handleClearKey = () => {
    clearGeminiApiKey()
    setApiKey('')
    setKeyInput('')
    setShowKeyModal(false)
    ui.notify('Clave eliminada')
  }

  return (
    <div className="flex h-full flex-col bg-canvas">
      {/* Cabecera con estado del Chef IA */}
      <ScreenHeader
        title="Chef IA"
        subtitle="Tu asistente de recetas con productos reales de Mercadona"
      >
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/20 pt-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white/90">
            <span
              className={`size-2 rounded-full ${isAiActive ? 'bg-emerald-300 animate-pulse' : 'bg-emerald-300/80'}`}
              aria-hidden
            />
            <span>{isAiActive ? 'En línea' : 'Disponible'}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setKeyInput(apiKey)
              setShowKeyModal(true)
            }}
            className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-black text-white hover:bg-white/30 transition-colors"
          >
            <Settings className="size-3.5" aria-hidden />
            <span>Ajustes</span>
          </button>
        </div>
      </ScreenHeader>

      {/* Lista de mensajes */}
      <div className="no-scrollbar flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === 'user'

          if (isUser) {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-3xl rounded-br-md bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-soft">
                  {msg.text}
                </div>
              </div>
            )
          }

          // Mensaje del Asistente
          const recipe = msg.recipeId ? catalog.recipes.find((r) => r.id === msg.recipeId) : null
          const info = msg.recipeId ? catalog.info.get(msg.recipeId) : null
          const isLiked = msg.recipeId ? state.likes.includes(msg.recipeId) : false
          const suitability = msg.recipeId ? household.get(msg.recipeId) : undefined

          return (
            <div key={msg.id} className="flex flex-col items-start gap-1 max-w-[95%]">
              {/* Etiqueta de procedencia */}
              <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-muted pl-1">
                <Bot className="size-3.5 text-brand" aria-hidden />
                <span>Chef IA</span>
              </div>

              {/* Burbuja de texto */}
              <div className="rounded-3xl rounded-tl-md bg-white p-4 text-sm font-medium text-ink shadow-soft border border-line space-y-3">
                <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>

                {/* Tarjeta interactiva de recomendación de receta */}
                {recipe && info && (
                  <div className="overflow-hidden rounded-2xl border border-line bg-canvas p-3 shadow-sm space-y-3">
                    <div className="flex items-center gap-3">
                      <SafeImage
                        src={recipe.image?.url}
                        alt=""
                        className="size-16 shrink-0 rounded-xl object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-extrabold leading-tight text-ink">
                          {recipe.name}
                        </p>
                        {recipe.subtitle && (
                          <p className="truncate text-xs font-semibold text-muted">{recipe.subtitle}</p>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-extrabold">
                          {info.cost.perServing !== null && (
                            <span className="rounded-full bg-cream px-2 py-0.5 text-accent-dark">
                              {formatEuro(info.cost.perServing)}/ración
                            </span>
                          )}
                          {recipe.time_min !== null && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-muted shadow-2xs">
                              <Timer className="size-3" aria-hidden />
                              {recipe.time_min} min
                            </span>
                          )}
                          {info.nutrition.perServing.protein !== null && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-brand-dark shadow-2xs">
                              <Flame className="size-3 text-brand" aria-hidden />
                              {formatNutrient('protein', info.nutrition.perServing.protein)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Estado de alérgenos en el hogar */}
                    {suitability && suitability.members.length > 0 && (
                      <div className="rounded-xl bg-white/70 px-2.5 py-1 text-[11px] font-bold">
                        {suitability.allCanEat ? (
                          <span className="text-brand-dark">✅ Apto para todo tu hogar</span>
                        ) : suitability.noneCanEat ? (
                          <span className="text-pass">❌ No apto por alérgenos del hogar</span>
                        ) : (
                          <span className="text-muted">
                            ✅ Apto para: {suitability.canEat.map((m) => m.memberName).join(', ')}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Explicación de por qué se recomienda */}
                    {msg.reason && (
                      <div className="rounded-xl border border-amber-200/80 bg-cream/80 p-2.5 text-xs font-semibold text-ink/90">
                        <div className="flex items-center gap-1 font-black text-accent-dark mb-0.5">
                          <Sparkles className="size-3.5 shrink-0" aria-hidden />
                          <span>¿Por qué te la recomiendo?</span>
                        </div>
                        <p className="leading-relaxed">{msg.reason}</p>
                      </div>
                    )}

                    {/* Botones de acción: Añadir al recetario y Ver receta */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {isLiked ? (
                        <button
                          type="button"
                          onClick={() => ui.goTo('recetario')}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-soft py-2 px-3 text-xs font-black text-brand-dark hover:bg-brand hover:text-white transition-colors"
                        >
                          <Check className="size-4 shrink-0" strokeWidth={3} aria-hidden />
                          <span>En tu Recetario (Ver)</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            dispatch({ type: 'like', id: recipe.id })
                            ui.notify(`¡${recipe.name} añadida a tu Recetario!`, {
                              label: 'Ver Recetario',
                              run: () => ui.goTo('recetario'),
                            })
                          }}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent py-2 px-3 text-xs font-black text-white shadow-button hover:bg-accent-dark active:scale-95 transition-all"
                        >
                          <BookHeart className="size-4 shrink-0" aria-hidden />
                          <span>Añadir al Recetario</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => ui.openRecipe(recipe.id)}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-white border border-line py-2 px-3 text-xs font-black text-ink hover:bg-panel transition-colors"
                      >
                        <ListChecks className="size-4 shrink-0 text-accent-dark" aria-hidden />
                        <span>Ver receta</span>
                        <ChevronRight className="size-3.5 text-muted" aria-hidden />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Indicador de carga */}
        {loading && (
          <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-xs font-bold text-muted shadow-soft border border-line max-w-[85%]">
            <LoaderCircle className="size-4 animate-spin text-accent" aria-hidden />
            <span>Chef IA pensando tu recomendación…</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Sugerencias rápidas */}
      <div className="shrink-0 bg-white border-t border-line px-3 pt-2 pb-1.5">
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted mb-1 px-1">
          Sugerencias rápidas:
        </p>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
          {QUICK_PROMPTS.map((promptText) => (
            <button
              key={promptText}
              type="button"
              onClick={() => handleSend(promptText.replace(/^[\p{Emoji}\s]+/u, ''))}
              className="shrink-0 rounded-full bg-panel px-3 py-1 text-xs font-bold text-ink hover:bg-brand-soft hover:text-brand-dark transition-colors"
            >
              {promptText}
            </button>
          ))}
        </div>
      </div>

      {/* Formulario de entrada */}
      <div className="shrink-0 bg-white border-t border-line px-3 py-2.5">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pídeme algo (ej. plato caliente con arroz)..."
            disabled={loading}
            className="flex-1 rounded-full bg-canvas px-4 py-2.5 text-sm font-semibold text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Enviar petición"
            className="grid size-10 place-items-center rounded-full bg-brand text-white shadow-button hover:bg-brand-dark disabled:opacity-40 disabled:hover:bg-brand transition-all"
          >
            <Send className="size-4" aria-hidden />
          </button>
        </form>
      </div>

      {/* Modal de configuración del Asistente */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-phone space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid size-9 place-items-center rounded-full bg-brand-soft text-brand">
                  <Settings className="size-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-ink">Ajustes del Asistente</h2>
                  <p className="text-xs font-semibold text-muted">Estado y conexión</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="grid size-8 place-items-center rounded-full bg-panel text-muted hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              En producción y en local, la conexión se gestiona de forma segura a través del servidor
              mediante variables de entorno, protegiendo el servicio sin exponer claves en el navegador.
            </p>

            {backendReady && (
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50 p-2.5 text-xs font-bold text-brand-dark">
                ✅ Servidor conectado y activo. El chatbot está listo para recomendar recetas.
              </div>
            )}

            <form onSubmit={handleSaveKeySubmit} className="space-y-3">
              <div>
                <label htmlFor="assistant-key" className="block text-xs font-extrabold text-ink mb-1">
                  Clave opcional de pruebas
                </label>
                <input
                  id="assistant-key"
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="Introduce clave de pruebas..."
                  className="w-full rounded-xl border border-line bg-canvas px-3 py-2 text-sm font-medium focus:border-brand focus:outline-none"
                />
              </div>

              <div className="rounded-xl bg-canvas p-2.5 text-[11px] text-muted space-y-1">
                <p>🔒 La clave se almacena exclusivamente de forma local en tu navegador.</p>
              </div>

              <div className="flex gap-2 pt-1">
                {apiKey && (
                  <button
                    type="button"
                    onClick={handleClearKey}
                    className="flex items-center justify-center gap-1 rounded-xl bg-pass-soft px-3 py-2 text-xs font-extrabold text-pass hover:bg-pass hover:text-white transition-colors"
                  >
                    <RotateCcw className="size-3.5" /> Borrar
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-brand py-2 text-xs font-black text-white shadow-button hover:bg-brand-dark transition-colors"
                >
                  Guardar clave
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
