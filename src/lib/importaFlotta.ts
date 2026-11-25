/**
 * Caricamento iniziale della Flotta dai vecchi Excel delle vetture ("Prospetto Vetture.xlsx" e "Scadenza Bolli
 * Vetture.xlsx", fermi al 2023). Ogni foglio contiene più blocchi uno sotto l'altro (proprietà, noleggio, leasing) e un
 * gruppo di colonne a destra con le vetture vendute. Le vetture si uniscono per targa; tutte restano "da verificare".
 * Regole: docs/superpowers/specs/2026-11-25-flotta-aziendale-design.md §8 (cartella principale del progetto).
 */
import { contribuenteNelTesto, normalizzaNome } from './importaTributi'
import { normalizzaTarga, nuovoVeicolo } from './flotta'
import { attivi } from './store'
import type { Contribuente, Possesso, TipoScadenza, Veicolo } from './tipi'
import { giorniDelMese } from './utils/date'
import { formattaData } from './utils/formato'

export interface AnteprimaFlotta { veicoli: Veicolo[]; doppioni: string[]; avvisi: string[] }
export interface FoglioFlotta { nome: string; righe: unknown[][] }

/* ---------------------------- celle ---------------------------- */

const due = (n: number) => String(n).padStart(2, '0')
const GIORNO_MS = 86_400_000
const ORIGINE_EXCEL = Date.UTC(1899, 11, 30)
const SERIE_MINIMA = 20000          // numeri di serie sotto questa soglia non sono date credibili (prima del 1954)
const ANNO_MIN = 1900, ANNO_MAX = 2100

/**
 * Data di una cella: numero di serie Excel, data JavaScript (letta con l'ora italiana: le celle arrivano come
 * mezzanotte locale, es. 2023-10-30T23:00Z = 31/10/2023), testo gg/mm/aaaa o AAAA-MM-GG. Le date impossibili
 * ("31/09/2023"), gli anni (2025) e gli altri testi restano testo. Null per le celle vuote.
 */
export function dataDaCella(v: unknown): { data: string } | { testo: string } | null {
  if (v === null || v === undefined || v === '' || v === 0) return null
  if (v instanceof Date) return { data: `${v.getFullYear()}-${due(v.getMonth() + 1)}-${due(v.getDate())}` }
  if (typeof v === 'number') {
    if (Number.isInteger(v) && v >= ANNO_MIN && v <= ANNO_MAX) return { testo: String(v) }
    if (v < SERIE_MINIMA) return { testo: String(v) }
    return { data: new Date(ORIGINE_EXCEL + Math.round(v) * GIORNO_MS).toISOString().slice(0, 10) }
  }
  const t = String(v).trim()
  if (!t) return null
  const it = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (it) {
    const [g, m, a] = [Number(it[1]), Number(it[2]), Number(it[3])]
    if (m < 1 || m > 12 || g < 1 || g > giorniDelMese(a, m)) return { testo: t }
    return { data: `${a}-${due(m)}-${due(g)}` }
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return { data: t.slice(0, 10) }
  return { testo: t }
}

const testo = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim())
const vuota = (v: unknown) => testo(v) === ''

/* ---------------------------- blocchi dei fogli ---------------------------- */

type Campo = 'societa' | 'modello' | 'targa' | 'bollo' | 'superbollo' | 'importo' | 'revisione' | 'assicurazione' | 'fine_contratto' | 'data_fine' | 'nota'
type TipoBlocco = 'proprieta' | 'noleggio' | 'leasing'
interface Gruppo { riga: number; c0: number; c1: number; colonne: Map<number, Campo>; tipo: TipoBlocco; vendute: boolean }

const PAROLE_TITOLO = /propriet|noleggio|leasing|vendut|panoramica/
/** Testo che voleva essere una data (es. "31/09/2023", giorno inesistente): va nelle note, non è un motivo. */
const SEMBRA_DATA = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/

function campoDi(intestazione: string): Campo {
  const t = normalizzaNome(intestazione)
  if (t.includes('superbollo')) return 'superbollo'
  if (t.includes('bollo')) return 'bollo'
  if (t.includes('revision')) return 'revisione'
  if (t.includes('assicuraz')) return 'assicurazione'
  if (t.includes('noleggio') || t.includes('contratto') || t.includes('leasing')) return 'fine_contratto'
  if (t.startsWith('societ')) return 'societa'
  if (t.includes('vettur') || t.includes('veicol')) return 'modello'
  if (t.startsWith('targ')) return 'targa'
  if (t === 'importo') return 'importo'
  return 'nota'
}

