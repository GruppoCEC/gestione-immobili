/**
 * Accesso al repository dati tramite GitHub REST API (Contents API + Git Data API).
 * Tutte le funzioni lanciano ErroreGitHub con messaggio in italiano in caso di problemi.
 */
import { CONFIG } from '../config'

const API = 'https://api.github.com'

/**
 * MODALITÀ DIMOSTRATIVA: se il token cifrato non è ancora configurato, l'app funziona in locale
 * salvando i dati nel browser (localStorage) invece che su GitHub. Serve per provare le
 * schermate prima della pubblicazione. Nessun dato lascia il computer.
 */
export const TOKEN_DEMO = 'DEMO'
// `npm run prova` forza la modalità dimostrativa anche con le password configurate: per provare novità senza toccare i dati veri
export const MODO_DEMO = import.meta.env.VITE_DEMO === '1' || Object.keys(CONFIG.tokenCifrato.utenti ?? {}).length === 0
const PREFISSO_DEMO = 'gestione-immobili.demo.'

/** "SHA" di un file in modalità prova: impronta del contenuto (cambia a ogni modifica, come su GitHub). */
function impronta(testo: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < testo.length; i++) { h ^= testo.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return `demo-${h.toString(16)}-${testo.length}`
}
function demoCommits(): Commit[] {
  return JSON.parse(localStorage.getItem(PREFISSO_DEMO + '_commits') ?? '[]') as Commit[]
}
function demoLeggi(percorso: string): FileLetto | null {
  const raw = localStorage.getItem(PREFISSO_DEMO + percorso)
  return raw ? { contenuto: raw, sha: impronta(raw) } : null
}
function demoScrivi(percorso: string, contenuto: string, messaggio: string, sha?: string): string {
  // Come GitHub: se il file è cambiato dopo la lettura (salvataggio di un'altra scheda del browser) è un conflitto
  const attuale = localStorage.getItem(PREFISSO_DEMO + percorso)
  if (sha !== undefined && attuale !== null && impronta(attuale) !== sha) {
    throw new ErroreGitHub(messaggioPerStato(409), 409, true)
  }
  localStorage.setItem(PREFISSO_DEMO + percorso, contenuto)
  const commits = demoCommits()
  commits.unshift({ sha: crypto.randomUUID(), messaggio, data: new Date().toISOString(), autore: messaggio.split(':')[0], percorsi: [percorso] })
  localStorage.setItem(PREFISSO_DEMO + '_commits', JSON.stringify(commits.slice(0, 200)))
  return impronta(contenuto)
}

export class ErroreGitHub extends Error {
  stato: number
  conflitto: boolean
  constructor(message: string, stato: number, conflitto = false) {
    super(message)
    this.name = 'ErroreGitHub'
    this.stato = stato
    this.conflitto = conflitto
  }
}

export interface FileLetto {
  contenuto: string
  sha: string
}

export interface Commit {
  sha: string
  messaggio: string
  data: string
  autore: string
  percorsi?: string[]   // solo in modalità prova: file toccati dal salvataggio
}

function base(): string {
  return `${API}/repos/${CONFIG.proprietario}/${CONFIG.repoDati}`
}

function intestazioni(token: string, accept = 'application/vnd.github+json'): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: accept,
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

function messaggioPerStato(stato: number, dettaglio?: string): string {
  switch (stato) {
    case 401: return 'Token non valido o scaduto: rinnovare il token (vedi Impostazioni).'
    case 403: return 'Accesso negato dal server GitHub (permessi insufficienti o troppe richieste). Riprovare tra qualche minuto.'
    case 404: return 'File o repository non trovato. Controllare nome utente e repository in configurazione.'
    case 409:
    case 422: return 'Un altro utente ha salvato nel frattempo: la modifica verrà riapplicata sui dati aggiornati.'
    default: return `Errore di comunicazione con GitHub (codice ${stato})${dettaglio ? ': ' + dettaglio : ''}.`
  }
}

