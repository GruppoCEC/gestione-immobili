/**
 * Componenti grafici di base riutilizzati in tutte le sezioni (sistema "Industry").
 * Colori e classi sono in index.css: qui niente colori con opacità Tailwind (vedi nota Chrome 109).
 */
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { analizzaEuro, centesimiInTesto } from '../lib/utils/formato'
import { Check, ChevronDown, ChevronRight, CircleAlert, CircleCheck, Copy, Info, Search, TriangleAlert, X } from 'lucide-react'

/** Le quattro crocette "+" sugli angoli: vanno dentro un elemento con classe "blueprint" o "con-crocette". */
export function Crocette() {
  return <><i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" /></>
}

/** Riquadro con bordo sottile e crocette. Non mettere overflow qui (taglierebbe le crocette): usare un div interno. */
export function Riquadro({ children, className = '', ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={`blueprint ${className}`}><Crocette />{children}</div>
}

type VarianteBottone = 'primario' | 'secondario' | 'pericolo' | 'ghost'

export function Bottone({ children, variante = 'primario', piccolo, className = '', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBottone; piccolo?: boolean }) {
  return (
    <button {...p} className={`btn btn-${variante} ${piccolo ? 'btn-piccolo' : ''} ${variante === 'primario' ? 'con-crocette' : ''} ${className}`}>
      {variante === 'primario' && <Crocette />}
      {children}
    </button>
  )
}

/** Intestazione standard di ogni pagina: kicker, titolo, sottotitolo a sinistra; azioni a destra. */
export function IntestazionePagina({ kicker, titolo, sottotitolo, azioni }: { kicker?: ReactNode; titolo: ReactNode; sottotitolo?: ReactNode; azioni?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-divisore pb-5">
      <div className="min-w-0">
        {kicker && <div className="kicker mb-2">{kicker}</div>}
        <h1 className="m-0 text-[34px] md:text-[42px]">{titolo}</h1>
        {sottotitolo && <p className="mt-2 max-w-3xl text-neutro-700">{sottotitolo}</p>}
      </div>
      {azioni && <div className="flex flex-wrap items-end gap-2.5">{azioni}</div>}
    </div>
  )
}

export interface OpzioneSegmentato<V extends string> { valore: V; etichetta: ReactNode }

/** Controllo segmentato: una scelta tra poche opzioni (filtri, schede, Sì/No). */
export function Segmentato<V extends string>({ opzioni, valore, onChange, disabilitato, largo }: { opzioni: OpzioneSegmentato<V>[]; valore: V | ''; onChange: (v: V) => void; disabilitato?: boolean; largo?: boolean }) {
  return (
    <div className={`seg ${largo ? 'flex w-full' : ''}`} role="group">
      {opzioni.map((o) => (
        <button key={o.valore} type="button" disabled={disabilitato} aria-pressed={valore === o.valore}
          onClick={() => onChange(o.valore)} className={`seg-opt ${largo ? 'flex-1' : ''} ${valore === o.valore ? 'attiva' : ''}`}>
          {o.etichetta}
        </button>
      ))}
    </div>
  )
}

export interface CellaKpi { titolo: ReactNode; valore: ReactNode; nota?: ReactNode; tono?: 'rosso' }

/** Tavola di numeri riassuntivi (Condominio, Canoni, Importa): celle affiancate separate da una linea sottile. */
export function TavolaKpi({ celle }: { celle: CellaKpi[] }) {
  return (
    <Riquadro className="mb-8">
      <div className="grid gap-px bg-divisore" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        {celle.map((c, i) => (
          <div key={i} className={`px-[22px] py-5 ${c.tono === 'rosso' ? 'bg-err-fondo text-err-testo' : 'bg-sfondo'}`}>
            <div className={`text-[11px] uppercase tracking-[0.08em] ${c.tono === 'rosso' ? '' : 'text-attenuato'}`}>{c.titolo}</div>
            <div className="num mt-2 whitespace-nowrap font-titolo text-[clamp(28px,3vw,46px)] font-semibold leading-none">{c.valore}</div>
            {c.nota && <div className={`mt-2 text-[13px] ${c.tono === 'rosso' ? '' : 'text-neutro-700'}`}>{c.nota}</div>}
          </div>
        ))}
      </div>
    </Riquadro>
  )
}

/**
 * Collegamento tra una Finestra e il modulo che contiene: il modulo segnala se ci sono modifiche non salvate e,
 * per uscire (Annulla), passa dalla finestra, che in quel caso chiede conferma invece di chiudere perdendo i dati.
 */
interface ContestoFinestra {
  segnalaModifiche: (chi: string, modificato: boolean) => void
  esci: (azione: () => void) => void
}
const ContestoFinestra = createContext<ContestoFinestra | null>(null)

/** Finestre aperte, dalla più vecchia alla più recente: il tasto Esc agisce solo su quella in primo piano. */
const finestreAperte: string[] = []

/** Da usare nei moduli dentro una Finestra: segnala le modifiche non salvate. Restituisce la funzione per uscire con conferma. */
export function useModificheNonSalvate(modificato: boolean): (azione: () => void) => void {
  const ctx = useContext(ContestoFinestra)
  const chi = useId()
  useEffect(() => {
    ctx?.segnalaModifiche(chi, modificato)
    return () => ctx?.segnalaModifiche(chi, false)
  }, [ctx, chi, modificato])
  return useCallback((azione: () => void) => (ctx ? ctx.esci(azione) : azione()), [ctx])
}

/**
 * Finestra sopra la pagina. Si chiude solo con la X, il tasto Esc o i pulsanti del modulo (mai cliccando fuori:
 * basterebbe un clic sbagliato per perdere quello che si stava scrivendo). Se il modulo ha modifiche non salvate,
 * prima di chiudere chiede conferma.
 */
export function Finestra({ titolo, kicker, aperta, onChiudi, children, larga }: { titolo: string; kicker?: ReactNode; aperta: boolean; onChiudi: () => void; children: ReactNode; larga?: boolean }) {
  const [modificati, setModificati] = useState<Set<string>>(() => new Set())
  const [uscita, setUscita] = useState<(() => void) | null>(null)
  const conModifiche = modificati.size > 0
  const idFinestra = useId()

  const segnalaModifiche = useCallback((chi: string, modificato: boolean) => {
    setModificati((prec) => {
      if (prec.has(chi) === modificato) return prec
      const nuovo = new Set(prec)
      if (modificato) nuovo.add(chi); else nuovo.delete(chi)
      return nuovo
    })
  }, [])
  const esci = useCallback((azione: () => void) => {
    if (conModifiche) setUscita(() => azione); else azione()
  }, [conModifiche])
  const contesto = useMemo(() => ({ segnalaModifiche, esci }), [segnalaModifiche, esci])

  // Alla chiusura si azzera tutto (la finestra resta montata anche quando è chiusa)
  const [eraAperta, setEraAperta] = useState(aperta)
  if (aperta !== eraAperta) {
    setEraAperta(aperta)
    if (!aperta) { setModificati(new Set()); setUscita(null) }
  }

  // Registro della finestra tra quelle aperte (per sapere quale è in primo piano)
  useEffect(() => {
    if (!aperta) return
    finestreAperte.push(idFinestra)
    return () => { const i = finestreAperte.lastIndexOf(idFinestra); if (i >= 0) finestreAperte.splice(i, 1) }
  }, [aperta, idFinestra])

  useEffect(() => {
    if (!aperta) return
    const tasto = (e: KeyboardEvent) => {
      // Con più finestre una sopra l'altra (es. annualità dentro il registro) Esc chiude solo quella in primo piano
      if (e.key !== 'Escape' || finestreAperte[finestreAperte.length - 1] !== idFinestra) return
      if (uscita) setUscita(null)   // Esc sull'avviso: si torna a modificare
      else esci(onChiudi)
    }
    window.addEventListener('keydown', tasto)
    return () => window.removeEventListener('keydown', tasto)
  }, [aperta, onChiudi, esci, uscita, idFinestra])

  // Chiudendo o ricaricando la scheda del browser con modifiche non salvate, il browser chiede conferma
  useEffect(() => {
    if (!aperta || !conModifiche) return
    const avvisa = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', avvisa)
    return () => window.removeEventListener('beforeunload', avvisa)
  }, [aperta, conModifiche])

  if (!aperta) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(43,43,45,0.5)] p-4 md:p-12">
      <Riquadro role="dialog" aria-modal="true" aria-label={titolo} className={`ombra-lg w-full bg-sfondo ${larga ? 'max-w-[820px]' : 'max-w-[640px]'}`}>
        <div className="flex items-start justify-between gap-4 border-b border-divisore px-6 py-5 md:px-7">
          <div className="min-w-0">
            {kicker && <div className="kicker mb-1">{kicker}</div>}
            <h2 className="m-0 text-[26px]">{titolo}</h2>
          </div>
          <button onClick={() => esci(onChiudi)} aria-label="Chiudi" className="btn btn-secondario btn-icona flex-none"><X size={18} /></button>
        </div>
        <div className="px-6 py-6 md:px-7"><ContestoFinestra.Provider value={contesto}>{children}</ContestoFinestra.Provider></div>
      </Riquadro>
      {uscita && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(43,43,45,0.35)] p-4">
          <Riquadro role="alertdialog" aria-modal="true" aria-label="Modifiche non salvate" className="ombra-lg w-full max-w-[460px] bg-sfondo px-6 py-6">
            <h3 className="m-0 mb-2">Ci sono modifiche non salvate</h3>
            <p className="m-0 mb-5 text-sm text-neutro-700">Se esci adesso, quello che hai scritto in questa finestra andrà perso.</p>
            <div className="flex flex-wrap justify-end gap-2.5">
              <Bottone variante="secondario" onClick={() => { const azione = uscita; setUscita(null); setModificati(new Set()); azione() }}>Esci senza salvare</Bottone>
              <Bottone autoFocus onClick={() => setUscita(null)}>Continua a modificare</Bottone>
            </div>
          </Riquadro>
        </div>
      )}
    </div>
  )
}

