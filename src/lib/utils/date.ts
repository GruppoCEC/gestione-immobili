/**
 * Calcoli sulle date usati in tutta la piattaforma. Le date sono stringhe ISO ("AAAA-MM-GG", mesi "AAAA-MM") e i
 * calcoli si fanno sul calendario in UTC, senza orari: niente giorni persi con l'ora legale.
 */

export const MESI_BREVI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
export const MESI_LUNGHI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
export const GIORNI_LUNGHI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato']

const GIORNO_MS = 86_400_000
const due = (n: number) => String(n).padStart(2, '0')
const inData = (iso: string) => new Date(iso.slice(0, 10) + 'T00:00:00Z')
const iso = (d: Date) => d.toISOString().slice(0, 10)

/** Aggiunge (o toglie, con n negativo) giorni a una data ISO. */
export const aggiungiGiorni = (data: string, n: number) => iso(new Date(inData(data).getTime() + n * GIORNO_MS))

/** Giorni tra due date ISO (positivo se `a` è dopo `da`). */
export const giorniTra = (da: string, a: string) => Math.round((inData(a).getTime() - inData(da).getTime()) / GIORNO_MS)

/** Numero di giorni del mese (mese 1-12). */
export const giorniDelMese = (anno: number, mese: number) => new Date(Date.UTC(anno, mese, 0)).getUTCDate()

/** Ultimo giorno del mese "AAAA-MM" → "AAAA-MM-GG". */
export function fineMese(mese: string): string {
  const [a, m] = mese.split('-').map(Number)
  return `${mese.slice(0, 7)}-${due(giorniDelMese(a, m))}`
}

/** Mese "AAAA-MM" spostato di n mesi (per default il successivo). Accetta anche una data completa. */
export function meseDopo(mese: string, n = 1): string {
  const [a, m] = mese.split('-').map(Number)
  const totale = a * 12 + (m - 1) + n
  const anno = Math.floor(totale / 12)
  return `${anno}-${due(totale - anno * 12 + 1)}`
}

/** Ultimo giorno del mese che si trova `mesi` mesi dopo quello della data. */
export const fineMeseDopo = (data: string, mesi: number) => fineMese(meseDopo(data, mesi))

/** "2026-03" → "marzo 2026" */
export const meseLungo = (mese: string) => (/^\d{4}-\d{2}/.test(mese) ? `${MESI_LUNGHI[Number(mese.slice(5, 7)) - 1]} ${mese.slice(0, 4)}` : mese)

/** "2026-03" → "Mar 2026" */
export const meseBreveAnno = (mese: string) => `${MESI_BREVI[Number(mese.slice(5, 7)) - 1]} ${mese.slice(0, 4)}`

/** "2026-03" → "Mar 26" */
export const meseBreveAnnoCorto = (mese: string) => `${MESI_BREVI[Number(mese.slice(5, 7)) - 1]} ${mese.slice(2, 4)}`

/** Mesi "AAAA-01" … "AAAA-12" di un anno. */
export const mesiDellAnno = (anno: number) => MESI_BREVI.map((_, i) => `${anno}-${due(i + 1)}`)

/** "2026-11-20" → "venerdì 20 novembre 2026" */
export function dataEstesa(data: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return data
  const d = inData(data)
  return `${GIORNI_LUNGHI[d.getUTCDay()]} ${d.getUTCDate()} ${MESI_LUNGHI[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/** Iniziale maiuscola: "marzo" → "Marzo" */
export const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
