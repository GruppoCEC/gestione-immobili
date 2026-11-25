/**
 * Flotta aziendale: calcoli sulle vetture (scadenze e rinnovi, intestazioni e conducenti nel tempo, avvisi delle multe,
 * proiezione dei km, filtri e riepiloghi). Funzioni pure: ricevono i dati e restituiscono copie nuove.
 * Progetto: docs/superpowers/specs/2026-11-25-flotta-aziendale-design.md (cartella principale del progetto).
 */
import { normalizzaNome } from './importaTributi'
import { campiNuovo, nuovoId } from './store'
import { POSSESSI, STATI_MULTA, STATI_VEICOLO, TIPI_MULTA, etichettaDi, type Contribuente, type Intestazione, type MultaVeicolo, type Possesso, type ScadenzaVeicolo, type StatoVeicolo, type TipoScadenza, type Veicolo } from './tipi'
import { aggiungiGiorni, fineMeseDopo, giorniTra } from './utils/date'
import { aggiungiMesi, formattaData } from './utils/formato'

/** Giorni prima della scadenza in cui la voce diventa gialla. */
export const GIORNI_PREAVVISO_FLOTTA = 30
/** Scheda Scadenze: oltre alle scadute si mostrano quelle entro questi giorni (salvo "Mostra tutte"). */
export const GIORNI_ORIZZONTE_SCADENZE = 90
const MESI_RINNOVO_ANNUALE = 12
const MESI_REVISIONE = 24
const MESI_PRIMA_REVISIONE = 48
const GIORNI_PAGAMENTO_MULTA = 60
const GIORNI_PAGAMENTO_RIDOTTO = 5
const GIORNI_COMUNICAZIONE_CONDUCENTE = 60
const INIZIO_TEMPI = '0000-01-01'
const FINE_TEMPI = '9999-12-31'

/* ---------------------------- targa e nomi ---------------------------- */

/** Targa per confronti e salvataggio: maiuscolo, senza spazi, trattini e punti ("ab-123.cd" → "AB123CD"). */
export function normalizzaTarga(s: string): string {
  return String(s ?? '').toUpperCase().replace(/[\s.\-_/]/g, '')
}

/* ---------------------------- intestazioni e conducenti ---------------------------- */

const inPeriodo = (data: string, dal: string, al: string) => (dal || INIZIO_TEMPI) <= data && data <= (al || FINE_TEMPI)

/** Intestazione in corso (senza `al`); se sono tutte chiuse (vettura passata), la più recente. */
export function intestazioneAttuale(v: Veicolo): Intestazione | null {
  const elenco = v.intestazioni ?? []
  const aperta = elenco.find((i) => !i.al)
  if (aperta) return aperta
  return [...elenco].sort((a, b) => (b.al || b.dal).localeCompare(a.al || a.dal))[0] ?? null
}

/** Società intestataria a una certa data (`dal` vuoto = valida da sempre). Null se la data cade in un periodo scoperto. */
export function intestazioneAl(v: Veicolo, data: string): Intestazione | null {
  return (v.intestazioni ?? []).find((i) => inPeriodo(data, i.dal, i.al)) ?? null
}

/** Chi aveva in uso la vettura a una certa data ('' se non indicato). */
export function conducenteAl(v: Veicolo, data: string): string {
  return (v.conducenti ?? []).find((c) => inPeriodo(data, c.dal, c.al))?.nome ?? ''
}

/** Nome da mostrare per un'intestazione: nome dell'ufficio, "da abbinare: <nome nel file>" oppure "—". */
export function nomeIntestatario(i: Intestazione | null, contribuenti: Contribuente[]): string {
  if (!i) return '—'
  const c = i.contribuente_id ? contribuenti.find((x) => x.id === i.contribuente_id) : undefined
  if (c) return c.nome
  return i.intestatario_testo ? `da abbinare: ${i.intestatario_testo}` : '—'
}

/** Passaggio a un'altra società dal giorno `dal`: l'intestazione in corso si chiude il giorno prima. */
export function cambiaIntestazione(v: Veicolo, contribuente_id: string, dal: string): Veicolo {
  const attuale = (v.intestazioni ?? []).find((i) => !i.al)
  if (attuale?.dal && dal <= attuale.dal) {
    throw new Error(`La data del passaggio deve essere successiva al ${formattaData(attuale.dal)}, inizio dell'intestazione attuale.`)
  }
  const chiuse = (v.intestazioni ?? []).map((i) => (i === attuale ? { ...i, al: aggiungiGiorni(dal, -1) } : i))
  return { ...v, intestazioni: [...chiuse, { contribuente_id, intestatario_testo: '', dal, al: '' }] }
}

