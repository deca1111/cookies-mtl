import { expect, test, vi } from 'vitest'
import { extractGoogleListing, resolveGoogleShareLink } from '../google-link'

// Les trois formes que Google sert selon l'appareil et le chemin de partage,
// relevées le 2026-08-11 sur de vrais liens (spec du même jour). Elles sont
// figées ici : c'est la seule protection contre un retour du bug si le parseur
// se remet à supposer une forme unique.
const DESKTOP =
  'https://www.google.com/maps/place/F%C3%A9lix+%26+Norton/@45.5216,-73.586,17z/data=!3m1!4b1!4m6!3m5!1s0x4cc91bf8abc:0xdef!8m2!3d45.5218234!4d-73.5837119!16s'
const SAFARI_IPHONE =
  'https://www.google.com/maps/place/Ciao+Amore+Caf%C3%A9,+838+Avenue+du+Mont-Royal+E,+Montr%C3%A9al,+QC+H2J+1X1/@45.5260495,-73.5808193,17z/data=!4m6!3m5!1s0x4cc91b00036c0209:0xbad2840fd816663c!8m2!3d45.5260495!4d-73.5808193!16s%2Fg%2F11wj3tqxrp?hl=fr'
const APPLI_MOBILE =
  'https://maps.google.com/maps?q=Le+Picnic+V%C3%A9loCaf%C3%A9,+1251+Rue+Rachel+E,+Montreal,+Quebec+H2J+2J9,+Canada&ftid=0x4cc91b13cacc824f:0xa72a688293ae010a&entry=gps&shh=CAE&g_st=ic'

test('forme desktop : nom seul, épingle précise, pas d’adresse', () => {
  expect(extractGoogleListing(DESKTOP)).toEqual({
    name: 'Félix & Norton',
    address: '',
    lat: 45.5218234,
    lng: -73.5837119,
  })
})

test('forme Safari iPhone : le nom ne doit PAS absorber l’adresse', () => {
  expect(extractGoogleListing(SAFARI_IPHONE)).toEqual({
    name: 'Ciao Amore Café',
    address: '838 Avenue du Mont-Royal E, Montréal',
    lat: 45.5260495,
    lng: -73.5808193,
  })
})

test('forme appli mobile : nom et adresse dans q, aucune coordonnée', () => {
  expect(extractGoogleListing(APPLI_MOBILE)).toEqual({
    name: 'Le Picnic VéloCafé',
    address: '1251 Rue Rachel E, Montréal',
    lat: null,
    lng: null,
  })
})

// Relevés en base le 2026-08-11 : Google intercale le complexe ou la ville entre
// le commerce et sa rue. La première version du correctif renonçait à découper et
// remettait tout dans le nom — le bug d'origine, sous une autre forme.
test('adresse précédée du nom du complexe (Café Dépôt)', () => {
  const url =
    'https://www.google.com/maps/place/Caf%C3%A9+D%C3%A9p%C3%B4t,+O+Centre+de+Commerce+Mondial+de+Montreal,+383+Rue+Saint-Jacques,+Montreal,+Quebec+H2Y+2N9/@45.5030,-73.5600,17z/data=!8m2!3d45.5030!4d-73.5600'
  expect(extractGoogleListing(url)).toMatchObject({
    name: 'Café Dépôt',
    address: '383 Rue Saint-Jacques, Montréal',
  })
})

test('adresse précédée d’une ville répétée (Marché Saint Laurent)', () => {
  const url =
    "https://www.google.com/maps/place/March%C3%A9+Saint+Laurent,+Montr%C3%A9al,+503+Place+d'Armes,+Montreal,+Quebec+H2Y+2W8/@45.5050585,-73.5569,17z/data=!8m2!3d45.5050585!4d-73.5569"
  expect(extractGoogleListing(url)).toMatchObject({
    name: 'Marché Saint Laurent',
    address: "503 Place d'Armes, Montréal",
  })
})

test('un nom contenant une virgule n’est pas tronqué', () => {
  // Le symétrique du bug corrigé : la virgule ne coupe que devant une adresse.
  const url = 'https://www.google.com/maps/place/Caf%C3%A9,+etc./@45.5,-73.6,17z/data=!8m2!3d45.5!4d-73.6'
  expect(extractGoogleListing(url)).toEqual({ name: 'Café, etc.', address: '', lat: 45.5, lng: -73.6 })
})

test('une adresse sans numéro civique est reconnue par son mot de voie', () => {
  const url = 'https://maps.google.com/maps?q=Sora+Caf%C3%A9,+Place+Ville-Marie,+Montr%C3%A9al,+QC'
  expect(extractGoogleListing(url)).toEqual({
    name: 'Sora Café',
    address: 'Place Ville-Marie, Montréal',
    lat: null,
    lng: null,
  })
})