export function Avviso({ tipo = 'info', children }: { tipo?: 'info' | 'errore' | 'ok' | 'attenzione'; children: ReactNode }) {
  const stile = {
    info: 'border-divisore text-testo',
    ok: 'border-ok-bordo bg-ok-fondo text-ok-testo',
    attenzione: 'border-att-bordo bg-att-fondo text-att-testo',
    errore: 'border-err-bordo bg-err-fondo text-err-testo',
  }[tipo]
  const Icona = { info: Info, ok: CircleCheck, attenzione: TriangleAlert, errore: CircleAlert }[tipo]
  return (
    <div className={`flex gap-2.5 border px-3.5 py-2.5 text-[13px] ${stile}`}>
      <Icona size={16} className="mt-0.5 flex-none" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export function Vuoto({ children }: { children: ReactNode }) {
  return <Riquadro className="p-14 text-center text-neutro-700">{children}</Riquadro>
}

/** Campo importo compatto (tabelle e moduli su misura): mostra "1350,50", salva i centesimi mentre si scrive. */
export function InputEuro({ valore, onChange, className = '' }: { valore: number | null; onChange: (c: number | null) => void; className?: string }) {
  const [testo, setTesto] = useState<string | null>(null)
  const mostrato = testo ?? centesimiInTesto(valore)
  return (
    <input value={mostrato} inputMode="decimal" className={`input num text-right ${className}`}
      onFocus={() => setTesto(mostrato)} onChange={(e) => { setTesto(e.target.value); onChange(analizzaEuro(e.target.value)) }}
      onBlur={() => setTesto(null)} />
  )
}

export function Caricamento() {
  return <div className="py-10 text-center text-neutro-600">Caricamento…</div>
}

export type TonoEtichetta = 'grigio' | 'verde' | 'rosso' | 'giallo' | 'blu'

export function Etichetta({ tono = 'grigio', children }: { tono?: TonoEtichetta; children: ReactNode }) {
  return <span className={`tag tag-${tono}`}>{children}</span>
}

export interface Colonna<T> {
  chiave: string
  etichetta: string
  render: (r: T) => ReactNode
  allinea?: 'sx' | 'dx'
}

export function Tabella<T extends { id: string }>({ colonne, righe, onRiga, vuoto, rigaTotale }: { colonne: Colonna<T>[]; righe: T[]; onRiga?: (r: T) => void; vuoto?: string; rigaTotale?: T }) {
  if (righe.length === 0) return <Vuoto>{vuoto ?? 'Nessun elemento.'}</Vuoto>
  const cella = (c: Colonna<T>) => (c.allinea === 'dx' ? 'text-right num' : '')
  return (
    <Riquadro>
      <div className="overflow-x-auto">
        <table className="tabella">
          <thead>
            <tr>{colonne.map((c) => <th key={c.chiave} className={c.allinea === 'dx' ? 'text-right' : ''}>{c.etichetta}</th>)}</tr>
          </thead>
          <tbody>
            {righe.map((r) => (
              <tr key={r.id} onClick={() => onRiga?.(r)} className={onRiga ? 'cliccabile' : ''}>
                {colonne.map((c) => <td key={c.chiave} className={cella(c)}>{c.render(r)}</td>)}
              </tr>
            ))}
            {rigaTotale && (
              <tr className="totale">{colonne.map((c) => <td key={c.chiave} className={cella(c)}>{c.render(rigaTotale)}</td>)}</tr>
            )}
          </tbody>
        </table>
      </div>
    </Riquadro>
  )
}

export function BarraRicerca({ valore, onChange, segnaposto = 'Cerca…' }: { valore: string; onChange: (v: string) => void; segnaposto?: string }) {
  return (
    <div className="relative w-full max-w-[320px]">
      <Search size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutro-600" />
      <input value={valore} onChange={(e) => onChange(e.target.value)} placeholder={segnaposto} className="input pl-[34px]" />
    </div>
  )
}

/** Filtro testuale su tutti i valori del record. */
export function filtraTesto<T extends object>(righe: T[], testo: string, extra?: (r: T) => string): T[] {
  const q = testo.trim().toLowerCase()
  if (!q) return righe
  return righe.filter((r) => (Object.values(r).join(' ') + ' ' + (extra?.(r) ?? '')).toLowerCase().includes(q))
}

/** Gruppo apribile (es. una società): intestazione cliccabile con titolo, sottotitolo e dati a destra. */
export function Gruppo({ titolo, sottotitolo, destra, children, apertoIniziale = true }: { titolo: ReactNode; sottotitolo?: ReactNode; destra?: ReactNode; children: ReactNode; apertoIniziale?: boolean }) {
  const [aperto, setAperto] = useState(apertoIniziale)
  return (
    <section className="mb-8">
      <button type="button" onClick={() => setAperto(!aperto)} aria-expanded={aperto}
        className="mb-3 flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 px-1 py-1 text-left hover:bg-[rgba(29,31,32,0.04)]">
        <span className="self-center text-neutro-600">{aperto ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span>
        <span className="font-titolo text-xl font-semibold">{titolo}</span>
        {sottotitolo && <span className="text-[13px] text-neutro-700">{sottotitolo}</span>}
        {destra && <span className="ml-auto text-[13px]">{destra}</span>}
      </button>
      {aperto && children}
    </section>
  )
}

/** Copia un testo negli appunti (con ripiego per i browser datati, es. Chrome 109 su pagine non sicure). */
export async function copiaNegliAppunti(testo: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(testo); return true }
  } catch { /* si prova il metodo alternativo */ }
  const area = document.createElement('textarea')
  area.value = testo
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'; area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  let ok = false
  try { ok = document.execCommand('copy') } catch { ok = false }
  document.body.removeChild(area)
  return ok
}

/** Pulsante "Copia": mette il testo negli appunti e conferma con "Copiato". */
export function Copia({ testo, etichetta = 'Copia', titolo }: { testo: string; etichetta?: string; titolo?: string }) {
  const [stato, setStato] = useState<'' | 'ok' | 'errore'>('')
  async function copia() {
    const ok = await copiaNegliAppunti(testo)
    setStato(ok ? 'ok' : 'errore')
    window.setTimeout(() => setStato(''), 1800)
  }
  return (
    <button type="button" onClick={copia} disabled={!testo} title={titolo ?? `Copia: ${testo}`} className="btn btn-ghost btn-piccolo flex-none">
      {stato === 'ok' ? <Check size={14} /> : <Copy size={14} />}
      {stato === 'ok' ? 'Copiato' : stato === 'errore' ? 'Non riuscito' : etichetta}
    </button>
  )
}
