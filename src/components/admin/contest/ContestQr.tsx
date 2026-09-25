'use client'

import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

// Généré dans le navigateur à partir de l'origine courante : le QR pointe vers
// le domaine réellement servi (prod, preview ou localhost), sans configuration.
// Habillage aux couleurs du thème : PR 2.
export function ContestQr({ secret }: { secret: string }) {
  const [url, setUrl] = useState('')
  const [svg, setSvg] = useState('')

  useEffect(() => {
    const u = `${window.location.origin}/concours/${secret}`
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(u)
    void QRCode.toString(u, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }).then(setSvg)
  }, [secret])

  return (
    <div className="flex flex-col gap-2">
      <div className="w-full max-w-[220px] rounded-[var(--radius-card)] bg-white p-2" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate text-[12px] text-[color:var(--text-muted)]">{url}</code>
        <button type="button" onClick={() => navigator.clipboard.writeText(url)} className="text-[12px] text-[color:var(--accent-ink)]">Copier</button>
      </div>
    </div>
  )
}