/** Tratti di colonne con celle piene consecutive in una riga. */
function segmenti(riga: unknown[]): Array<[number, number]> {
  const out: Array<[number, number]> = []
  let inizio = -1
  for (let c = 0; c <= riga.length; c++) {
    const piena = c < riga.length && !vuota(riga[c])
    if (piena && inizio < 0) inizio = c
    if (!piena && inizio >= 0) { out.push([inizio, c - 1]); inizio = -1 }
  }
  return out
}

const eIntestazione = (riga: unknown[], c0: number, c1: number) => riga.slice(c0, c1 + 1).some((v) => normalizzaNome(v).startsWith('targ'))
const sovrapposti = (a0: number, a1: number, b0: number, b1: number) => a0 <= b1 && b0 <= a1

/** Titolo del blocco (proprietà, noleggio, leasing, vendute) nelle righe appena sopra l'intestazione. */
function titoloSopra(righe: unknown[][], r: number, c0: number, c1: number): { tipo: TipoBlocco; vendute: boolean } {
  let tipo: TipoBlocco = 'proprieta', vendute = false
  for (let i = r; i >= Math.max(0, r - 3); i--) {
    const testi = (righe[i] ?? []).slice(c0, c1 + 1).map(normalizzaNome).filter((t) => PAROLE_TITOLO.test(t))
    for (const t of testi) {
      if (t.includes('vendut')) vendute = true
      else if (t.includes('noleggio')) tipo = 'noleggio'
      else if (t.includes('leasing')) tipo = 'leasing'
    }
    if (testi.length && i < r) break
  }
  return { tipo, vendute }
}

function gruppiDelFoglio(righe: unknown[][]): Gruppo[] {
  const gruppi: Gruppo[] = []
  righe.forEach((riga, r) => {
    for (const [c0, c1] of segmenti(riga)) {
      if (eIntestazione(riga, c0, c1)) {
        const colonne = new Map<number, Campo>()
        for (let c = c0; c <= c1; c++) colonne.set(c, campoDi(testo(riga[c])))
        gruppi.push({ riga: r, c0, c1, colonne, ...titoloSopra(righe, r, c0, c1) })
        continue
      }
      // "Vetture vendute" senza intestazione propria: colonne nell'ordine veicolo, targa, società, data
      const ultimo = c1 + 3
      const conTitoloVendute = riga.slice(c0, c1 + 1).some((v) => normalizzaNome(v).includes('vendut'))
      const intestazioneSotto = righe.slice(r + 1, r + 4).some((rr) => segmenti(rr).some(([a, b]) => sovrapposti(a, b, c0, ultimo) && eIntestazione(rr, a, b)))
      if (conTitoloVendute && !intestazioneSotto) {
        const campi: Campo[] = ['modello', 'targa', 'societa', 'data_fine']
        gruppi.push({ riga: r, c0, c1: ultimo, colonne: new Map(campi.map((k, i) => [c0 + i, k])), tipo: 'proprieta', vendute: true })
      }
    }
  })
  return gruppi
}

/** Righe di dati di un gruppo: fino alla prossima intestazione o al prossimo titolo nelle stesse colonne. */
function righeDelGruppo(righe: unknown[][], g: Gruppo): unknown[][] {
  const out: unknown[][] = []
  for (let r = g.riga + 1; r < righe.length; r++) {
    const riga = righe[r] ?? []
    const celle = riga.slice(g.c0, g.c1 + 1)
    if (celle.every(vuota)) continue
    if (segmenti(riga).some(([a, b]) => sovrapposti(a, b, g.c0, g.c1) && eIntestazione(riga, a, b))) break
    const piene = celle.filter((v) => !vuota(v))
    if (piene.length === 1 && PAROLE_TITOLO.test(normalizzaNome(piene[0]))) break
    out.push(riga)
  }
  return out
}

/* ---------------------------- vetture grezze ---------------------------- */

type CampoData = 'bollo' | 'revisione' | 'assicurazione' | 'fine_contratto'
const ETICHETTE: Record<CampoData, string> = { bollo: 'Bollo', revisione: 'Revisione', assicurazione: 'Assicurazione', fine_contratto: 'Fine contratto' }