/** Vendita, restituzione o altra uscita: cambia lo stato e chiude l'intestazione in corso alla data di uscita. */
export function registraUscita(v: Veicolo, u: { stato: Exclude<StatoVeicolo, 'in_uso'>; data_fine: string; uscita_note: string }): Veicolo {
  return {
    ...v, stato: u.stato, data_fine: u.data_fine, uscita_note: u.uscita_note,
    intestazioni: (v.intestazioni ?? []).map((i) => (i.al ? i : { ...i, al: u.data_fine })),
  }
}

/* ---------------------------- nuove schede ---------------------------- */

const vocePronta = (tipo: TipoScadenza): ScadenzaVeicolo => ({ id: nuovoId(), tipo, descrizione: '', scadenza: '', importo_cent: null, non_dovuta: '', rinnovo_mesi: null, storico: [] })

/** Voci fisse di ogni nuova vettura (la fine del contratto si ricava dal contratto di leasing/noleggio). */
export function scadenzeStandard(): ScadenzaVeicolo[] {
  return (['bollo', 'revisione', 'assicurazione', 'tagliando'] as const).map(vocePronta)
}

export function nuovoVeicolo(utente: string): Veicolo {
  return {
    ...campiNuovo(utente), intestazioni: [], marca: '', modello: '', targa: '', telaio: '', alimentazione: '', data_immatricolazione: '',
    possesso: 'proprieta', stato: 'in_uso', data_inizio: '', data_fine: '', uscita_note: '', contratto: null, conducenti: [],
    scadenze: scadenzeStandard(), km: [], coperture: [], da_verificare: false, note: '',
  }
}

export function nuovaMulta(utente: string, veicolo_id: string): MultaVeicolo {
  return {
    ...campiNuovo(utente), veicolo_id, tipo: 'multa', ente: '', numero_verbale: '', data_fatto: '', anno_riferimento: null, data_notifica: '',
    scadenza_pagamento: '', scadenza_ridotta: '', scadenza_conducente: '', conducente_comunicato: false, importo_cent: null,
    importo_ridotto_cent: null, spese_rinotifica_cent: null, conducente: '', stato: 'da_pagare', data_pagamento: '', note: '',
  }
}

/* ---------------------------- scadenze ---------------------------- */

/** Prima revisione: entro la fine del mese di immatricolazione, 4 anni dopo. */
export function primaRevisione(data_immatricolazione: string): string {
  return fineMeseDopo(data_immatricolazione, MESI_PRIMA_REVISIONE)
}

/** Scadenza successiva proposta quando una voce viene segnata come fatta/pagata il giorno `data_fatto` ('' = nessun rinnovo). */
export function propostaRinnovo(voce: ScadenzaVeicolo, data_fatto: string): string {
  switch (voce.tipo) {
    case 'bollo':
    case 'assicurazione': return aggiungiMesi(voce.scadenza || data_fatto, MESI_RINNOVO_ANNUALE)
    case 'tagliando': return aggiungiMesi(data_fatto, MESI_RINNOVO_ANNUALE)
    case 'revisione': return fineMeseDopo(data_fatto, MESI_REVISIONE)
    default: return voce.rinnovo_mesi ? aggiungiMesi(voce.scadenza || data_fatto, voce.rinnovo_mesi) : ''
  }
}

/** Segna fatta/pagata una voce: la scadenza attuale va nello storico e si imposta la nuova. */
export function segnaFatta(v: Veicolo, voceId: string, e: { data_fatto: string; importo_cent: number | null; note: string; nuova_scadenza: string }): Veicolo {
  return {
    ...v,
    scadenze: v.scadenze.map((s) => (s.id !== voceId ? s : {
      ...s, scadenza: e.nuova_scadenza,
      storico: [...(s.storico ?? []), { data_fatto: e.data_fatto, scadenza_coperta: s.scadenza, importo_cent: e.importo_cent, note: e.note }],
    })),
  }
}

