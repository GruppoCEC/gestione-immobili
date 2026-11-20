/**
 * Canone mensile in vigore in un dato mese, tenendo conto degli aumenti ISTAT registrati
 * nel registro annuale (una nuova annualità con "inizio annualità" cambia il canone da quel mese).
 */
import type { Annualita, Contratto, Movimento } from './tipi'
import { statoIva } from './tipi'
import { formattaEuro } from './utils/formato'
import { giorniDelMese } from './utils/date'

export interface CanoneMese {
  imponibile_cent: number | null
  iva_percento: number
  iva_cent: number
  totale_cent: number | null
  dal: string | null   // "AAAA-MM" da cui vale questo importo (null = dall'inizio del contratto)
}

const r0 = (n: number) => Math.round(n)

/** Giorno del mese in cui scade il canone (regola del gruppo: il 10, salvo casi particolari indicati nel contratto). */
export const GIORNO_SCADENZA_PREDEFINITO = 10
export function giornoScadenzaDi(c: Pick<Contratto, 'giorno_scadenza'>): number {
  return c.giorno_scadenza && c.giorno_scadenza >= 1 && c.giorno_scadenza <= 31 ? c.giorno_scadenza : GIORNO_SCADENZA_PREDEFINITO
}

/** Data di scadenza del canone di un mese "AAAA-MM" → "AAAA-MM-GG" (giorno 31 a febbraio = ultimo giorno del mese). */
export function scadenzaCanone(c: Pick<Contratto, 'giorno_scadenza'>, mese: string): string {
  const [a, m] = mese.split('-').map(Number)
  const ultimo = giorniDelMese(a, m)
  return `${mese}-${String(Math.min(giornoScadenzaDi(c), ultimo)).padStart(2, '0')}`
}

/**
 * Vero se il contratto va mostrato nella griglia dei canoni dell'anno: i contratti attivi e quelli cessati in
 * quell'anno o dopo (così gli ultimi canoni non incassati di un conduttore uscito restano visibili e nei totali).
 * Un contratto cessato senza data di cessazione non compare.
 */
export function inGrigliaAnno(c: Pick<Contratto, 'stato' | 'data_cessazione'>, anno: number): boolean {
  if (c.stato !== 'cessato') return true
  return !!c.data_cessazione && Number(c.data_cessazione.slice(0, 4)) >= anno
}

/** Vero se il canone del mese è già scaduto alla data indicata (AAAA-MM-GG). */
export function canoneScaduto(c: Pick<Contratto, 'giorno_scadenza'>, mese: string, oggi: string): boolean {
  return scadenzaCanone(c, mese) < oggi
}

function conIva(c: Contratto, imponibile: number | null, dal: string | null): CanoneMese {
  const iva_percento = statoIva(c).soggetto ? (c.iva_percento ?? 22) : 0
  if (imponibile == null) return { imponibile_cent: null, iva_percento, iva_cent: 0, totale_cent: null, dal }
  const iva_cent = r0(imponibile * (iva_percento / 100))
  return { imponibile_cent: imponibile, iva_percento, iva_cent, totale_cent: imponibile + iva_cent, dal }
}

/** Annualità del contratto con data di inizio, in ordine cronologico. */
export function annualitaDi(c: Contratto, tutte: Annualita[]): Annualita[] {
  return tutte.filter((a) => a.contratto_id === c.id && a.data_inizio && a.canone_mensile_nuovo_cent != null).sort((a, b) => a.data_inizio.localeCompare(b.data_inizio))
}

/** Canone mensile valido nel mese "AAAA-MM". */
export function canoneMensilePer(c: Contratto, tutte: Annualita[], mese: string): CanoneMese {
  const anns = annualitaDi(c, tutte)
  const applicabili = anns.filter((a) => a.data_inizio.slice(0, 7) <= mese)
  if (applicabili.length) { const u = applicabili[applicabili.length - 1]; return conIva(c, u.canone_mensile_nuovo_cent, u.data_inizio.slice(0, 7)) }
  const successiva = anns.find((a) => a.data_inizio.slice(0, 7) > mese)
  if (successiva && successiva.canone_mensile_precedente_cent != null) return conIva(c, successiva.canone_mensile_precedente_cent, null)
  return conIva(c, c.canone_mensile_cent, null)
}

/**
 * Ultimo cambio di canone in vigore entro il mese "AAAA-MM": da quando vale il canone attuale e quanto era prima.
 * Le annualità che lasciano il canone invariato (ISTAT non applicato) non contano: si risale all'ultimo aumento vero,
 * anche se è di un anno precedente. null se il canone non è mai cambiato.
 */
export function ultimoAumento(c: Contratto, tutte: Annualita[], mese: string): { dal: string; precedente: CanoneMese } | null {
  const anns = annualitaDi(c, tutte).filter((a) => a.data_inizio.slice(0, 7) <= mese)
  if (!anns.length) return null
  const valori = [anns[0].canone_mensile_precedente_cent ?? c.canone_mensile_cent, ...anns.map((a) => a.canone_mensile_nuovo_cent)]
  for (let i = valori.length - 1; i > 0; i--) {
    if (valori[i] !== valori[i - 1]) return { dal: anns[i - 1].data_inizio.slice(0, 7), precedente: conIva(c, valori[i - 1], null) }
  }
  return null
}