async function richiesta(token: string, percorso: string, init: RequestInit = {}, accept?: string): Promise<Response> {
  let risposta: Response
  try {
    // no-store: GitHub fa tenere al browser le letture per 60 secondi; senza questo, dopo il salvataggio di un collega
    // si rileggerebbe la versione vecchia (con lo SHA vecchio) e ogni nuovo tentativo di salvataggio andrebbe in conflitto
    risposta = await fetch(`${base()}${percorso}`, { cache: 'no-store', ...init, headers: { ...intestazioni(token, accept), ...(init.headers ?? {}) } })
  } catch {
    throw new ErroreGitHub('Connessione a GitHub non riuscita: verificare la rete.', 0)
  }
  if (!risposta.ok) {
    let dettaglio: string | undefined
    try { dettaglio = ((await risposta.json()) as { message?: string }).message } catch { /* nessun dettaglio */ }
    const conflitto = risposta.status === 409 || (risposta.status === 422 && !!dettaglio?.toLowerCase().includes('sha'))
    throw new ErroreGitHub(messaggioPerStato(risposta.status, dettaglio), risposta.status, conflitto)
  }
  return risposta
}

/** Verifica che il token permetta di leggere il repository dati. Restituisce il nome del repo. */
export async function verificaAccesso(token: string): Promise<string> {
  if (token === TOKEN_DEMO) return 'modalità dimostrativa (dati solo in questo browser)'
  const r = await richiesta(token, '')
  const dati = (await r.json()) as { full_name: string; permissions?: { push?: boolean } }
  if (dati.permissions && dati.permissions.push === false) {
    throw new ErroreGitHub('Il token permette solo la lettura: serve il permesso "Contents: Read and write".', 403)
  }
  return dati.full_name
}

function decodificaBase64Utf8(b64: string): string {
  const bin = atob(b64.replace(/\n/g, ''))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

function codificaBase64(bytes: Uint8Array): string {
  let bin = ''
  const blocco = 0x8000
  for (let i = 0; i < bytes.length; i += blocco) {
    bin += String.fromCharCode(...bytes.subarray(i, i + blocco))
  }
  return btoa(bin)
}

/** Legge un file di testo (JSON) con il suo SHA (al ramo dei dati o a un commit preciso). Null se non esiste. */
export async function leggiFile(token: string, percorso: string, ref: string = CONFIG.ramo): Promise<FileLetto | null> {
  if (token === TOKEN_DEMO) return demoLeggi(percorso)
  let r: Response
  try {
    r = await richiesta(token, `/contents/${percorso}?ref=${ref}`)
  } catch (e) {
    if (e instanceof ErroreGitHub && e.stato === 404) return null
    throw e
  }
  const meta = (await r.json()) as { sha: string; content?: string; encoding?: string; size: number }
  if (meta.encoding === 'base64' && meta.content !== undefined) {
    return { contenuto: decodificaBase64Utf8(meta.content), sha: meta.sha }
  }
  // File oltre 1 MB: la Contents API non include il contenuto, si legge il blob "raw".
  const blob = await richiesta(token, `/git/blobs/${meta.sha}`, {}, 'application/vnd.github.raw+json')
  return { contenuto: await blob.text(), sha: meta.sha }
}

/**
 * Scrive (crea o aggiorna) un file di testo. Passare lo SHA letto in precedenza per
 * l'aggiornamento: se nel frattempo qualcun altro ha salvato, viene lanciato un ErroreGitHub
 * con `conflitto = true`.
 */
export async function scriviFile(token: string, percorso: string, contenuto: string, messaggio: string, sha?: string): Promise<string> {
  if (token === TOKEN_DEMO) return demoScrivi(percorso, contenuto, messaggio, sha)
  const corpo = {
    message: messaggio,
    content: codificaBase64(new TextEncoder().encode(contenuto)),
    branch: CONFIG.ramo,
    ...(sha ? { sha } : {}),
  }
  const r = await richiesta(token, `/contents/${percorso}`, { method: 'PUT', body: JSON.stringify(corpo) })
  const dati = (await r.json()) as { content: { sha: string } }
  return dati.content.sha
}

/** Carica un allegato binario. Restituisce lo SHA del blob. */
export async function caricaAllegato(token: string, percorso: string, file: Blob, messaggio: string): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (token === TOKEN_DEMO) return demoScrivi(percorso, 'data:' + file.type + ';base64,' + codificaBase64(bytes), messaggio)
  const corpo = { message: messaggio, content: codificaBase64(bytes), branch: CONFIG.ramo }
  const r = await richiesta(token, `/contents/${percorso}`, { method: 'PUT', body: JSON.stringify(corpo) })
  const dati = (await r.json()) as { content: { sha: string } }
  return dati.content.sha
}