/** Colore e testo di una scadenza: rossa se scaduta, gialla nei 30 giorni prima (oggi compreso), altrimenti grigia. */
export function statoScadenza(scadenza: string, oggi: string): { tono: 'rosso' | 'giallo' | 'grigio'; testo: string; giorni: number | null } {
  if (!scadenza) return { tono: 'grigio', testo: 'non indicata', giorni: null }
  const giorni = giorniTra(oggi, scadenza)
  if (giorni < 0) return { tono: 'rosso', testo: `scaduta da ${-giorni} gg`, giorni }
  if (giorni === 0) return { tono: 'giallo', testo: 'scade oggi', giorni }
  return { tono: giorni <= GIORNI_PREAVVISO_FLOTTA ? 'giallo' : 'grigio', testo: `tra ${giorni} gg`, giorni }
}

export interface RigaScadenza {
  veicolo: Veicolo
  tipo: TipoScadenza | 'fine_contratto' | 'copertura' | 'multa_pagamento' | 'multa_conducente'
  etichetta: string
  scadenza: string
  voceId?: string
  multa?: MultaVeicolo
}

const ETICHETTE_VOCE: Record<TipoScadenza, string> = { bollo: 'Bollo', revisione: 'Revisione', assicurazione: 'Assicurazione RCA', tagliando: 'Tagliando', altro: 'Altro' }

/** Etichetta di una voce di scadenza (per le voci libere la descrizione). */
export function etichettaVoce(s: ScadenzaVeicolo): string {
  return s.tipo === 'altro' ? (s.descrizione || 'Altra scadenza') : ETICHETTE_VOCE[s.tipo]
}

/** Scadenze da seguire di una vettura in uso: voci dovute con data, fine contratto, coperture con scadenza. */
export function scadenzeDelVeicolo(v: Veicolo): RigaScadenza[] {
  if (v.stato !== 'in_uso') return []
  const righe: RigaScadenza[] = (v.scadenze ?? []).filter((s) => !s.non_dovuta && s.scadenza)
    .map((s) => ({ veicolo: v, tipo: s.tipo, etichetta: etichettaVoce(s), scadenza: s.scadenza, voceId: s.id }))
  if (v.possesso !== 'proprieta' && v.contratto?.scadenza) {
    righe.push({ veicolo: v, tipo: 'fine_contratto', etichetta: v.possesso === 'leasing' ? 'Fine leasing' : 'Fine noleggio', scadenza: v.contratto.scadenza })
  }
  for (const c of v.coperture ?? []) {
    if (c.scadenza) righe.push({ veicolo: v, tipo: 'copertura', etichetta: `Copertura: ${c.tipo === 'altro' ? (c.note || 'altro') : c.tipo.replace(/_/g, ' ')}`, scadenza: c.scadenza, voceId: c.id })
  }
  return righe.sort((a, b) => a.scadenza.localeCompare(b.scadenza))
}

export function prossimaScadenza(v: Veicolo): RigaScadenza | null {
  return scadenzeDelVeicolo(v)[0] ?? null
}

/**
 * Elenco unico delle scadenze della flotta: voci delle vetture in uso, multe da pagare e dati del conducente da
 * comunicare (anche per le vetture passate: la multa va comunque pagata o contestata). Se `!tutte`: solo le scadute e
 * quelle entro 90 giorni. Ordine per data.
 */
export function scadenzeAperte(veicoli: Veicolo[], multe: MultaVeicolo[], oggi: string, tutte: boolean): RigaScadenza[] {
  const righe = veicoli.flatMap(scadenzeDelVeicolo)
  const perId = new Map(veicoli.map((v) => [v.id, v]))
  for (const m of multe) {
    const v = perId.get(m.veicolo_id)
    if (!v) continue
    if (m.stato === 'da_pagare' && m.scadenza_pagamento) righe.push({ veicolo: v, tipo: 'multa_pagamento', etichetta: m.tipo === 'cartella_bollo' ? 'Pagare cartella bollo' : 'Pagare multa', scadenza: m.scadenza_pagamento, multa: m })
    if (m.stato !== 'annullata' && m.scadenza_conducente && !m.conducente_comunicato) righe.push({ veicolo: v, tipo: 'multa_conducente', etichetta: 'Comunicare il conducente', scadenza: m.scadenza_conducente, multa: m })
  }
  const limite = aggiungiGiorni(oggi, GIORNI_ORIZZONTE_SCADENZE)
  return righe.filter((r) => tutte || r.scadenza <= limite).sort((a, b) => a.scadenza.localeCompare(b.scadenza))
}