interface Societa { id: string; testo: string }
interface Grezza {
  targa: string
  modello: string
  societa: Societa[]
  possesso: Possesso
  finanziaria: string
  venduta: boolean
  data_fine: string
  date: Record<CampoData, string[]>
  non_dovuta: string[]
  importo_cent: number | null
  superbollo_cent: number | null
  note: string[]
}

const FINANZIARIE_NOLEGGIO = /\b(ald|leasys|ayvens|arval|leaseplan)\b/

/** "Ufficio Alfa (ALD)" → società "Ufficio Alfa", finanziaria "ALD"; "Ufficio Beta (venduta)" → venduta. */
function leggiSocieta(v: unknown, contribuenti: Contribuente[]): { societa: Societa | null; finanziaria: string; venduta: boolean } {
  const t = testo(v)
  const tra = [...t.matchAll(/\(([^)]*)\)/g)].map((m) => m[1].trim())
  const base = t.replace(/\([^)]*\)/g, '').trim()
  const venduta = tra.some((x) => /vendut/i.test(x))
  const finanziaria = tra.find((x) => !/vendut/i.test(x)) ?? ''
  if (!base) return { societa: null, finanziaria, venduta }
  const c = contribuenteNelTesto(base, contribuenti)
  return { societa: { id: c?.id ?? '', testo: base }, finanziaria, venduta }
}

const chiaveSocieta = (s: Societa | undefined) => (s ? s.id || normalizzaNome(s.testo) : '')
/** Stessa società anche se scritta abbreviata ("Gruppo Prova Mot." e "Gruppo Prova Motori"). */
function stessaSocieta(a: Societa, b: Societa): boolean {
  if (a.id && b.id) return a.id === b.id
  const [x, y] = [normalizzaNome(a.testo), normalizzaNome(b.testo)]
  return x.startsWith(y) || y.startsWith(x)
}
const importoCent = (v: unknown) => (typeof v === 'number' && v > 0 ? Math.round(v * 100) : null)
const eNo = (v: unknown) => normalizzaNome(v) === 'no'

function vuotaGrezza(targa: string): Grezza {
  return { targa, modello: '', societa: [], possesso: 'proprieta', finanziaria: '', venduta: false, data_fine: '', date: { bollo: [], revisione: [], assicurazione: [], fine_contratto: [] }, non_dovuta: [], importo_cent: null, superbollo_cent: null, note: [] }
}

/** Unisce in `g` i dati di una riga (anche senza targa). */
function unisciRiga(g: Grezza, riga: unknown[], gr: Gruppo, soc: ReturnType<typeof leggiSocieta>) {
  const aggiungiNota = (n: string) => { if (n && !g.note.includes(n)) g.note.push(n) }
  for (const [c, campo] of gr.colonne) {
    const v = riga[c]
    if (vuota(v)) continue
    switch (campo) {
      case 'modello': if (testo(v).length > g.modello.length) g.modello = testo(v); break
      case 'bollo': case 'revisione': case 'assicurazione': case 'fine_contratto': {
        const d = dataDaCella(v)
        if (!d) break
        if ('data' in d) g.date[campo].push(d.data)
        else if (campo === 'bollo' && !SEMBRA_DATA.test(d.testo)) { if (!g.non_dovuta.includes(d.testo)) g.non_dovuta.push(d.testo) }
        else aggiungiNota(`${ETICHETTE[campo]} nel file: ${d.testo}`)
        break
      }
      case 'data_fine': { const d = dataDaCella(v); if (d && 'data' in d && d.data > g.data_fine) g.data_fine = d.data; break }
      case 'superbollo': {
        if (eNo(v)) break
        const imp = importoCent(v)
        if (imp) g.superbollo_cent = imp
        else if (typeof v !== 'number' && !g.non_dovuta.includes(testo(v))) aggiungiNota(`Superbollo nel file: ${testo(v)}`)
        break
      }
      case 'importo': { const imp = importoCent(v); if (imp) g.importo_cent = imp; break }
      case 'nota': if (typeof v !== 'number') aggiungiNota(testo(v)); break
      default: break
    }
  }
  if (soc.societa) {
    const uguale = g.societa.findIndex((s) => stessaSocieta(s, soc.societa!))
    if (uguale < 0) g.societa.push(soc.societa)
    else if (!g.societa[uguale].id && soc.societa.id) g.societa[uguale] = soc.societa   // si tiene quella abbinata
  }
  if (soc.finanziaria && !g.finanziaria) g.finanziaria = soc.finanziaria
  if (gr.vendute || soc.venduta) g.venduta = true
  const possesso: Possesso = gr.tipo === 'proprieta' ? 'proprieta'
    : gr.tipo === 'noleggio' || FINANZIARIE_NOLEGGIO.test(normalizzaNome(g.finanziaria)) ? 'noleggio' : 'leasing'
  if (possesso !== 'proprieta') g.possesso = possesso
}