/** Scarica un allegato come Blob (qualunque dimensione fino a 100 MB). */
export async function scaricaAllegato(token: string, percorso: string): Promise<Blob> {
  if (token === TOKEN_DEMO) {
    const f = demoLeggi(percorso)
    if (!f) throw new ErroreGitHub('Allegato non trovato.', 404)
    return (await fetch(f.contenuto)).blob()
  }
  const meta = await richiesta(token, `/contents/${percorso}?ref=${CONFIG.ramo}`)
  const { sha } = (await meta.json()) as { sha: string }
  const blob = await richiesta(token, `/git/blobs/${sha}`, {}, 'application/vnd.github.raw+json')
  return blob.blob()
}

/** Elimina fisicamente un file. Se lo SHA non è noto lo legge prima (GitHub lo richiede per cancellare). */
export async function eliminaFile(token: string, percorso: string, sha: string, messaggio: string): Promise<void> {
  if (token === TOKEN_DEMO) { localStorage.removeItem(PREFISSO_DEMO + percorso); demoScrivi('_eliminazioni', sha, messaggio); return }
  if (!sha) {
    const meta = await richiesta(token, `/contents/${percorso}?ref=${CONFIG.ramo}`)
    sha = ((await meta.json()) as { sha: string }).sha
  }
  await richiesta(token, `/contents/${percorso}`, {
    method: 'DELETE',
    body: JSON.stringify({ message: messaggio, sha, branch: CONFIG.ramo }),
  })
}

/** Elenco degli ultimi commit (storico modifiche), opzionalmente filtrato per percorso. */
export async function listaCommit(token: string, percorso?: string, quanti = 50): Promise<Commit[]> {
  if (token === TOKEN_DEMO) return (JSON.parse(localStorage.getItem(PREFISSO_DEMO + '_commits') ?? '[]') as Commit[]).slice(0, quanti)
  const q = new URLSearchParams({ sha: CONFIG.ramo, per_page: String(quanti) })
  if (percorso) q.set('path', percorso)
  const r = await richiesta(token, `/commits?${q.toString()}`)
  const dati = (await r.json()) as Array<{ sha: string; commit: { message: string; author: { date: string; name: string } } }>
  return dati.map((c) => ({ sha: c.sha, messaggio: c.commit.message, data: c.commit.author.date, autore: c.commit.author.name }))
}

/** Legge un file com'era in un certo commit (per vedere versioni precedenti). */
export async function leggiFileAlCommit(token: string, percorso: string, sha: string): Promise<string> {
  const r = await richiesta(token, `/contents/${percorso}?ref=${sha}`, {}, 'application/vnd.github.raw+json')
  return r.text()
}

export interface SpazioOccupato {
  fonte: 'github' | 'browser'
  usato_byte: number
  limite_byte: number          // GitHub: limite consigliato (1 GB); browser: spazio disponibile (circa 5 MB)
}

/**
 * Spazio occupato dal repository dati. Su GitHub il valore comprende tutta la storia (anche i file eliminati)
 * e viene aggiornato da GitHub con qualche ritardo. In modalità dimostrativa: spazio usato nel browser.
 */
export async function spazioRepository(token: string): Promise<SpazioOccupato> {
  if (token === TOKEN_DEMO) {
    let caratteri = 0
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) ?? ''
      caratteri += k.length + (localStorage.getItem(k)?.length ?? 0)
    }
    // Chrome e Firefox concedono circa 5 milioni di caratteri per sito
    return { fonte: 'browser', usato_byte: caratteri, limite_byte: 5 * 1024 * 1024 }
  }
  const r = await richiesta(token, '')
  const { size } = (await r.json()) as { size: number }   // in KB
  return { fonte: 'github', usato_byte: size * 1024, limite_byte: 1024 * 1024 * 1024 }
}