/* ---------------------------- multe ---------------------------- */

/** Data a cui si riferisce la multa: data del fatto, oppure 1° gennaio dell'anno del bollo (cartelle). */
export function dataRiferimentoMulta(m: MultaVeicolo): string {
  if (m.data_fatto) return m.data_fatto
  return m.anno_riferimento ? `${m.anno_riferimento}-01-01` : ''
}

/** Avvisi di una multa: vettura già uscita o non ancora arrivata (da contestare), intestataria diversa da quella attuale. */
export function avvisiMulta(m: MultaVeicolo, v: Veicolo, contribuenti: Contribuente[]): { tipo: 'errore' | 'attenzione'; testo: string }[] {
  const data = dataRiferimentoMulta(m)
  if (!data) return []
  if (v.data_fine && data > v.data_fine) {
    const uscita = v.stato === 'restituita' ? 'restituita' : v.stato === 'venduta' ? 'venduta' : 'uscita dal gruppo'
    return [{ tipo: 'errore', testo: `Alla data del fatto la vettura era già ${uscita} il ${formattaData(v.data_fine)}${v.uscita_note ? ` (a: ${v.uscita_note})` : ''} → da contestare` }]
  }
  if (v.data_inizio && data < v.data_inizio) {
    return [{ tipo: 'errore', testo: `Alla data del fatto la vettura non era ancora del gruppo (arrivata il ${formattaData(v.data_inizio)}) → da contestare` }]
  }
  const allora = intestazioneAl(v, data)
  if (!allora) return [{ tipo: 'attenzione', testo: 'Intestataria alla data del fatto non nota: controllare le intestazioni della vettura' }]
  const oggi = intestazioneAttuale(v)
  if (oggi && oggi !== allora && (allora.contribuente_id || allora.intestatario_testo) !== (oggi.contribuente_id || oggi.intestatario_testo)) {
    return [{ tipo: 'attenzione', testo: `Al momento del fatto era intestata a ${nomeIntestatario(allora, contribuenti)} (${v.stato === 'in_uso' ? 'oggi' : 'poi'} ${nomeIntestatario(oggi, contribuenti)})` }]
  }
  return []
}

/** Scadenze proposte dalla data di notifica: pagamento 60 gg, pagamento ridotto 5 gg, comunicazione del conducente 60 gg. */
export function proponiScadenzeMulta(data_notifica: string): Pick<MultaVeicolo, 'scadenza_pagamento' | 'scadenza_ridotta' | 'scadenza_conducente'> {
  return {
    scadenza_pagamento: aggiungiGiorni(data_notifica, GIORNI_PAGAMENTO_MULTA),
    scadenza_ridotta: aggiungiGiorni(data_notifica, GIORNI_PAGAMENTO_RIDOTTO),
    scadenza_conducente: aggiungiGiorni(data_notifica, GIORNI_COMUNICAZIONE_CONDUCENTE),
  }
}

/** Importo della multa più le eventuali spese di rinotifica, in centesimi. */
export function totaleMulta(m: MultaVeicolo): number {
  return (m.importo_cent ?? 0) + (m.spese_rinotifica_cent ?? 0)
}

/* ---------------------------- km ---------------------------- */

/** Km previsti a fine contratto (proiezione lineare) e se supereranno i km inclusi. Null senza dati sufficienti. */
export function proiezioneKm(v: Veicolo): { km_previsti: number; supera: boolean } | null {
  const c = v.contratto
  if (!c?.km_inclusi || !c.decorrenza || !c.scadenza) return null
  const letture = [...(v.km ?? [])].filter((l) => l.data && Number.isFinite(l.km)).sort((a, b) => a.data.localeCompare(b.data))
  if (!letture.length) return null
  const ultima = letture[letture.length - 1]
  const prima = letture.length >= 2 ? letture[0] : { data: c.decorrenza, km: 0 }
  const giorni = giorniTra(prima.data, ultima.data)
  if (giorni <= 0) return null
  const km_previsti = Math.round(ultima.km + ((ultima.km - prima.km) / giorni) * giorniTra(ultima.data, c.scadenza))
  return { km_previsti, supera: km_previsti > c.km_inclusi }
}

