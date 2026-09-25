'use client'

import QRCode from 'qrcode'
import { useEffect, useRef, useState } from 'react'

// Généré dans le navigateur à partir de l'origine courante : le QR pointe vers
// le domaine réellement servi (prod, preview ou localhost), sans configuration.
// Habillage aux couleurs du thème : PR 2.
export function ContestQr({ secret }: { secret: string }) {
  const [url, setUrl] = useState('')
  const [svg, setSvg] = useState('')
  const [qrError, setQrError] = useState(false)
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const u = `${window.location.origin}/concours/${secret}`
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(u)
    let cancelled = false
    QRCode.toString(u, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
      .then((s) => { if (!cancelled) setSvg(s) })
      .catch(() => { if (!cancelled) setQrError(true) })
    return () => {
      cancelled = true
    }
  }, [secret])

  // Nettoyage au démontage : évite un setState après coup si le panneau se
  // ferme pendant que le message « Copié » est encore affiché.
  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current)
  }, [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      // Presse-papier indisponible (permission refusée, contexte non sécurisé…) :
      // le lien reste affiché en clair, l'organisateur peut le sélectionner à la main.
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {qrError ? (
        <p className="text-[13px] text-[color:var(--danger)]">QR code indisponible — utilise le lien ci-dessous.</p>
      ) : (
        <div className="w-full max-w-[220px] rounded-[var(--radius-card)] bg-white p-2" dangerouslySetInnerHTML={{ __html: svg }} />
      )}
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate text-[12px] text-[color:var(--text-muted)]">{url}</code>
        <button type="button" onClick={copy} className="text-[12px] text-[color:var(--accent-ink)]">{copied ? 'Copié' : 'Copier'}</button>
      </div>
    </div>
  )
}
