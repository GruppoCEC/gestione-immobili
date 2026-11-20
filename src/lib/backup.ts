/** Backup completo in JSON (tutte le collezioni, inclusi i record eliminati) e ripristino. */
import { NOMI_COLLEZIONI, aggiornaInsieme, carica, passo, type NomeCollezione, type RecordBase } from './store'
import { oggiIso } from './utils/formato'

/** Collezioni incluse nel backup: tutte (dalla lista unica in store.ts). */
export const COLLEZIONI: NomeCollezione[] = [...NOMI_COLLEZIONI]

export interface Backup { versione: 1; creato_il: string; creato_da: string; collezioni: Record<string, RecordBase[]> }

export async function creaBackup(token: string, nome: string): Promise<void> {
  const collezioni: Record<string, RecordBase[]> = {}
  for (const n of COLLEZIONI) collezioni[n] = await carica<RecordBase>(token, n, true)
  const b: Backup = { versione: 1, creato_il: new Date().toISOString(), creato_da: nome, collezioni }
  const blob = new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `backup-gestione-immobili-${oggiIso()}.json`; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}

/** Riga del riepilogo prima del ripristino. */
export interface RigaRipristino { nome: NomeCollezione; nelBackup: number; oggi: number | null }

export interface ControlloBackup {
  backup: Backup
  righe: RigaRipristino[]   // collezioni che verranno sostituite
  avvisi: string[]          // collezioni assenti nel backup (restano come sono) o sconosciute (ignorate)
}

const eScheda = (x: unknown): x is RecordBase => !!x && typeof x === 'object' && typeof (x as RecordBase).id === 'string' && (x as RecordBase).id !== ''

/**
 * Controlla il file di backup PRIMA di scrivere qualsiasi cosa: formato, versione, ogni collezione = elenco di schede con
 * un id, id non ripetuti. Lancia un errore in italiano se qualcosa non va (in quel caso non viene toccato nulla).
 */
export function controllaBackup(testo: string): ControlloBackup {
  let b: Backup
  try { b = JSON.parse(testo) as Backup } catch { throw new Error('Il file non è un backup valido: non è un file JSON leggibile.') }
  if (!b || typeof b !== 'object' || b.versione !== 1 || !b.collezioni || typeof b.collezioni !== 'object') {
    throw new Error('Il file non è un backup valido di Gestione Immobili (manca la versione o l\'elenco dei dati).')
  }
  const righe: RigaRipristino[] = []
  const avvisi: string[] = []
  for (const nome of COLLEZIONI) {
    const rec = b.collezioni[nome] as unknown
    if (rec === undefined) { avvisi.push(`"${nome}" non è nel backup: resta com'è oggi.`); continue }
    if (!Array.isArray(rec)) throw new Error(`Nel backup "${nome}" non è un elenco di schede: file danneggiato, ripristino annullato.`)
    const cattiva = rec.findIndex((x) => !eScheda(x))
    if (cattiva >= 0) throw new Error(`Nel backup "${nome}" la scheda n. ${cattiva + 1} non è valida (manca l'identificativo): ripristino annullato.`)
    const ids = new Set(rec.map((x) => (x as RecordBase).id))
    if (ids.size !== rec.length) throw new Error(`Nel backup "${nome}" ci sono schede ripetute: ripristino annullato.`)
    righe.push({ nome, nelBackup: rec.length, oggi: null })
  }
  for (const k of Object.keys(b.collezioni)) if (!(COLLEZIONI as string[]).includes(k)) avvisi.push(`"${k}" non è una sezione della piattaforma: ignorata.`)
  if (!righe.length) throw new Error('Il backup non contiene dati da ripristinare.')
  return { backup: b, righe, avvisi }
}

/** Aggiunge al riepilogo quante schede ci sono oggi in ogni collezione (per confrontare prima di confermare). */
export async function conConteggiAttuali(token: string, c: ControlloBackup): Promise<ControlloBackup> {
  const righe = await Promise.all(c.righe.map(async (r) => ({ ...r, oggi: (await carica<RecordBase>(token, r.nome, true)).length })))
  return { ...c, righe }
}

/** Sostituisce i dati con quelli del backup in UN SOLO salvataggio (tutto o niente). Gli allegati fisici restano nel repository. */
export async function ripristinaBackup(token: string, nome: string, c: ControlloBackup): Promise<string> {
  const { backup: b, righe } = c
  await aggiornaInsieme(token, righe.map((r) => passo<RecordBase>(r.nome, () => b.collezioni[r.nome])),
    `${nome}: ripristino da backup del ${String(b.creato_il).slice(0, 10)}`)
  const n = righe.reduce((s, r) => s + r.nelBackup, 0)
  return `Ripristinati ${n} record da un backup del ${String(b.creato_il).slice(0, 10)} creato da ${b.creato_da}.`
}