/* ---------------------------- filtri, gruppi e riepiloghi ---------------------------- */

export interface FiltriFlotta { vista: 'attuali' | 'passate' | 'tutte'; societa: string; testo: string }

const nomeAttuale = (v: Veicolo, contribuenti: Contribuente[]) => nomeIntestatario(intestazioneAttuale(v), contribuenti)
/** In coda agli elenchi: vetture da abbinare o senza società. */
const inCoda = (nome: string) => nome === '—' || nome.startsWith('da abbinare')
const confrontaNomi = (a: string, b: string) => Number(inCoda(a)) - Number(inCoda(b)) || a.localeCompare(b, 'it')

export function filtraVeicoli(veicoli: Veicolo[], f: FiltriFlotta, contribuenti: Contribuente[]): Veicolo[] {
  const targa = normalizzaTarga(f.testo)
  const testo = normalizzaNome(f.testo)
  return veicoli
    .filter((v) => f.vista === 'tutte' || (f.vista === 'attuali') === (v.stato === 'in_uso'))
    .filter((v) => !f.societa || (v.intestazioni ?? []).some((i) => i.contribuente_id === f.societa))
    .filter((v) => !testo || (targa && normalizzaTarga(v.targa).includes(targa)) || normalizzaNome(`${v.marca} ${v.modello}`).includes(testo))
    .sort((a, b) => confrontaNomi(nomeAttuale(a, contribuenti), nomeAttuale(b, contribuenti)) || a.modello.localeCompare(b.modello, 'it'))
}

export function filtriDaIndirizzo(p: URLSearchParams): FiltriFlotta {
  const vista = p.get('vista')
  return { vista: vista === 'passate' || vista === 'tutte' ? vista : 'attuali', societa: p.get('societa') ?? '', testo: p.get('testo') ?? '' }
}

export function filtriInIndirizzo(f: FiltriFlotta): string {
  const p = new URLSearchParams({ vista: f.vista })
  if (f.societa) p.set('societa', f.societa)
  if (f.testo) p.set('testo', f.testo)
  return p.toString()
}

/** Vetture raggruppate per società attuale, in ordine alfabetico; da abbinare e senza società in fondo. */
export function raggruppaPerSocieta(veicoli: Veicolo[], contribuenti: Contribuente[]): { nome: string; veicoli: Veicolo[] }[] {
  const gruppi = new Map<string, Veicolo[]>()
  for (const v of veicoli) {
    const nome = nomeAttuale(v, contribuenti)
    gruppi.set(nome, [...(gruppi.get(nome) ?? []), v])
  }
  return [...gruppi.entries()].map(([nome, vv]) => ({ nome, veicoli: vv })).sort((a, b) => confrontaNomi(a.nome, b.nome))
}

export function riepilogoElenco(veicoli: Veicolo[], multe: MultaVeicolo[], oggi: string): {
  perPossesso: Record<Possesso, number>; perStato: Record<StatoVeicolo, number>
  scadenze30: ReturnType<typeof scadenzeAperte>; multeDaPagare: { numero: number; totale_cent: number }
} {
  const perPossesso: Record<Possesso, number> = { proprieta: 0, leasing: 0, noleggio: 0 }
  const perStato: Record<StatoVeicolo, number> = { in_uso: 0, venduta: 0, restituita: 0, altro: 0 }
  for (const v of veicoli) { perPossesso[v.possesso]++; perStato[v.stato]++ }
  const ids = new Set(veicoli.map((v) => v.id))
  const multeElenco = multe.filter((m) => ids.has(m.veicolo_id))
  const limite = aggiungiGiorni(oggi, GIORNI_PREAVVISO_FLOTTA)
  const daPagare = multeElenco.filter((m) => m.stato === 'da_pagare')
  return {
    perPossesso, perStato,
    scadenze30: scadenzeAperte(veicoli, multeElenco, oggi, true).filter((r) => r.scadenza <= limite),
    multeDaPagare: { numero: daPagare.length, totale_cent: daPagare.reduce((t, m) => t + totaleMulta(m), 0) },
  }
}

/* ---------------------------- modulo della vettura ---------------------------- */