/* ---------------------------- confronti tra targhe ---------------------------- */

function distanza(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  }
  return d[a.length][b.length]
}
/** "W" scritta al posto di "VV" (e viceversa) è l'errore di battitura più comune sulle targhe. */
const formaTarga = (t: string) => t.replace(/W/g, 'VV')
const primaParola = (s: string) => normalizzaNome(s).split(' ')[0] ?? ''

/* ---------------------------- lettura completa ---------------------------- */

/** Legge le righe dei fogli (già estratte dal file) e prepara le vetture da caricare. */
export function analizzaRigheFlotta(fogli: FoglioFlotta[], contribuenti: Contribuente[], esistenti: Veicolo[], utente: string): AnteprimaFlotta {
  const avvisi: string[] = []
  const grezze = new Map<string, Grezza>()
  const senzaTarga: Array<{ riga: unknown[]; gruppo: Gruppo; soc: ReturnType<typeof leggiSocieta>; modello: string; societaTesto: string }> = []

  for (const foglio of fogli) {
    for (const gr of gruppiDelFoglio(foglio.righe)) {
      const colDi = (k: Campo) => [...gr.colonne].find(([, v]) => v === k)?.[0]
      const cSoc = colDi('societa'), cTarga = colDi('targa'), cMod = colDi('modello')
      let ultimaSocieta: unknown = ''
      for (const riga of righeDelGruppo(foglio.righe, gr)) {
        if (cSoc !== undefined && !vuota(riga[cSoc])) ultimaSocieta = riga[cSoc]
        const targa = cTarga !== undefined ? normalizzaTarga(testo(riga[cTarga])) : ''
        const modello = cMod !== undefined ? testo(riga[cMod]) : ''
        if (!targa && !modello) continue    // righe di totale o vuote
        const soc = leggiSocieta(ultimaSocieta, contribuenti)
        if (!targa) { senzaTarga.push({ riga, gruppo: gr, soc, modello, societaTesto: testo(ultimaSocieta) }); continue }
        const g = grezze.get(targa) ?? vuotaGrezza(targa)
        grezze.set(targa, g)
        unisciRiga(g, riga, gr, soc)
      }
    }
  }

  // Righe senza targa: si uniscono alla vettura della stessa società con lo stesso modello, se è una sola
  for (const s of senzaTarga) {
    const chiave = chiaveSocieta(s.soc.societa ?? undefined)
    const mod = normalizzaNome(s.modello)
    const candidate = [...grezze.values()].filter((g) => {
      const m = normalizzaNome(g.modello)
      return chiave && g.societa.some((x) => chiaveSocieta(x) === chiave) && m && (m.includes(mod) || mod.includes(m))
    })
    if (candidate.length === 1) unisciRiga(candidate[0], s.riga, s.gruppo, s.soc)
    else avvisi.push(`Riga senza targa non caricata: ${s.modello} (${s.societaTesto || 'società non indicata'}) — aggiungerla a mano se serve`)
  }

  // Targhe quasi uguali della stessa vettura (stessa società e marca)
  const elenco = [...grezze.values()]
  for (let i = 0; i < elenco.length; i++) for (let j = i + 1; j < elenco.length; j++) {
    const a = elenco[i], b = elenco[j]
    const stessaSocieta = a.societa.some((x) => b.societa.some((y) => chiaveSocieta(x) === chiaveSocieta(y)))
    if (stessaSocieta && primaParola(a.modello) === primaParola(b.modello) && distanza(formaTarga(a.targa), formaTarga(b.targa)) <= 1) {
      avvisi.push(`Possibile errore di battitura: ${a.targa} / ${b.targa} (${a.modello}, ${a.societa[0]?.testo ?? ''}) — se sono la stessa vettura, eliminarne una dopo il caricamento`)
    }
  }

  // Società diverse per la stessa targa e società da abbinare
  const daAbbinare = new Map<string, number>()
  for (const g of elenco) {
    if (g.societa.length > 1) {
      const nomi = g.societa.map((s) => s.testo).join(' / ')
      avvisi.push(`Società diversa nei file per ${g.targa}: ${nomi} — tenuta ${(g.societa.find((s) => s.id) ?? g.societa[0]).testo}`)
      g.note.push(`Società nei file: ${nomi}`)
    }
    const scelta = g.societa.find((s) => s.id) ?? g.societa[0]
    if (scelta && !scelta.id) daAbbinare.set(scelta.testo, (daAbbinare.get(scelta.testo) ?? 0) + 1)
  }
  for (const [nome, n] of daAbbinare) {
    avvisi.push(`Società da abbinare: ${nome} (${n} ${n === 1 ? 'vettura' : 'vetture'}) — non è tra gli uffici dei Tributi: aggiungerla lì oppure abbinarla nella scheda della vettura`)
  }

  const presenti = new Set(attivi(esistenti).map((v) => normalizzaTarga(v.targa)))
  const doppioni = elenco.filter((g) => presenti.has(g.targa)).map((g) => g.targa)
  const veicoli = elenco.filter((g) => !presenti.has(g.targa)).map((g) => costruisci(g, utente))
  return { veicoli, doppioni, avvisi }
}

