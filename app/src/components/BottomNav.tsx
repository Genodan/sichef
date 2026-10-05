import { BookHeart, House, Search, ShoppingBasket, Sparkles, User, type LucideIcon } from 'lucide-react'
import type { TabId } from '../lib/ui.ts'

const TABS: { id: TabId; label: string; Icon: LucideIcon }[] = [
  { id: 'descubre', label: 'Descubre', Icon: House },
  { id: 'buscar', label: 'Buscar', Icon: Search },
  { id: 'recetario', label: 'Recetario', Icon: BookHeart },
  { id: 'cesta', label: 'Cesta', Icon: ShoppingBasket },
  { id: 'perfil', label: 'Perfil', Icon: User },
  { id: 'chat', label: 'Chef IA', Icon: Sparkles },
]

interface Props {
  tab: TabId
  onChange: (tab: TabId) => void
  basketCount: number
}

export function BottomNav({ tab, onChange, basketCount }: Props) {
  return (
    <nav aria-label="Navegación principal" className="relative z-30 shrink-0 border-t border-line bg-white pb-[var(--bottom-inset)]">
      <ul className="grid grid-cols-6">
        {TABS.map(({ id, label, Icon }) => {
          const active = id === tab
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onChange(id)}
                aria-current={active ? 'page' : undefined}
                aria-label={id === 'cesta' && basketCount > 0 ? `${label} (${basketCount} ${basketCount === 1 ? 'producto' : 'productos'})` : label}
                className={`relative flex w-full flex-col items-center gap-0.5 px-0.5 pb-2 pt-2 text-[10px] sm:text-[11px] font-extrabold transition-colors ${
                  active ? 'text-brand' : 'text-muted hover:text-ink'
                }`}
              >
                {active && <span className="absolute inset-x-2 -top-px h-[3px] rounded-b-full bg-accent" aria-hidden />}
                <span className="relative">
                  <Icon className="size-6" strokeWidth={active ? 2.5 : 2} fill={active && id === 'descubre' ? 'currentColor' : 'none'} aria-hidden />
                  {id === 'cesta' && basketCount > 0 && (
                    <span
                      className="absolute -right-2.5 -top-1.5 grid min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-black leading-[18px] text-white ring-2 ring-white"
                      aria-hidden
                    >
                      {basketCount}
                    </span>
                  )}
                </span>
                <span aria-hidden>{label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