/* ---------------------------- salvataggi dei colleghi ---------------------------- */

/** SHA dell'ultimo salvataggio sul ramo dei dati (una richiesta leggera): se cambia, qualcuno ha salvato. */
export async function ultimoCommit(token: string): Promise<string> {
  if (token === TOKEN_DEMO) return demoCommits()[0]?.sha ?? ''
  const r = await richiesta(token, `/git/ref/heads/${CONFIG.ramo}`)
  return ((await r.json()) as { object: { sha: string } }).object.sha
}

export interface Cambiamenti {
  file: Array<{ percorso: string; sha: string | null }>   // sha null = file eliminato
  messaggi: string[]                                       // messaggi dei salvataggi ("Nome: azione"), dal più vecchio
}

/**
 * File cambiati e messaggi dei salvataggi tra due commit. Lancia un errore se il confronto non è possibile
 * (es. storia riscritta con la compattazione): chi chiama ricarica tutto.
 */
export async function cambiamentiTra(token: string, da: string, a: string): Promise<Cambiamenti> {
  if (token === TOKEN_DEMO) {
    const tutti = demoCommits()
    const i = da ? tutti.findIndex((c) => c.sha === da) : tutti.length
    if (i < 0) throw new ErroreGitHub('Storico non confrontabile.', 0)
    const nuovi = tutti.slice(0, i).reverse()
    const percorsi = [...new Set(nuovi.flatMap((c) => c.percorsi ?? []))]
    return { file: percorsi.map((p) => ({ percorso: p, sha: demoLeggi(p)?.sha ?? null })), messaggi: nuovi.map((c) => c.messaggio) }
  }
  const r = await richiesta(token, `/compare/${da}...${a}`)
  const d = (await r.json()) as { files?: Array<{ filename: string; sha: string | null; status: string }>; commits: Array<{ commit: { message: string } }> }
  return {
    file: (d.files ?? []).map((f) => ({ percorso: f.filename, sha: f.status === 'removed' ? null : f.sha })),
    messaggi: d.commits.map((c) => c.commit.message.split('\n')[0]),
  }
}

/* ---------------------------- salvataggio di più file in un solo commit ---------------------------- */

/** Una modifica a un file: nuovo testo, nuovo file binario (allegato) o eliminazione. */
export type ModificaFile =
  | { percorso: string; testo: string }
  | { percorso: string; binario: Blob }
  | { percorso: string; elimina: true }

/** Vero se il file esiste al commit indicato. */
async function leggiMeta(token: string, percorso: string, ref: string): Promise<boolean> {
  try { await richiesta(token, `/contents/${percorso}?ref=${ref}`); return true } catch (e) { if (e instanceof ErroreGitHub && e.stato === 404) return false; throw e }
}

/** Ultimo commit del ramo dei dati e il suo albero dei file. */
export interface TestaRamo { commit: string; albero: string }

export async function testaRamo(token: string): Promise<TestaRamo> {
  if (token === TOKEN_DEMO) return { commit: demoCommits()[0]?.sha ?? '', albero: '' }
  const commit = await ultimoCommit(token)
  const c = await richiesta(token, `/git/commits/${commit}`)
  return { commit, albero: ((await c.json()) as { tree: { sha: string } }).tree.sha }
}

