/**
 * Parti comuni delle pagine da stampare (salvabili in PDF): barra in alto con "Torna…" e "Stampa / salva PDF"
 * (non stampata) e intestazione con titolo, logo del gruppo e data della situazione.
 */
import type { CSSProperties, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import logo from '../assets/logo-gruppo.png'
import { formattaDataOra } from '../lib/utils/formato'
import { Bottone } from './ui'

/** I colori delle caselle e delle etichette vanno stampati (di solito il browser toglie gli sfondi). */
export const COLORI_STAMPA = { WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as CSSProperties

/** Foglio A4 verticale con margini di 10 mm (per le stampe fitte di tabelle). */
export const StileA4Verticale = () => <style>{'@media print { @page { size: A4 portrait; margin: 10mm; } }'}</style>

/** Pagina stampata in A4 orizzontale (tabelle con molte colonne, es. visione generale della flotta). */
export const StileA4Orizzontale = () => <style>{'@media print { @page { size: A4 landscape; margin: 10mm; } }'}</style>

/**
 * Barra non stampata. `indietro`: indirizzo a cui tornare (senza: pagina precedente). I `children` (filtri, scelte)
 * vanno tra il collegamento e il pulsante: chi li passa ne decide la posizione (es. con "ml-auto").
 */
export function BarraStampa({ indietro, etichetta = 'Indietro', disabilitata, children }: { indietro?: string; etichetta?: string; disabilitata?: boolean; children?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <div className="no-stampa sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-divisore bg-sfondo px-6 py-3">
      {indietro
        ? <Link to={indietro} className="btn btn-ghost no-underline"><ArrowLeft size={16} /> {etichetta}</Link>
        : <button onClick={() => navigate(-1)} className="btn btn-ghost"><ArrowLeft size={16} /> {etichetta}</button>}
      {children}
      <Bottone className={children ? '' : 'ml-auto'} onClick={() => window.print()} disabled={disabilitata}><Printer size={16} /> Stampa / salva PDF</Bottone>
    </div>
  )
}

/**
 * Intestazione della pagina stampata. Le misure (`titoloClasse`, `spazioSotto`, `logoPiccolo`) restano quelle che ogni
 * stampa aveva già, per non cambiarne l'aspetto.
 */
export function IntestazioneStampa({ kicker, titolo, sotto, titoloClasse = 'text-[30px]', sottoClasse = 'mt-1 text-[13px]', spazioSotto = 'pb-3', logoPiccolo, etichettaData = 'Situazione al' }: {
  kicker: ReactNode; titolo: ReactNode; sotto?: ReactNode; titoloClasse?: string; sottoClasse?: string; spazioSotto?: string; logoPiccolo?: boolean; etichettaData?: string
}) {
  return (
    <header className={`flex items-start justify-between gap-6 border-b-2 border-testo ${spazioSotto}`}>
      <div className="min-w-0">
        <div className="kicker">{kicker}</div>
        <h1 className={`mt-1 ${titoloClasse}`}>{titolo}</h1>
        {sotto && <div className={`${sottoClasse} text-neutro-700`}>{sotto}</div>}
      </div>
      <div className="flex-none text-right text-xs text-neutro-700">
        <img src={logo} alt="Gruppo CEC Bigoli" className={logoPiccolo ? 'mb-1.5 ml-auto h-10 w-[160px] object-cover' : 'mb-2 ml-auto h-11 w-[170px] object-cover'} />
        {etichettaData} {formattaDataOra(new Date().toISOString())}
      </div>
    </header>
  )
}