/** Data più recente; le altre (diverse) finiscono nelle note. */
function piuRecente(g: Grezza, campo: CampoData): string {
  const date = [...new Set(g.date[campo])].sort()
  const scelta = date[date.length - 1] ?? ''
  if (date.length > 1) g.note.push(`${ETICHETTE[campo]}: nel file anche ${date.slice(0, -1).map(formattaData).join(', ')}`)
  return scelta
}

function costruisci(g: Grezza, utente: string): Veicolo {
  const v = nuovoVeicolo(utente)
  const societa = g.societa.find((s) => s.id) ?? g.societa[0]
  const data_fine = g.venduta ? g.data_fine : ''
  const date: Record<CampoData, string> = { bollo: piuRecente(g, 'bollo'), revisione: piuRecente(g, 'revisione'), assicurazione: piuRecente(g, 'assicurazione'), fine_contratto: piuRecente(g, 'fine_contratto') }
  if (g.non_dovuta.length > 1) g.note.push(`Bollo nel file: ${g.non_dovuta.slice(1).join(' / ')}`)
  const scadenze = v.scadenze.map((s) => {
    const tipo = s.tipo as Exclude<TipoScadenza, 'altro'>
    if (tipo === 'bollo') return { ...s, scadenza: date.bollo, non_dovuta: g.non_dovuta[0] ?? '', importo_cent: g.importo_cent, superbollo_cent: g.superbollo_cent }
    if (tipo === 'revisione' || tipo === 'assicurazione') return { ...s, scadenza: date[tipo] }
    return s
  })
  return {
    ...v, targa: g.targa, modello: g.modello, possesso: g.possesso, stato: g.venduta ? 'venduta' : 'in_uso', data_fine,
    intestazioni: societa ? [{ contribuente_id: societa.id, intestatario_testo: societa.id ? '' : societa.testo, dal: '', al: data_fine }] : [],
    contratto: g.possesso === 'proprieta' ? null : {
      societa_finanziaria: g.finanziaria, numero: '', decorrenza: '', scadenza: date.fine_contratto, canone_mensile_cent: null, anticipo_cent: null,
      riscatto_cent: null, km_inclusi: null, bollo_incluso: '', assicurazione_inclusa: '',
    },
    scadenze, da_verificare: true, note: g.note.join('; '),
  }
}

/** Legge i file Excel scelti (uno o entrambi) e prepara l'anteprima del caricamento. */
export async function analizzaExcelFlotta(file: { nome: string; buffer: ArrayBuffer }[], contribuenti: Contribuente[], esistenti: Veicolo[], utente: string): Promise<AnteprimaFlotta> {
  const XLSX = await import('xlsx') // caricata solo quando serve
  const fogli: FoglioFlotta[] = file.flatMap((f) => {
    const wb = XLSX.read(f.buffer, { type: 'array' })
    return wb.SheetNames.map((n) => ({ nome: `${f.nome} / ${n}`, righe: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1, defval: '', raw: true }) }))
  })
  return analizzaRigheFlotta(fogli, contribuenti, esistenti, utente)
}
