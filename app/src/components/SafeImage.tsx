import { ChefHat, Package } from 'lucide-react'
import { useState } from 'react'
import { assetUrl } from '../lib/format.ts'

interface Props {
  src: string | null | undefined
  alt: string
  className?: string
  /** Icono si la imagen falta o no carga. */
  kind?: 'plato' | 'producto'
}

/** <img> que nunca se rompe: si falla, enseña un hueco neutro (sin inventar otra foto). */
export function SafeImage({ src, alt, className = '', kind = 'plato' }: Props) {
  const url = assetUrl(src)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  if (!url || failedUrl === url) {
    const Icon = kind === 'plato' ? ChefHat : Package
    return (
      <div
        role="img"
        aria-label={alt ? `${alt} (imagen no disponible)` : 'Imagen no disponible'}
        className={`grid place-items-center bg-brand-soft text-brand/50 ${className}`}
      >
        <Icon className="size-1/3 max-h-12 max-w-12" aria-hidden />
      </div>
    )
  }
  return (
    <img
      src={url}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      draggable={false}
      referrerPolicy="no-referrer"
      onError={() => setFailedUrl(url)}
    />
  )
}
