/**
 * Gestione delle collezioni (i file dati/*.json del repository privato).
 *
 * - `carica(nome)` legge e mette in cache l'elenco con il suo SHA.
 * - `aggiorna(nome, modifica, messaggio)` applica una modifica e la salva. Se nel frattempo
 *   un collega ha salvato, ricarica i dati aggiornati e riapplica la modifica (fino a 6 volte, con brevi pause):
 *   così nessuno perde il lavoro dell'altro.
 * - Le cancellazioni sono sempre "soft": si imposta `eliminato_il`, il record resta nel file.
 */
import { ErroreGitHub, leggiFile, scriviCommit, scriviFile, testaRamo, type EsitoCommit, type ModificaFile } from './github'

/** Tutte le collezioni (file dati/<nome>.json). Unica lista: backup e ripristino la usano, nessuna può essere dimenticata. */
export const NOMI_COLLEZIONI = [
  'societa', 'immobili', 'conduttori', 'condomini', 'contratti', 'annualita', 'movimenti', 'voci_condominiali', 'piani_rientro',
  'allegati', 'comunicazioni', 'tassi_legali', 'contribuenti', 'pratiche_tributi', 'fatture_fornitori',
] as const
export type NomeCollezione = typeof NOMI_COLLEZIONI[number]

export interface RecordBase {
  id: string
  creato_il: string
  creato_da: string
  modificato_il: string
  modificato_da: string
  eliminato_il: string | null
}

interface Cache<T> { record: T[]; sha: string | null }

const cache = new Map<NomeCollezione, Cache<RecordBase>>()
const ascoltatori = new Set<() => void>()
/** Letture in corso (due schermate che chiedono la stessa collezione fanno una sola richiesta). */
const inLettura = new Map<NomeCollezione, Promise<RecordBase[]>>()
/** Numero di salvataggi per collezione: una lettura partita prima di un salvataggio non deve sovrascriverne il risultato. */
const versioni = new Map<NomeCollezione, number>()

export function percorsoCollezione(nome: NomeCollezione): string {
  return `dati/${nome}.json`
}

export function nuovoId(): string {
  return crypto.randomUUID()
}

export function adesso(): string {
  return new Date().toISOString()
}

/** Registra una funzione da chiamare quando una collezione cambia (per aggiornare le schermate). */
export function osserva(fn: () => void): () => void {
  ascoltatori.add(fn)
  return () => ascoltatori.delete(fn)
}

function notifica(): void {
  ascoltatori.forEach((fn) => fn())
}

async function leggiCollezione<T extends RecordBase>(token: string, nome: NomeCollezione, ref?: string): Promise<Cache<T>> {
  const file = await leggiFile(token, percorsoCollezione(nome), ref)
  if (!file) return { record: [], sha: null }
  let dati: unknown
  try {
    dati = JSON.parse(file.contenuto)
  } catch {
    throw new Error(`Il file ${percorsoCollezione(nome)} non è un JSON valido: controllarlo su GitHub.`)
  }
  // Un file che non contiene un elenco NON va trattato come vuoto: il salvataggio successivo lo sovrascriverebbe
  // cancellando tutti i dati. Meglio fermarsi e far controllare il file.
  if (!Array.isArray(dati)) {
    throw new Error(`Il file ${percorsoCollezione(nome)} non contiene un elenco di schede come previsto: per non perdere dati non viene letto né salvato. Controllarlo su GitHub (Storico) o ripristinare un backup.`)
  }
  return { record: dati as T[], sha: file.sha }
}

/** Carica una collezione (dalla cache se già letta, altrimenti da GitHub). */
export async function carica<T extends RecordBase>(token: string, nome: NomeCollezione, forza = false): Promise<T[]> {
  if (!forza && cache.has(nome)) return cache.get(nome)!.record as T[]
  const giaInCorso = inLettura.get(nome)
  if (giaInCorso) return giaInCorso as Promise<T[]>
  const versione = versioni.get(nome) ?? 0
  const lettura = leggiCollezione<T>(token, nome).then((letto) => {
    // Se nel frattempo è stato fatto un salvataggio, la cache ha già i dati più recenti: non la si sovrascrive
    if ((versioni.get(nome) ?? 0) === versione) { cache.set(nome, letto); notifica() }
    return (cache.get(nome)?.record ?? letto.record) as T[]
  }).finally(() => inLettura.delete(nome))
  inLettura.set(nome, lettura)
  return lettura
}

/** SHA del file della collezione in cache (null se non ancora letta): serve a capire se un collega l'ha cambiata. */
export function shaInCache(nome: NomeCollezione): string | null | undefined {
  return cache.has(nome) ? cache.get(nome)!.sha : undefined
}

/** Collezioni già lette (le uniche da ricaricare quando un collega salva). */
export function collezioniInCache(): NomeCollezione[] {
  return [...cache.keys()]
}