/**
 * Dopo il salvataggio di un'annualità che cambia il canone (aumento ISTAT): i canoni già registrati nei mesi in cui vale
 * (dall'inizio dell'annualità fino all'inizio della successiva) passano al nuovo importo e lo stato si ricalcola, così un mese
 * già pagato con l'importo vecchio diventa "incassato in parte". Si toccano solo i mesi con l'imponibile uguale a un canone
 * vecchio (`vecchi`): quelli con un importo diverso inserito a mano restano com'erano. Se c'è già la fattura, resta e si
 * aggiunge una nota. Restituisce l'elenco aggiornato e i mesi cambiati.
 */
export function adeguaCanoniRegistrati(
  movimenti: Movimento[], annualita: Annualita, tutte: Annualita[], vecchi: Array<number | null | undefined>,
  campiModifica: Pick<Movimento, 'modificato_il' | 'modificato_da'>,
): { record: Movimento[]; mesi: string[] } {
  const nuovo = annualita.canone_mensile_nuovo_cent
  const daCambiare = vecchi.filter((x): x is number => x != null && x !== nuovo)
  if (nuovo == null || !annualita.data_inizio || !daCambiare.length) return { record: movimenti, mesi: [] }
  const dal = annualita.data_inizio.slice(0, 7)
  const successiva = tutte
    .filter((a) => a.contratto_id === annualita.contratto_id && a.id !== annualita.id && !a.eliminato_il && a.data_inizio && a.data_inizio > annualita.data_inizio)
    .sort((a, b) => a.data_inizio.localeCompare(b.data_inizio))[0]
  const al = successiva?.data_inizio.slice(0, 7)
  const mesi: string[] = []
  const record = movimenti.map((m) => {
    if (m.eliminato_il || m.tipo !== 'canone' || m.contratto_id !== annualita.contratto_id || m.stato === 'stornato') return m
    if (m.competenza < dal || (al && m.competenza >= al) || m.imponibile_cent == null || !daCambiare.includes(m.imponibile_cent)) return m
    const iva = r0(nuovo * ((m.iva_percento ?? 0) / 100))
    const dovuto = nuovo + iva
    const inc = m.incassato_cent ?? 0
    const stato = inc <= 0 ? 'da_incassare' : inc < dovuto ? 'parziale' : 'incassato'
    const nota = m.numero_fattura
      ? `Adeguamento ISTAT ${annualita.anno}: dovuto da ${formattaEuro(m.dovuto_cent)} a ${formattaEuro(dovuto)}; fattura n. ${m.numero_fattura} emessa sull'importo precedente, differenza ${formattaEuro(dovuto - (m.dovuto_cent ?? 0))} da fatturare`
      : `Adeguamento ISTAT ${annualita.anno}: dovuto da ${formattaEuro(m.dovuto_cent)} a ${formattaEuro(dovuto)}`
    mesi.push(m.competenza)
    return { ...m, imponibile_cent: nuovo, iva_cent: iva, dovuto_cent: dovuto, stato, note: [m.note, nota].filter(Boolean).join(' · '), ...campiModifica }
  })
  return { record, mesi: mesi.sort() }
}

/** "1.220,00 € (1.000,00 + IVA 220,00)" oppure solo il totale se non c'è IVA. */
export function descriviCanone(k: CanoneMese, formattaEuro: (n: number | null) => string): string {
  if (k.totale_cent == null) return '—'
  if (!k.iva_percento) return formattaEuro(k.totale_cent)
  return `${formattaEuro(k.totale_cent)} (${formattaEuro(k.imponibile_cent)} + IVA ${k.iva_percento}% ${formattaEuro(k.iva_cent)})`
}

/**
 * Dovuto e incassato di un contratto per un anno.
 * Il dovuto conta TUTTI i mesi del periodo di validità del contratto la cui scadenza (il giorno indicato nel
 * contratto, di norma il 10) è già passata alla data `oggi`, usando il movimento registrato se esiste oppure il
 * canone atteso in quel mese: così un anno senza registrazioni mostra il dovuto reale, non zero.
 * Un canone incassato in anticipo (mese non ancora scaduto) conta comunque nell'incassato e nel dovuto.
 */
export function totaliAnnoContratto(
  c: Contratto, tutte: Annualita[], movimenti: Array<{ contratto_id: string; tipo: string; competenza: string; stato: string; dovuto_cent: number | null; incassato_cent: number | null }>,
  anno: number, oggi: string,
): { dovuto: number; incassato: number; mesiNonIncassati: string[] } {
  const oggiMese = oggi.slice(0, 7)
  let dovuto = 0, incassato = 0
  const mesiNonIncassati: string[] = []
  const inizio = c.data_decorrenza ? c.data_decorrenza.slice(0, 7) : ''
  const fine = c.data_cessazione ? c.data_cessazione.slice(0, 7) : ''
  for (let i = 1; i <= 12; i++) {
    const mese = `${anno}-${String(i).padStart(2, '0')}`
    if (mese > oggiMese) break
    if ((inizio && mese < inizio) || (fine && mese > fine)) continue
    const m = movimenti.find((x) => x.contratto_id === c.id && x.tipo === 'canone' && x.competenza === mese)
    const scaduto = canoneScaduto(c, mese, oggi)
    if (!scaduto && !m) continue // mese in corso non ancora scaduto e senza registrazioni: non è dovuto
    if (m) {
      if (m.stato === 'stornato') continue
      dovuto += m.dovuto_cent ?? 0; incassato += m.incassato_cent ?? 0
      if ((m.stato === 'da_incassare' || m.stato === 'parziale') && scaduto) mesiNonIncassati.push(mese)
    } else {
      const atteso = canoneMensilePer(c, tutte, mese).totale_cent ?? 0
      dovuto += atteso
      if (atteso > 0) mesiNonIncassati.push(mese)
    }
  }
  return { dovuto, incassato, mesiNonIncassati }
}
