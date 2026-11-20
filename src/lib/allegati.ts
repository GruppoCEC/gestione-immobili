/** Salvataggio di un allegato (file nel repository dati + registrazione nella collezione "allegati"). */
import { CONFIG } from '../config'
import { MODO_DEMO } from './github'
import { aggiornaInsieme, campiModifica, campiNuovo, passo, type NomeCollezione } from './store'
import type { Allegato } from './tipi'
import { formattaByte } from './utils/formato'

export const LIMITE_DEMO = 2 * 1024 * 1024

export function nomeSicuro(nome: string): string {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 80)
}

/** Controlla la dimensione: restituisce il messaggio d'errore o null se il file va bene. */
export function controllaDimensione(file: File): string | null {
  if (file.size > CONFIG.allegatoMaxByte) return `Il file supera ${formattaByte(CONFIG.allegatoMaxByte)}: comprimerlo prima di caricarlo.`
  if (MODO_DEMO && file.size > LIMITE_DEMO) return `In modalità dimostrativa il limite è ${formattaByte(LIMITE_DEMO)} per file (il browser ha poco spazio). Online il limite sarà ${formattaByte(CONFIG.allegatoMaxByte)}.`
  return null
}

/**
 * Carica il file in allegati/AAAA/<id>-<nome> e lo registra collegato al record indicato, in un unico salvataggio:
 * non può restare un file senza registrazione (o una registrazione senza file).
 */
export async function salvaAllegato(token: string, nome: string, file: File, collezione: NomeCollezione, recordId: string, categoria: string, descrizione: string): Promise<void> {
  const errore = controllaDimensione(file)
  if (errore) throw new Error(errore)
  const base = campiNuovo(nome)
  const percorso = `allegati/${new Date().getFullYear()}/${base.id.slice(0, 8)}-${nomeSicuro(file.name)}`
  const scheda: Allegato = { ...base, collezione, record_id: recordId, categoria, nome_file: file.name, percorso, dimensione_byte: file.size, tipo_mime: file.type, note: '' }
  await aggiornaInsieme(token, [passo<Allegato>('allegati', (r) => [...r.filter((x) => x.id !== scheda.id), scheda])],
    `${nome}: allegato "${file.name}" per ${descrizione}`, [{ percorso, binario: file }])
}

/**
 * Elimina allegati: le registrazioni restano nello storico (soft delete, con la nota indicata) e i file vengono tolti dal
 * repository, tutto in un unico salvataggio. Restituisce i file che non c'erano già più.
 */
export async function eliminaAllegati(token: string, nome: string, allegati: Allegato[], messaggio: string, nota = ''): Promise<string[]> {
  const ids = new Set(allegati.map((a) => a.id))
  const quando = new Date().toISOString()
  const { esito } = await aggiornaInsieme(token, [passo<Allegato>('allegati', (r) => r.map((x) => (ids.has(x.id) && !x.eliminato_il
    ? { ...x, eliminato_il: quando, note: [x.note, nota].filter(Boolean).join(' · '), ...campiModifica(nome) } : x)))],
  messaggio, allegati.filter((a) => a.percorso).map((a) => ({ percorso: a.percorso, elimina: true as const })))
  return esito.mancanti
}
