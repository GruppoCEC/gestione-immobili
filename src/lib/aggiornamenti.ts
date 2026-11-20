/**
 * Aggiornamento automatico quando un collega salva.
 *
 * Ogni minuto (solo con la scheda del browser in primo piano) e ogni volta che si torna sulla scheda, si controlla
 * l'ultimo salvataggio sul repository dati (una richiesta leggera). Se è cambiato, si ricaricano solo le collezioni
 * già aperte il cui file è diverso da quello in memoria: i propri salvataggi hanno già i dati giusti e non vengono
 * ricaricati. Un breve avviso dice chi ha aggiornato e cosa.
 */
import { useEffect, useState } from 'react'
import { cambiamentiTra, ultimoCommit } from './github'
import { carica, collezioniInCache, percorsoCollezione, shaInCache, type NomeCollezione } from './store'

/** Ogni quanto controllare (con la scheda del browser visibile). */
export const INTERVALLO_CONTROLLO_MS = 60_000

/** Nome leggibile della sezione di ogni collezione (avvisi, riepilogo del ripristino). */
export const SEZIONI: Record<NomeCollezione, string> = {
  societa: 'Società', immobili: 'Immobili', conduttori: 'Conduttori', condomini: 'Condomini',
  contratti: 'Contratti', annualita: 'ISTAT e imposta di registro', movimenti: 'Canoni e incassi',
  voci_condominiali: 'Condominio', piani_rientro: 'Condominio', allegati: 'Allegati',
  comunicazioni: 'Documenti e comunicazioni', tassi_legali: 'Tassi legali',
  contribuenti: 'Tributi', pratiche_tributi: 'Tributi', fatture_fornitori: 'Fornitori',
}

/* ---------- avvisi brevi (usati anche per "modifiche unite") ---------- */

const ascoltatoriAvvisi = new Set<(testo: string) => void>()

/** Mostra un avviso breve in basso nella pagina. */
export function avvisa(testo: string | null | undefined): void {
  if (testo) ascoltatoriAvvisi.forEach((fn) => fn(testo))
}

/** Avviso corrente da mostrare (si chiude da solo dopo qualche secondo). */
export function useAvviso(durataMs = 7000): [string | null, () => void] {
  const [testo, setTesto] = useState<string | null>(null)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const mostra = (t: string) => { setTesto(t); clearTimeout(timer); timer = setTimeout(() => setTesto(null), durataMs) }
    ascoltatoriAvvisi.add(mostra)
    return () => { ascoltatoriAvvisi.delete(mostra); clearTimeout(timer) }
  }, [durataMs])
  return [testo, () => setTesto(null)]
}

/* ---------- controllo dei salvataggi ---------- */

/** Nome di chi ha salvato, dal messaggio "Nome: azione". */
const autoreDi = (messaggio: string) => messaggio.split(':')[0].trim()

/**
 * Testo dell'avviso: "Emanuela ha aggiornato Canoni e incassi" / "Emanuela e Veronica hanno aggiornato …".
 * Esclude i propri salvataggi; null se non c'è niente da dire.
 */
export function testoAggiornamento(messaggi: string[], sezioni: string[], mioNome: string): string | null {
  const autori = [...new Set(messaggi.map(autoreDi).filter((a) => a && a !== mioNome))]
  if (!autori.length || !sezioni.length) return null
  const chi = autori.length === 1 ? autori[0] : `${autori.slice(0, -1).join(', ')} e ${autori.at(-1)}`
  return `${chi} ${autori.length === 1 ? 'ha' : 'hanno'} aggiornato: ${[...new Set(sezioni)].join(', ')}`
}

/** Controlla una volta: ricarica ciò che è cambiato e restituisce il nuovo ultimo salvataggio. */
async function controlla(token: string, mioNome: string, ultimoNoto: string): Promise<string> {
  const testa = await ultimoCommit(token)
  if (!testa || testa === ultimoNoto) return testa || ultimoNoto
  const aperte = collezioniInCache()
  let daRicaricare: NomeCollezione[]
  let messaggi: string[] = []
  try {
    const c = await cambiamentiTra(token, ultimoNoto, testa)
    messaggi = c.messaggi
    daRicaricare = aperte.filter((n) => {
      const f = c.file.find((x) => x.percorso === percorsoCollezione(n))
      return f !== undefined && f.sha !== shaInCache(n)
    })
  } catch {
    daRicaricare = aperte // confronto impossibile (storia riscritta): si ricarica tutto ciò che è aperto
  }
  await Promise.all(daRicaricare.map((n) => carica(token, n, true)))
  avvisa(testoAggiornamento(messaggi, daRicaricare.map((n) => SEZIONI[n]), mioNome))
  return testa
}

/** Avvia i controlli automatici finché la piattaforma è aperta (da usare una volta, nel Layout). */
export function useAggiornamentiAutomatici(token: string, mioNome: string): void {
  useEffect(() => {
    if (!token) return
    let ultimo: string | null = null   // null = non ancora letto ('' = nessun salvataggio ancora)
    let fermo = false
    let inCorso = false
    const esegui = async () => {
      if (fermo || inCorso || document.visibilityState !== 'visible') return
      inCorso = true
      try { ultimo = ultimo === null ? await ultimoCommit(token) : await controlla(token, mioNome, ultimo) } catch { /* rete assente: si riprova al giro dopo */ }
      finally { inCorso = false }
    }
    void esegui()
    const timer = setInterval(esegui, INTERVALLO_CONTROLLO_MS)
    const alRitorno = () => { if (document.visibilityState === 'visible') void esegui() }
    document.addEventListener('visibilitychange', alRitorno)
    window.addEventListener('focus', alRitorno)
    return () => { fermo = true; clearInterval(timer); document.removeEventListener('visibilitychange', alRitorno); window.removeEventListener('focus', alRitorno) }
  }, [token, mioNome])
}