/** Restituisce i record già in cache (o array vuoto) senza chiamare GitHub. */
export function inCache<T extends RecordBase>(nome: NomeCollezione): T[] {
  return (cache.get(nome)?.record ?? []) as T[]
}

export function svuotaCache(): void {
  cache.clear()
  notifica()
}

/**
 * Applica `modifica` all'elenco e salva su GitHub con un commit dal messaggio indicato.
 * `modifica` deve essere una funzione pura (riceve l'elenco corrente, restituisce il nuovo):
 * in caso di conflitto viene richiamata sui dati appena ricaricati.
 */
export async function aggiorna<T extends RecordBase>(
  token: string,
  nome: NomeCollezione,
  modifica: (record: T[]) => T[],
  messaggio: string,
): Promise<T[]> {
  const TENTATIVI = 6
  salvataggiInCorso++
  try {
  for (let i = 0; i < TENTATIVI; i++) {
    // Dopo un conflitto si aspetta un attimo (sempre di più, con una parte casuale) prima di rileggere: GitHub ha il tempo
    // di rendere disponibile il salvataggio del collega e due utenti che riprovano insieme non si scontrano di nuovo
    if (i > 0) await new Promise((ok) => setTimeout(ok, 400 * i + Math.random() * 400))
    const attuale = (i === 0 && cache.has(nome)) ? (cache.get(nome)! as Cache<T>) : await leggiCollezione<T>(token, nome)
    const nuovo = modifica(attuale.record)
    const contenuto = JSON.stringify(nuovo, null, 2) + '\n'
    try {
      const sha = await scriviFile(token, percorsoCollezione(nome), contenuto, messaggio, attuale.sha ?? undefined)
      versioni.set(nome, (versioni.get(nome) ?? 0) + 1)
      cache.set(nome, { record: nuovo, sha })
      notifica()
      return nuovo
    } catch (e) {
      if (e instanceof ErroreGitHub && e.conflitto) {
        cache.delete(nome) // forza la rilettura al prossimo giro
        continue
      }
      throw e
    }
  }
  throw new Error('Salvataggio non riuscito: altri utenti stavano salvando nello stesso momento. Riprovare a salvare tra qualche secondo.')
  } finally {
    salvataggiInCorso--
  }
}

/* ---------------------------- salvataggio di più collezioni insieme ---------------------------- */

/** Un passo di un salvataggio multiplo: la collezione e la modifica (riceve anche i risultati dei passi precedenti). */
export interface Passo {
  nome: NomeCollezione
  modifica: (record: RecordBase[], precedenti: Map<NomeCollezione, RecordBase[]>) => RecordBase[]
}

/** Crea un passo con il tipo giusto dei record. */
export function passo<T extends RecordBase>(nome: NomeCollezione, modifica: (record: T[], precedenti: Map<NomeCollezione, RecordBase[]>) => T[]): Passo {
  return { nome, modifica: modifica as unknown as Passo['modifica'] }
}

/**
 * Salva più collezioni (ed eventualmente file: allegati da aggiungere o eliminare) in UN SOLO commit: o va a buon fine
 * tutto o niente, così non restano dati a metà (es. annualità salvata ma canoni non adeguati, file senza registrazione).
 * Come `aggiorna`, se un collega salva nel frattempo rilegge e riapplica le modifiche (funzioni pure), fino a 6 volte.
 * I passi che non cambiano nulla (restituiscono lo stesso elenco) non vengono scritti.
 */
export async function aggiornaInsieme(token: string, passi: Passo[], messaggio: string, altriFile: ModificaFile[] = []): Promise<{ risultati: Map<NomeCollezione, RecordBase[]>; esito: EsitoCommit }> {
  if (new Set(passi.map((p) => p.nome)).size !== passi.length) throw new Error('Ogni collezione può comparire una sola volta.')
  const TENTATIVI = 6
  salvataggiInCorso++
  try {
    for (let i = 0; i < TENTATIVI; i++) {
      if (i > 0) await new Promise((ok) => setTimeout(ok, 400 * i + Math.random() * 400))
      const base = await testaRamo(token)
      const letti = await Promise.all(passi.map((p) => leggiCollezione<RecordBase>(token, p.nome, base.commit || undefined)))
      const risultati = new Map<NomeCollezione, RecordBase[]>()
      const modifiche: ModificaFile[] = []
      passi.forEach((p, k) => {
        const nuovo = p.modifica(letti[k].record, risultati)
        risultati.set(p.nome, nuovo)
        if (nuovo !== letti[k].record) modifiche.push({ percorso: percorsoCollezione(p.nome), testo: JSON.stringify(nuovo, null, 2) + '\n' })
      })
      try {
        const esito = modifiche.length || altriFile.length ? await scriviCommit(token, base, [...modifiche, ...altriFile], messaggio) : { sha: new Map(), mancanti: [] }
        passi.forEach((p, k) => {
          const shaNuovo = esito.sha.get(percorsoCollezione(p.nome))
          versioni.set(p.nome, (versioni.get(p.nome) ?? 0) + 1)
          cache.set(p.nome, { record: risultati.get(p.nome)!, sha: shaNuovo !== undefined ? shaNuovo : letti[k].sha })
        })
        notifica()
        return { risultati, esito }
      } catch (e) {
        if (e instanceof ErroreGitHub && e.conflitto) continue
        throw e
      }
    }
    throw new Error('Salvataggio non riuscito: altri utenti stavano salvando nello stesso momento. Riprovare a salvare tra qualche secondo.')
  } finally {
    salvataggiInCorso--
  }
}

