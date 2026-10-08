// Test de charge du concours : de vrais navigateurs (Chrome sans fenêtre, un
// contexte isolé par invité, donc un cookie d'identité chacun) jouent le
// parcours d'un invité — ouvrir le lien, choisir son nom, classer des cookies
// au fil de l'eau — pendant que la page sonde l'état toutes les 2,5 s, comme
// un vrai téléphone. Montée par paliers (5 → 10 → 20 → 30 par défaut).
//
// Le concours de test est créé directement en base (aucun mot de passe admin),
// puis supprimé à la fin. Suivi en direct : scripts/stress/out/live.html
// (se recharge tout seul), et la page de pilotage du concours dans l'admin.
//
//   npx tsx scripts/stress/stress.mts                       # prod, 5,10,20,30
//   npx tsx scripts/stress/stress.mts --url http://localhost:3000 --stages 3,6 --stage-seconds 30
//   options : --keep (garder le concours), --headed (voir les fenêtres)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { chromium, type Browser, type Page } from 'playwright-core'

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback
}
const flag = (name: string) => process.argv.includes(`--${name}`)

const BASE = arg('url', 'https://cookies.zucchinistudio.com').replace(/\/$/, '')
const STAGES = arg('stages', '5,10,20,30').split(',').map(Number)
const STAGE_MS = Number(arg('stage-seconds', '60')) * 1000
const PLATES = Number(arg('plates', '20'))
const MAX = Math.max(...STAGES)
const OUT = 'scripts/stress/out'

const line = readFileSync('.env.local', 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL='))
if (!line) throw new Error('DATABASE_URL absent de .env.local')
process.env.DATABASE_URL = line.slice('DATABASE_URL='.length).trim().replace(/^"|"$/g, '')
const db = await import('../../src/lib/contest-db')
const { generateSecret } = await import('../../src/lib/contest-identity')

// ——— Mesures ———
type Kind = 'page' | 'poll' | 'action'
type Sample = { at: number; kind: Kind; ms: number; ok: boolean }
const samples: Sample[] = []
const failures: string[] = []
// Actions serveur que le navigateur coupe une fois leur réponse lue (net::ERR_ABORTED
// en prod) : l'invité passe bien à la suite et rien n'est perdu (vérifié en base à
// la fin). Comptées à part pour ne pas noyer les vraies erreurs.
let abortedAfterReply = 0
const started = Date.now()
let active = 0
let stageLabel = ''

// Où en est chaque invité virtuel : sert à dater une requête annulée.
const stepOf = new Map<string, string>()

function instrument(page: Page, who: string) {
  page.on('requestfinished', async (req) => {
    const url = req.url()
    const kind: Kind | null = req.resourceType() === 'document'
      ? 'page'
      : url.includes('/api/concours/') && url.endsWith('/etat')
        ? 'poll'
        : req.method() === 'POST' && (await req.allHeaders())['next-action']
          ? 'action'
          : null
    if (!kind) return
    const res = await req.response()
    const ok = !!res && res.status() < 400
    if (!ok) failures.push(`${who} ${kind} HTTP ${res?.status()} ${url}`)
    const ms = req.timing().responseEnd
    if (ms >= 0) samples.push({ at: Date.now(), kind, ms, ok })
  })
  page.on('requestfailed', async (req) => {
    if (!req.url().startsWith(BASE)) return
    const h = await req.allHeaders()
    if (h['next-action'] && req.failure()?.errorText === 'net::ERR_ABORTED') {
      abortedAfterReply++
      return
    }
    const what = h['next-action'] ? `action ${h['next-action'].slice(0, 8)}` : h['rsc'] ? 'rsc' : req.resourceType()
    failures.push(`${who} échec réseau ${req.failure()?.errorText} ${req.method()} ${what} (pendant : ${stepOf.get(who)})`)
  })
}

const pct = (xs: number[], p: number) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))])
}
function stats(from: number, to: number, kind: Kind) {
  const xs = samples.filter((s) => s.kind === kind && s.at >= from && s.at < to)
  return { n: xs.length, p50: pct(xs.map((s) => s.ms), 50), p95: pct(xs.map((s) => s.ms), 95), max: pct(xs.map((s) => s.ms), 100), err: xs.filter((s) => !s.ok).length }
}

// ——— Rapport en direct (HTML statique qui se recharge) ———
type Tick = { t: number; users: number; poll: ReturnType<typeof stats>; action: ReturnType<typeof stats> }
const ticks: Tick[] = []
const stageRows: { label: string; users: number; poll: ReturnType<typeof stats>; action: ReturnType<typeof stats>; page: ReturnType<typeof stats> }[] = []
mkdirSync(OUT, { recursive: true })