test('replis des coordonnées : @lat,lng quand !3d/!4d manque', () => {
  const url = 'https://www.google.com/maps/place/Cookie+Bar/@45.51,-73.57,17z/data=!4m2'
  expect(extractGoogleListing(url)).toEqual({ name: 'Cookie Bar', address: '', lat: 45.51, lng: -73.57 })
})

test('sans porteur de nom, rien à extraire', () => {
  expect(extractGoogleListing('https://www.google.com/maps/@45.5,-73.6,12z')).toBeNull()
  expect(extractGoogleListing('https://example.com/nope')).toBeNull()
  expect(extractGoogleListing('https://maps.google.com/maps?q=')).toBeNull()
  // Épingle nue : des coordonnées pour seule requête, donc pas de fiche.
  expect(extractGoogleListing('https://maps.google.com/maps?q=45.5271868,-73.5731661')).toBeNull()
})

test('nom au pourcentage-encodage cassé', () => {
  expect(extractGoogleListing('https://www.google.com/maps/place/Bad%Name/@45.5,-73.6,17z')).toBeNull()
})

test('hôtes sosies rejetés, TLD régionaux acceptés', () => {
  expect(extractGoogleListing('https://evilgoogle.com/maps/place/X/@45.5,-73.6,17z')).toBeNull()
  expect(extractGoogleListing('https://evilgoogle.ca/maps/place/X/@45.5,-73.6,17z')).toBeNull()
  expect(extractGoogleListing('https://google.ca.evil.example/maps/place/X/@45.5,-73.6,17z')).toBeNull()

  const regional =
    'https://www.google.ca/maps/place/Le+Butterblume/@45.5276376,-73.6028722,590m/data=!3m1!1e3!4m6!3m5!1s0x4cc9197a6778e4a7:0xed8126bc5d286d24!8m2!3d45.5275!4d-73.6030556!16s'
  expect(extractGoogleListing(regional)?.name).toBe('Le Butterblume')

  const britannique = 'https://www.google.co.uk/maps/place/Cookie+Bar/@51.5,-0.12,17z/data=!8m2!3d51.5!4d-0.12'
  expect(extractGoogleListing(britannique)).toEqual({ name: 'Cookie Bar', address: '', lat: 51.5, lng: -0.12 })
})

test('resolveGoogleShareLink suit la redirection et garde le lien collé comme lien de fiche', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, url: DESKTOP })
  const out = await resolveGoogleShareLink('https://maps.app.goo.gl/AbC123', fetchMock as unknown as typeof fetch)
  expect(fetchMock).toHaveBeenCalledWith(
    'https://maps.app.goo.gl/AbC123',
    expect.objectContaining({ redirect: 'follow' })
  )
  expect(out).toEqual({
    name: 'Félix & Norton',
    address: '',
    lat: 45.5218234,
    lng: -73.5837119,
    googleMapsUrl: 'https://maps.app.goo.gl/AbC123',
  })
})

test('resolveGoogleShareLink rejette les hôtes non-Google et les pannes réseau', async () => {
  expect(await resolveGoogleShareLink('https://evil.example/x')).toBeNull()
  const failing = vi.fn().mockRejectedValue(new Error('net'))
  expect(await resolveGoogleShareLink('https://maps.app.goo.gl/x', failing as unknown as typeof fetch)).toBeNull()
})

test('resolveGoogleShareLink géocode l’adresse quand le lien ne porte pas de coordonnées', async () => {
  const photon = { features: [{ properties: {}, geometry: { coordinates: [-73.5731661, 45.5271868] } }] }
  const fetchMock = vi.fn(async (input: string) =>
    input.includes('photon') ? { ok: true, json: async () => photon } : { ok: true, url: APPLI_MOBILE }
  )
  const out = await resolveGoogleShareLink(
    'https://maps.app.goo.gl/s3DDRaPwqg7G8NT28?g_st=ic',
    fetchMock as unknown as typeof fetch
  )
  expect(out).toEqual({
    name: 'Le Picnic VéloCafé',
    address: '1251 Rue Rachel E, Montréal',
    lat: 45.5271868,
    lng: -73.5731661,
    googleMapsUrl: 'https://maps.app.goo.gl/s3DDRaPwqg7G8NT28?g_st=ic',
  })
  // L'adresse part seule au géocodeur : OSM connaît le numéro civique, pas le
  // nom commercial — le coller devant ferait rater des adresses valides.
  const photonCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('photon'))
  expect(new URL(String(photonCall?.[0])).searchParams.get('q')).toBe('1251 Rue Rachel E, Montréal')
})

test('resolveGoogleShareLink rend null quand l’adresse ne se géocode pas', async () => {
  const fetchMock = vi.fn(async (input: string) =>
    input.includes('photon') ? { ok: true, json: async () => ({ features: [] }) } : { ok: true, url: APPLI_MOBILE }
  )
  expect(await resolveGoogleShareLink('https://maps.app.goo.gl/x', fetchMock as unknown as typeof fetch)).toBeNull()
})
