import { IconExternal } from '@/components/icons'

export function AdminHeader() {
  return (
    <div className="flex items-center gap-3">
      <h1 className="font-display text-[24px] leading-none text-[color:var(--text-strong)]">Admin</h1>
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-strong)] px-3.5 py-2 text-[13px] text-[color:var(--text-body)] transition-colors hover:bg-[color:var(--surface-2)]"
      >
        <IconExternal size={14} />
        Voir la carte
      </a>
    </div>
  )
}