/** Campi "piatti" del modulo della vettura (i fin_* diventano il contratto di leasing/noleggio). */
export interface ValoriVettura {
  societa: string
  marca: string; modello: string; targa: string; telaio: string; alimentazione: string; data_immatricolazione: string
  possesso: string; stato: string; data_inizio: string; data_fine: string; uscita_note: string; note: string
  fin_societa: string; fin_numero: string; fin_decorrenza: string; fin_scadenza: string
  fin_canone: number | null; fin_anticipo: number | null; fin_riscatto: number | null; fin_km: number | null
  fin_bollo: string; fin_assicurazione: string
}

export function valoriVettura(v: Veicolo): ValoriVettura {
  const c = v.contratto
  return {
    societa: intestazioneAttuale(v)?.contribuente_id ?? '', marca: v.marca, modello: v.modello, targa: v.targa, telaio: v.telaio,
    alimentazione: v.alimentazione, data_immatricolazione: v.data_immatricolazione, possesso: v.possesso, stato: v.stato,
    data_inizio: v.data_inizio, data_fine: v.data_fine, uscita_note: v.uscita_note, note: v.note,
    fin_societa: c?.societa_finanziaria ?? '', fin_numero: c?.numero ?? '', fin_decorrenza: c?.decorrenza ?? '', fin_scadenza: c?.scadenza ?? '',
    fin_canone: c?.canone_mensile_cent ?? null, fin_anticipo: c?.anticipo_cent ?? null, fin_riscatto: c?.riscatto_cent ?? null,
    fin_km: c?.km_inclusi ?? null, fin_bollo: c?.bollo_incluso ?? '', fin_assicurazione: c?.assicurazione_inclusa ?? '',
  }
}

/**
 * Applica i valori del modulo alla vettura. Società: per una vettura senza intestazioni crea la prima (dalla data di
 * arrivo); altrimenti CORREGGE quella attuale (i passaggi si registrano con cambiaIntestazione). Stato: l'uscita chiude
 * l'intestazione, il ritorno "in uso" la riapre. Lancia un errore se manca la data di uscita.
 */
export function applicaValoriVettura(v: Veicolo, x: ValoriVettura): Veicolo {
  if (x.stato !== 'in_uso' && !x.data_fine) throw new Error('Indicare la data in cui la vettura è stata venduta o restituita.')
  let out: Veicolo = {
    ...v, marca: x.marca.trim(), modello: x.modello.trim(), targa: normalizzaTarga(x.targa), telaio: x.telaio.trim(), alimentazione: x.alimentazione.trim(),
    data_immatricolazione: x.data_immatricolazione, possesso: x.possesso as Possesso, data_inizio: x.data_inizio, uscita_note: x.uscita_note, note: x.note,
    contratto: x.possesso === 'proprieta' ? null : {
      societa_finanziaria: x.fin_societa.trim(), numero: x.fin_numero.trim(), decorrenza: x.fin_decorrenza, scadenza: x.fin_scadenza,
      canone_mensile_cent: x.fin_canone, anticipo_cent: x.fin_anticipo, riscatto_cent: x.fin_riscatto, km_inclusi: x.fin_km,
      bollo_incluso: x.fin_bollo as 'si' | 'no' | '', assicurazione_inclusa: x.fin_assicurazione as 'si' | 'no' | '',
    },
  }
  const attuale = intestazioneAttuale(out)
  if (!attuale && x.societa) out = { ...out, intestazioni: [{ contribuente_id: x.societa, intestatario_testo: '', dal: x.data_inizio, al: '' }] }
  else if (attuale && x.societa && x.societa !== attuale.contribuente_id) {
    out = { ...out, intestazioni: out.intestazioni.map((i) => (i === attuale ? { ...i, contribuente_id: x.societa, intestatario_testo: '' } : i)) }
  }
  if (x.stato !== 'in_uso') {
    if (v.stato === 'in_uso' || x.data_fine !== v.data_fine) {
      const ultima = intestazioneAttuale(out)
      const riaperte = { ...out, intestazioni: out.intestazioni.map((i) => (i === ultima ? { ...i, al: '' } : i)) }
      return registraUscita(riaperte, { stato: x.stato as Exclude<StatoVeicolo, 'in_uso'>, data_fine: x.data_fine, uscita_note: x.uscita_note })
    }
    return { ...out, stato: x.stato as StatoVeicolo, data_fine: x.data_fine }
  }
  if (v.stato !== 'in_uso') {
    const ultima = intestazioneAttuale(out)
    return { ...out, stato: 'in_uso', data_fine: '', intestazioni: out.intestazioni.map((i) => (i === ultima ? { ...i, al: '' } : i)) }
  }
  return { ...out, stato: 'in_uso', data_fine: '' }
}

