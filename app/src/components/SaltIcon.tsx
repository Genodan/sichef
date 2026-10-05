import type { SVGProps } from 'react'

/** Salero con el mismo trazo que los iconos de lucide (lucide no trae uno). */
export function SaltIcon({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number | string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M7.5 10h9l-1 10.2a1 1 0 0 1-1 .8h-5a1 1 0 0 1-1-.8z" />
      <path d="M7.5 10a4.5 4.5 0 0 1 9 0" />
      <path d="M10.5 6.8h.01M13.5 6.8h.01M12 4.8h.01" />
    </svg>
  )
}
