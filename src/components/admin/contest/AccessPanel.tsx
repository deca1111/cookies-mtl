'use client'

import { useEffect, useRef, useState } from 'react'
import { IconCopy, IconDownload, IconShare } from '@/components/icons'

// Bloc « Accès invités » (spec PR 2 §4). L'aperçu EST le PNG exporté : ce que
// l'organisateur voit est exactement ce qu'il imprime ou partage.
export function AccessPanel({ contestId, secret }: { contestId: number; secret: string }) {
  const [url, setUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [imgError, setImgError] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const png = (format: 'carte' | 'qr', download = false) => `/api/admin/concours/${contestId}/qr?format=${format}${download ? '&download=1' : ''}`

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(`${window.location.origin}/concours/${secret}`)
  }, [secret])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      // Presse-papier indisponible : l'URL reste lisible et sélectionnable.
    }
  }

  // Partage natif du fichier (téléphone, macOS) ; sinon on télécharge la carte.
  // Une annulation par l'utilisateur (AbortError) n'est pas une erreur.
  const share = async () => {
    try {
      const blob = await (await fetch(png('carte'))).blob()
      const file = new File([blob], 'concours-carte.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] })
        return
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
    }
    window.location.assign(png('carte', true))
  }

  const btn = 'flex items-center gap-1.5 rounded-[var(--radius-field)] border border-[color:var(--border-strong)] px-2.5 py-1.5 text-[12px] text-[color:var(--text-body)] hover:bg-[color:var(--surface-2)]'

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-[color:var(--surface)] p-3">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">Accès invités</h3>
      <div className="flex items-start gap-3">
        {imgError ? (
          <p className="flex-1 text-[13px] text-[color:var(--danger)]">QR code indisponible — utilise le lien ci-dessous.</p>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- PNG dynamique protégé par session, pas d'optimisation voulue
          <img src={png('carte')} alt="QR code du concours" onError={() => setImgError(true)} className="w-[140px] rounded-[var(--radius-field)]" />
        )}
        <div className="flex flex-col gap-2">
          <a href={png('carte', true)} className={btn}><IconDownload size={14} />PNG carte</a>
          <a href={png('qr', true)} className={btn}><IconDownload size={14} />PNG QR seul</a>
          <button type="button" onClick={share} className={btn}><IconShare size={14} />Partager</button>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-[var(--radius-field)] bg-[color:var(--surface-2)] px-2 py-1.5">
        <code className="flex-1 truncate text-[12px] text-[color:var(--text-muted)]">{url}</code>
        {copied && <span className="text-[12px] text-[color:var(--accent-ink)]">Copié</span>}
        <button type="button" aria-label="Copier le lien" onClick={copy} className="text-[color:var(--accent-ink)]"><IconCopy size={14} /></button>
      </div>
    </div>
  )
}
