/** Formattazione italiana di importi (in centesimi) e date (ISO). */
import { giorniDelMese } from './date'

// useGrouping 'always': separatore delle migliaia anche sui numeri di 4 cifre ("1.350,00 €" e non "1350,00 €")
const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', useGrouping: 'always' } as Intl.NumberFormatOptions)

/** 1234567 → "12.345,67 €" */
export function formattaEuro(centesimi: number | null | undefined): string {
  if (centesimi === null || centesimi === undefined) return '—'
  return euro.format(centesimi / 100)
}

/**
 * Testo scritto dall'utente → centesimi (null se non interpretabile).
 * "1.350,00" / "1350,00" / "1.350" → 135000 (con la virgola, o con gruppi di 3 cifre, i punti sono le migliaia);
 * "650.50" / "650.5" / "12345.67" → decimali col punto (un solo punto seguito da 1 o 2 cifre).
 */
export function analizzaEuro(testo: string): number | null {
  let pulito = testo.replace(/[€\s]/g, '')
  if (pulito === '') return null
  if (pulito.includes(',')) pulito = pulito.replace(/\./g, '').replace(',', '.')
  else if (!/^-?\d+\.\d{1,2}$/.test(pulito)) pulito = pulito.replace(/\./g, '')
  const n = Number(pulito)
  return Number.isFinite(n) ? Math.round(n * 100) : null
}

/** Centesimi → testo da modificare in un campo: 135050 → "1350,50" (vuoto se manca) */
export function centesimiInTesto(centesimi: number | null | undefined): string {
  return centesimi === null || centesimi === undefined ? '' : (centesimi / 100).toFixed(2).replace('.', ',')
}

/** "2026-09-24" → "24/09/2026" */
export function formattaData(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [a, m, g] = iso.slice(0, 10).split('-')
  return `${g}/${m}/${a}`
}

/** "2026-09-24T10:00:00Z" → "24/09/2026 12:00" (ora locale) */
export function formattaDataOra(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })
}

const due = (n: number) => String(n).padStart(2, '0')

/** Data di oggi in ISO (AAAA-MM-GG), secondo l'orologio del computer (ora italiana: dopo mezzanotte è già il giorno dopo) */
export function oggiIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`
}

/**
 * Aggiunge mesi a una data ISO. Se il giorno non esiste nel mese di arrivo si usa l'ultimo giorno del mese
 * (31/01 + 1 mese = 28/02). Calcolo sul calendario, senza orari: nessun giorno perso con l'ora legale.
 */
export function aggiungiMesi(iso: string, mesi: number): string {
  const [a, m, g] = iso.slice(0, 10).split('-').map(Number)
  const totale = a * 12 + (m - 1) + mesi
  const anno = Math.floor(totale / 12), mese = totale - anno * 12 + 1
  const ultimo = giorniDelMese(anno, mese)
  return `${anno}-${due(mese)}-${due(Math.min(g, ultimo))}`
}

/** Aggiunge anni a una data ISO (per la prima scadenza del contratto); il 29/02 diventa 28/02 negli anni non bisestili */
export function aggiungiAnni(iso: string, anni: number): string {
  return aggiungiMesi(iso, anni * 12)
}

/** Byte → "1,2 MB" */
export function formattaByte(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}