function chart() {
  const W = 760, H = 180, maxMs = Math.max(500, ...ticks.flatMap((k) => [k.poll.p95, k.action.p95]))
  const x = (i: number) => (ticks.length < 2 ? 0 : (i / (ticks.length - 1)) * W)
  const y = (ms: number) => H - (ms / maxMs) * H
  const path = (f: (k: Tick) => number) => ticks.map((k, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(f(k)).toFixed(1)}`).join('')
  const users = ticks.map((k, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${(H - (k.users / MAX) * H).toFixed(1)}`).join('')
  return `<svg viewBox="-40 -10 ${W + 50} ${H + 30}" width="100%">
    <text x="-36" y="4" class="ax">${maxMs} ms</text><text x="-36" y="${H}" class="ax">0</text>
    <line x1="0" y1="${H}" x2="${W}" y2="${H}" stroke="#5a4636"/>
    <path d="${users}" fill="none" stroke="#7f98e0" stroke-dasharray="4 4"/>
    <path d="${path((k) => k.poll.p95)}" fill="none" stroke="#9dbb86" stroke-width="2"/>
    <path d="${path((k) => k.action.p95)}" fill="none" stroke="#d29a55" stroke-width="2"/>
  </svg>`
}

function writeReport(done: boolean, verdict = '') {
  const row = (r: (typeof stageRows)[number]) => `<tr><td>${r.label}</td><td>${r.users}</td>
    <td>${r.page.n ? `${r.page.p50} / ${r.page.p95}` : '—'}</td><td>${r.poll.n}</td><td>${r.poll.p50} / ${r.poll.p95} / ${r.poll.max}</td>
    <td>${r.action.n}</td><td>${r.action.p50} / ${r.action.p95} / ${r.action.max}</td><td class="${r.poll.err + r.action.err ? 'bad' : ''}">${r.poll.err + r.action.err}</td></tr>`
  const last = ticks.at(-1)
  writeFileSync(`${OUT}/live.html`, `<!doctype html><html lang="fr"><head><meta charset="utf-8">
${done ? '' : '<meta http-equiv="refresh" content="5">'}<title>Test de charge</title><style>
body{background:#2b2119;color:#f4ebdd;font:15px system-ui;margin:24px auto;max-width:820px;padding:0 16px}
h1{font-size:22px}table{border-collapse:collapse;width:100%;margin:12px 0}td,th{border-bottom:1px solid #5a4636;padding:6px 8px;text-align:right}
td:first-child,th:first-child{text-align:left}.bad{color:#e5907a;font-weight:bold}.ax{fill:#a49081;font-size:11px}
.k{display:inline-block;width:14px;height:3px;margin:0 6px 3px 12px;vertical-align:middle}.big{font-size:28px;font-weight:bold}
pre{white-space:pre-wrap;color:#e5907a;font-size:12px}</style></head><body>
<h1>Test de charge — ${BASE}</h1>
<p>${done ? 'Terminé.' : `En cours : <b>${stageLabel}</b>`} · ${Math.round((Date.now() - started) / 1000)} s ·
<span class="big">${active}</span> invités actifs${last ? ` · sondage p95 <b>${last.poll.p95} ms</b> · enregistrement p95 <b>${last.action.p95} ms</b>` : ''}</p>
${verdict ? `<p class="big">${verdict}</p>` : ''}
${chart()}
<p><span class="k" style="background:#9dbb86"></span>sondage d'état p95<span class="k" style="background:#d29a55"></span>enregistrement du classement p95<span class="k" style="background:#7f98e0"></span>invités actifs</p>
<table><tr><th>Palier</th><th>Invités</th><th>Page p50/p95</th><th>Sondages</th><th>p50/p95/max ms</th><th>Enregistrements</th><th>p50/p95/max ms</th><th>Erreurs</th></tr>
${stageRows.map(row).join('')}</table>
${failures.length ? `<h2>Erreurs (${failures.length})</h2><pre>${failures.slice(-40).join('\n')}</pre>` : ''}
</body></html>`)
}

// ——— Invité virtuel ———
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const rnd = (n: number) => Math.floor(Math.random() * n)
let stopping = false
const placed = new Map<string, number>()

async function guest(browser: Browser, name: string, secret: string) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
  await ctx.addInitScript(() => localStorage.setItem('cc_concours_lang', 'fr'))
  const page = await ctx.newPage()
  instrument(page, name)
  try {
    await page.goto(`${BASE}/concours/${secret}`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    stepOf.set(name, 'choix du nom')
    await page.getByRole('button', { name, exact: true }).click({ timeout: 30_000 })
    await page.getByRole('button', { name: 'C’est moi' }).click()
    await page.getByRole('heading', { name: 'Mon classement' }).waitFor({ timeout: 30_000 })
    active++
    placed.set(name, 0)
    stepOf.set(name, 'classement')
    // Un vrai invité goûte, puis place un cookie toutes les 5 à 15 s ; une fois
    // tout classé, il réordonne de temps en temps.
    while (!stopping) {
      await sleep(5000 + rnd(10_000))
      if (stopping) break
      // Ce que verrait l'invité : le bandeau « hors ligne » ou « enregistrement impossible ».
      // (Next.js monte aussi un élément vide de même rôle : seul un texte compte.)
      for (const text of await page.getByRole('status').allInnerTexts()) {
        if (text.trim()) failures.push(`${name} bandeau affiché : ${text.trim()}`)
      }
      const chips = page.locator('button[aria-label^="Assiette "]')
      const n = await chips.count()
      if (n > 0) {
        await chips.nth(rnd(n)).click()
        const slots = page.getByRole('button', { name: 'Placer ici' })
        await slots.nth(rnd(await slots.count())).click()
        placed.set(name, placed.get(name)! + 1)
      } else {
        const ups = page.getByRole('button', { name: 'Monter' })
        const k = await ups.count()
        if (k > 1) await ups.nth(1 + rnd(k - 1)).click()
      }
    }
  } catch (e) {
    failures.push(`${name} parcours interrompu : ${(e as Error).message.split('\n')[0]}`)
  }
  return { page, ctx }
}

