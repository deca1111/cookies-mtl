// Nom du PNG téléchargé : « concours-anniv-leo-carte.png ». Accents retirés,
// tout le reste réduit à des tirets.
export function qrFileName(contestName: string, format: 'carte' | 'qr'): string {
  const slug = contestName.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `concours-${slug ? `${slug}-` : ''}${format}.png`
}