/* ---------------------------- Excel di consultazione ---------------------------- */

/** Data gg/mm/aaaa, oppure '' se vuota (formattaData restituirebbe "—"): così funzionano i ripieghi "non nota", "oggi"… */
export const dataFlotta = (iso: string | null | undefined): string => (iso ? formattaData(iso) : '')
const euroExcel = (c: number | null | undefined) => (c == null ? '' : c / 100)

/** Righe dei fogli "Flotta" e "Multe flotta" dell'Excel di consultazione (nomi al posto degli id, date italiane, euro). */
export function righeExcelFlotta(veicoli: Veicolo[], multe: MultaVeicolo[], contribuenti: Contribuente[]): { vetture: Record<string, unknown>[]; multe: Record<string, unknown>[] } {
  const voce = (v: Veicolo, tipo: TipoScadenza) => { const s = v.scadenze.find((x) => x.tipo === tipo); return !s ? '' : s.non_dovuta ? `non dovuto: ${s.non_dovuta}` : dataFlotta(s.scadenza) }
  const vetture = veicoli.map((v) => ({
    'Società attuale': nomeIntestatario(intestazioneAttuale(v), contribuenti), 'Marca': v.marca, 'Modello': v.modello, 'Targa': v.targa,
    'Possesso': etichettaDi(POSSESSI, v.possesso), 'Società leasing / noleggio': v.contratto?.societa_finanziaria ?? '', 'Stato': etichettaDi(STATI_VEICOLO, v.stato),
    'Nel gruppo dal': dataFlotta(v.data_inizio), 'Uscita il': dataFlotta(v.data_fine), 'Uscita a': v.uscita_note,
    'Bollo': voce(v, 'bollo'), 'Revisione': voce(v, 'revisione'), 'Assicurazione': voce(v, 'assicurazione'), 'Tagliando': voce(v, 'tagliando'),
    'Fine contratto': dataFlotta(v.contratto?.scadenza ?? ''), 'Canone mensile': euroExcel(v.contratto?.canone_mensile_cent),
    'Km inclusi': v.contratto?.km_inclusi ?? '', 'Ultimi km': [...v.km].sort((a, b) => b.data.localeCompare(a.data))[0]?.km ?? '',
    'Intestazioni': v.intestazioni.map((i) => `${nomeIntestatario(i, contribuenti)} (${dataFlotta(i.dal) || '…'} – ${dataFlotta(i.al) || 'oggi'})`).join('; '),
    'Conducenti': v.conducenti.map((c) => c.nome).join('; '), 'Da verificare': v.da_verificare ? 'Sì' : '', 'Note': v.note,
  }))
  const perId = new Map(veicoli.map((v) => [v.id, v]))
  const righeMulte = multe.filter((m) => perId.has(m.veicolo_id)).map((m) => {
    const v = perId.get(m.veicolo_id)!
    return {
      'Targa': v.targa, 'Vettura': [v.marca, v.modello].filter(Boolean).join(' '), 'Tipo': etichettaDi(TIPI_MULTA, m.tipo),
      'Data': m.data_fatto ? dataFlotta(m.data_fatto) : m.anno_riferimento ? `bollo ${m.anno_riferimento}` : '',
      'Società al momento del fatto': nomeIntestatario(intestazioneAl(v, dataRiferimentoMulta(m)), contribuenti),
      'Ente': m.ente, 'N. verbale': m.numero_verbale, 'Notificata il': dataFlotta(m.data_notifica), 'Scadenza pagamento': dataFlotta(m.scadenza_pagamento),
      'Importo': euroExcel(m.importo_cent), 'Spese rinotifica': euroExcel(m.spese_rinotifica_cent), 'Totale': totaleMulta(m) / 100,
      'Conducente': m.conducente, 'Stato': etichettaDi(STATI_MULTA, m.stato), 'Pagata il': dataFlotta(m.data_pagamento),
      'Avvisi': avvisiMulta(m, v, contribuenti).map((a) => a.testo).join('; '), 'Note': m.note,
    }
  })
  return { vetture, multe: righeMulte }
}