/** SHA che GitHub assegna a un file con questo contenuto (per aggiornare la memoria senza rileggere). */
export async function shaGit(bytes: Uint8Array): Promise<string> {
  const intestazione = new TextEncoder().encode(`blob ${bytes.length}\0`)
  const tutto = new Uint8Array(intestazione.length + bytes.length)
  tutto.set(intestazione); tutto.set(bytes, intestazione.length)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', tutto))
  return [...digest].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export interface EsitoCommit {
  sha: Map<string, string | null>   // nuovo SHA di ogni file scritto (null = eliminato)
  mancanti: string[]                // file da eliminare che non c'erano già più
}

/**
 * Scrive tutte le modifiche in UN SOLO commit sopra `base` (tutto o niente). Se nel frattempo qualcuno ha salvato
 * (il ramo non è più a `base`) lancia un ErroreGitHub con conflitto = true: chi chiama rilegge e riprova.
 */
export async function scriviCommit(token: string, base: TestaRamo, modifiche: ModificaFile[], messaggio: string): Promise<EsitoCommit> {
  const sha = new Map<string, string | null>()
  const mancanti: string[] = []
  if (token === TOKEN_DEMO) {
    if ((demoCommits()[0]?.sha ?? '') !== base.commit) throw new ErroreGitHub(messaggioPerStato(409), 409, true)
    for (const m of modifiche) {
      if ('elimina' in m) {
        if (localStorage.getItem(PREFISSO_DEMO + m.percorso) === null) mancanti.push(m.percorso)
        localStorage.removeItem(PREFISSO_DEMO + m.percorso); sha.set(m.percorso, null)
      } else {
        const contenuto = 'testo' in m ? m.testo : 'data:' + m.binario.type + ';base64,' + codificaBase64(new Uint8Array(await m.binario.arrayBuffer()))
        localStorage.setItem(PREFISSO_DEMO + m.percorso, contenuto); sha.set(m.percorso, impronta(contenuto))
      }
    }
    const commits = demoCommits()
    commits.unshift({ sha: crypto.randomUUID(), messaggio, data: new Date().toISOString(), autore: messaggio.split(':')[0], percorsi: modifiche.map((m) => m.percorso) })
    localStorage.setItem(PREFISSO_DEMO + '_commits', JSON.stringify(commits.slice(0, 200)))
    return { sha, mancanti }
  }

  // Le eliminazioni di file già assenti farebbero fallire tutto: si controlla prima quali file esistono
  let esistenti: Set<string> | null = null
  if (modifiche.some((m) => 'elimina' in m)) {
    const t = await richiesta(token, `/git/trees/${base.albero}?recursive=1`)
    const albero = (await t.json()) as { tree: Array<{ path: string }>; truncated?: boolean }
    esistenti = new Set(albero.tree.map((x) => x.path))
    if (albero.truncated) {
      // Elenco incompleto (repository enorme): si controlla un file alla volta
      for (const m of modifiche) if ('elimina' in m && !esistenti.has(m.percorso) && await leggiMeta(token, m.percorso, base.commit)) esistenti.add(m.percorso)
    }
  }
  const voci: Array<Record<string, unknown>> = []
  for (const m of modifiche) {
    if ('elimina' in m) {
      if (!esistenti?.has(m.percorso)) { mancanti.push(m.percorso); continue }
      voci.push({ path: m.percorso, mode: '100644', type: 'blob', sha: null }); sha.set(m.percorso, null)
    } else if ('testo' in m) {
      voci.push({ path: m.percorso, mode: '100644', type: 'blob', content: m.testo })
      sha.set(m.percorso, await shaGit(new TextEncoder().encode(m.testo)))
    } else {
      const bytes = new Uint8Array(await m.binario.arrayBuffer())
      const b = await richiesta(token, '/git/blobs', { method: 'POST', body: JSON.stringify({ content: codificaBase64(bytes), encoding: 'base64' }) })
      const blobSha = ((await b.json()) as { sha: string }).sha
      voci.push({ path: m.percorso, mode: '100644', type: 'blob', sha: blobSha }); sha.set(m.percorso, blobSha)
    }
  }
  if (!voci.length) return { sha, mancanti }
  const t = await richiesta(token, '/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: base.albero, tree: voci }) })
  const albero = ((await t.json()) as { sha: string }).sha
  const c = await richiesta(token, '/git/commits', { method: 'POST', body: JSON.stringify({ message: messaggio, tree: albero, parents: [base.commit] }) })
  const commit = ((await c.json()) as { sha: string }).sha
  try {
    await richiesta(token, `/git/refs/heads/${CONFIG.ramo}`, { method: 'PATCH', body: JSON.stringify({ sha: commit, force: false }) })
  } catch (e) {
    // "not a fast forward": un collega ha salvato dopo la lettura → conflitto, si riprova sui dati aggiornati
    if (e instanceof ErroreGitHub && e.stato === 422) throw new ErroreGitHub(messaggioPerStato(409), 409, true)
    throw e
  }
  return { sha, mancanti }
}