// ——— Déroulé ———
const secret = generateSecret()
const contestId = await db.createContest(`STRESS TEST (Claude) ${new Date().toISOString().slice(0, 16)}`, secret)
const names = Array.from({ length: MAX }, (_, i) => `Testeur ${String(i + 1).padStart(2, '0')}`)
for (const n of names) await db.addGuest(contestId, n)
for (let i = 1; i <= PLATES; i++) await db.addPlate(contestId, { number: i, label: null, authorIds: [] })
await db.setPhase(contestId, 'voting')
console.log(`Concours ${contestId} créé (${MAX} invités, ${PLATES} cookies). Lien invité : ${BASE}/concours/${secret}`)
console.log(`Suivi en direct : ${OUT}/live.html — pilotage : ${BASE}/admin/concours/${contestId}`)

const cleanup = async () => {
  if (flag('keep')) return console.log(`Concours ${contestId} gardé (--keep).`)
  await db.deleteContest(contestId)
  console.log(`Concours ${contestId} supprimé.`)
}
process.on('SIGINT', async () => { stopping = true; await cleanup(); process.exit(130) })

const browser = await chromium.launch({ channel: 'chrome', headless: !flag('headed') })
const running: Promise<{ page: Page; ctx: Awaited<ReturnType<Browser['newContext']>> }>[] = []
const timer = setInterval(() => {
  const now = Date.now()
  ticks.push({ t: now, users: active, poll: stats(now - 5000, now, 'poll'), action: stats(now - 5000, now, 'action') })
  const k = ticks.at(-1)!
  console.log(`${stageLabel.padEnd(12)} ${String(active).padStart(2)} actifs | sondage p95 ${String(k.poll.p95).padStart(5)} ms (${k.poll.n}) | enreg. p95 ${String(k.action.p95).padStart(5)} ms (${k.action.n}) | erreurs ${failures.length}`)
  writeReport(false)
}, 5000)

try {
  for (const target of STAGES) {
    stageLabel = `palier ${target}`
    const from = Date.now()
    // Arrivées étalées sur ~10 s, comme des invités qui scannent le QR.
    const gap = 10_000 / Math.max(1, target - running.length)
    while (running.length < target) {
      running.push(guest(browser, names[running.length], secret))
      await sleep(gap)
    }
    await sleep(Math.max(0, STAGE_MS - (Date.now() - from)))
    const to = Date.now()
    stageRows.push({ label: stageLabel, users: active, page: stats(from, to, 'page'), poll: stats(from, to, 'poll'), action: stats(from, to, 'action') })
  }
} finally {
  stopping = true
  clearInterval(timer)
  // Laisser partir les derniers enregistrements avant de vérifier la base.
  const sessions = await Promise.all(running)
  await sleep(4000)

  // Aucun enregistrement perdu : chaque bulletin en base a autant de cookies
  // que l'invité virtuel en a placé.
  const data = await db.loadContestData(contestId)
  const idOf = new Map(data.guests.map((g) => [g.name, g.id]))
  const lost = names.filter((n) => placed.has(n)).filter((n) => {
    const inDb = data.ballots.find((b) => b.guestId === idOf.get(n))?.plateIds.length ?? 0
    if (inDb !== placed.get(n)) failures.push(`${n} : ${placed.get(n)} cookies placés, ${inDb} en base`)
    return inDb !== placed.get(n)
  })
  const all = stats(started, Date.now(), 'poll')
  const act = stats(started, Date.now(), 'action')
  const verdict = failures.length === 0 && lost.length === 0
    ? `OK — ${active} invités, ${all.n} sondages (p95 ${all.p95} ms), ${act.n} enregistrements (p95 ${act.p95} ms), aucun perdu.`
    : `À regarder — ${failures.length} erreur(s), ${lost.length} bulletin(s) incomplet(s).`
  const note = abortedAfterReply ? ` (${abortedAfterReply} action(s) coupée(s) par le navigateur après réponse, sans perte.)` : ''
  console.log(`\n${verdict}${note}`)
  writeReport(true, verdict + note)
  for (const s of sessions) await s.ctx.close().catch(() => {})
  await browser.close()
  await cleanup()
}