/* ---------------------------- salvataggi in corso ---------------------------- */

/** Salvataggi non ancora finiti: chiudendo la pagina in quel momento il browser chiede conferma. */
let salvataggiInCorso = 0
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (e) => {
    if (salvataggiInCorso > 0) { e.preventDefault(); e.returnValue = '' }
  })
}

/** Campi di tracciamento per un record nuovo. */
export function campiNuovo(nome: string): Pick<RecordBase, 'id' | 'creato_il' | 'creato_da' | 'modificato_il' | 'modificato_da' | 'eliminato_il'> {
  const t = adesso()
  return { id: nuovoId(), creato_il: t, creato_da: nome, modificato_il: t, modificato_da: nome, eliminato_il: null }
}

/** Campi di tracciamento per una modifica. */
export function campiModifica(nome: string): Pick<RecordBase, 'modificato_il' | 'modificato_da'> {
  return { modificato_il: adesso(), modificato_da: nome }
}

/** Filtra i record non eliminati. */
export function attivi<T extends RecordBase>(record: T[]): T[] {
  return record.filter((r) => !r.eliminato_il)
}

/* ---------------------------- unione delle modifiche sulla stessa scheda ---------------------------- */

const uguali = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** Solo i campi che l'utente ha cambiato nel modulo rispetto ai valori con cui l'aveva aperto. */
export function soloCampiCambiati<T>(valori: Partial<T>, iniziale: Partial<T>): Partial<T> {
  const out: Partial<T> = {}
  for (const k of Object.keys(valori) as Array<keyof T>) if (!uguali(valori[k], iniziale[k])) out[k] = valori[k]
  return out
}

export interface EsitoUnione {
  /** Chi ha modificato la scheda dopo che l'utente l'aveva aperta (null se nessuno) */
  altri: string | null
  /** Campi cambiati sia dall'utente sia dal collega (vale la versione dell'utente) */
  stessiCampi: string[]
}

/**
 * Applica alla versione più recente della scheda (`attuale`, riletta da GitHub) solo i campi cambiati dall'utente:
 * le modifiche fatte nel frattempo da un collega agli altri campi restano. Se entrambi hanno cambiato lo stesso campo
 * vale quello dell'utente, e viene segnalato.
 */
export function unisciModifiche<T extends RecordBase>(attuale: T, valori: Partial<T>, iniziale: Partial<T>): { record: T; esito: EsitoUnione } {
  const cambiati = soloCampiCambiati(valori, iniziale)
  const altri = iniziale.modificato_il && attuale.modificato_il !== iniziale.modificato_il ? attuale.modificato_da : null
  const stessiCampi = altri
    ? (Object.keys(cambiati) as Array<keyof T & string>).filter((k) => !uguali(attuale[k], iniziale[k]) && !uguali(attuale[k], cambiati[k]))
    : []
  return { record: { ...attuale, ...cambiati }, esito: { altri, stessiCampi } }
}

/**
 * Nell'elenco `rec` sostituisce la scheda `id` unendo le modifiche dell'utente (vedi unisciModifiche) e aggiorna
 * chi l'ha modificata. Restituisce il nuovo elenco e l'esito (null se la scheda non c'è più).
 */
export function sostituisciUnendo<T extends RecordBase>(rec: T[], id: string, valori: Partial<T>, iniziale: Partial<T>, nome: string): { record: T[]; esito: EsitoUnione | null } {
  let esito: EsitoUnione | null = null
  const record = rec.map((x) => {
    if (x.id !== id) return x
    const u = unisciModifiche(x, valori, iniziale)
    esito = u.esito
    return { ...u.record, ...campiModifica(nome) }
  })
  return { record, esito }
}

/** Testo dell'avviso dopo un salvataggio unito a quello di un collega (null se non serve). */
export function descriviUnione(esito: EsitoUnione | null, etichette: Record<string, string> = {}): string | null {
  if (!esito?.altri) return null
  const campi = esito.stessiCampi.map((k) => etichette[k] ?? k)
  return `Nel frattempo ${esito.altri} aveva modificato questa scheda: le vostre modifiche sono state unite.`
    + (campi.length ? ` Per ${campi.join(', ')} vale la tua versione.` : '')
}
