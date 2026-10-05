export function Logo({ className = 'text-[32px]' }: { className?: string }) {
  return (
    <span className={`font-black leading-none tracking-tight ${className}`} aria-label="SíChef">
      <span className="text-white">Sí</span>
      <span className="text-sun">Chef</span>
    </span>
  )
}
