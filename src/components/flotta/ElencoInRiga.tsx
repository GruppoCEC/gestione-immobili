/**
 * Riquadri della scheda vettura: `Sezione` (titolo + azioni + contenuto) ed `ElencoInRiga`, un elenco semplice
 * modificabile direttamente nella tabella (km, conducenti, coperture), una riga alla volta, nello stile dei Fornitori.
 */
import { dataFlotta } from '../../lib/flotta'
import { useState, type ReactNode } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { etichettaDi, type Opzione } from '../../lib/tipi'
import { SoloSeModifica } from '../SoloLettura'
import { Avviso, Bottone, Riquadro } from '../ui'

export function Sezione({ titolo, azioni, children }: { titolo: ReactNode; azioni?: ReactNode; children: ReactNode }) {
  return (
    <Riquadro className="p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="m-0 text-lg">{titolo}</h3>
        {azioni && <span className="ml-auto flex flex-wrap items-center gap-2">{azioni}</span>}
      </div>
      {children}
    </Riquadro>
  )
}

export interface ColonnaInRiga<T> {
  nome: keyof T & string
  etichetta: string
  tipo: 'testo' | 'data' | 'numero' | 'select'
  opzioni?: Opzione[]
  obbligatorio?: boolean
}

function mostra<T>(c: ColonnaInRiga<T>, v: unknown): ReactNode {
  if (v === null || v === undefined || v === '') return <span className="text-neutro-600">—</span>
  if (c.tipo === 'data') return dataFlotta(String(v))
  if (c.tipo === 'numero') return <span className="num">{Number(v).toLocaleString('it-IT')}</span>
  if (c.tipo === 'select') return etichettaDi(c.opzioni ?? [], String(v))
  return String(v)
}

export default function ElencoInRiga<T extends object>({ titolo, righe, colonne, nuova, onSalva, vuoto = 'Nessun elemento.', ordina }: {
  titolo: ReactNode; righe: T[]; colonne: ColonnaInRiga<T>[]; nuova: () => T
  onSalva: (righe: T[], azione: string) => Promise<void>; vuoto?: string
  /** Ordine di visualizzazione (l'elenco salvato resta nell'ordine di inserimento). */
  ordina?: (a: T, b: T) => number
}) {
  // Riga in modifica: indice nell'elenco salvato, oppure -1 per una riga nuova
  const [inModifica, setInModifica] = useState<{ indice: number; valori: T } | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, setInCorso] = useState(false)
  const indici = righe.map((_, i) => i)
  if (ordina) indici.sort((a, b) => ordina(righe[a], righe[b]))

  async function esegui(nuove: T[], azione: string) {
    setInCorso(true); setErrore(null)
    try { await onSalva(nuove, azione); setInModifica(null) } catch (e) { setErrore((e as Error).message) } finally { setInCorso(false) }
  }
  function salvaRiga() {
    if (!inModifica) return
    const manca = colonne.find((c) => c.obbligatorio && (inModifica.valori[c.nome] === '' || inModifica.valori[c.nome] === null || inModifica.valori[c.nome] === undefined))
    if (manca) { setErrore(`Il campo "${manca.etichetta}" è obbligatorio.`); return }
    const nuove = inModifica.indice < 0 ? [...righe, inModifica.valori] : righe.map((r, i) => (i === inModifica.indice ? inModifica.valori : r))
    void esegui(nuove, inModifica.indice < 0 ? 'aggiunta' : 'modifica')
  }

  const imposta = (nome: keyof T, v: unknown) => setInModifica((x) => (x ? { ...x, valori: { ...x.valori, [nome]: v } } : x))
  const campo = (c: ColonnaInRiga<T>) => {
    const v = inModifica?.valori[c.nome]
    if (c.tipo === 'select') return (
      <select value={String(v ?? '')} onChange={(e) => imposta(c.nome, e.target.value)} className="input">
        <option value="">—</option>
        {(c.opzioni ?? []).map((o) => <option key={o.valore} value={o.valore}>{o.etichetta}</option>)}
      </select>
    )
    if (c.tipo === 'numero') return <input type="number" value={v === null || v === undefined ? '' : String(v)} onChange={(e) => imposta(c.nome, e.target.value === '' ? null : Number(e.target.value))} className="input num w-[110px] text-right" />
    return <input type={c.tipo === 'data' ? 'date' : 'text'} value={String(v ?? '')} onChange={(e) => imposta(c.nome, e.target.value)} className="input" />
  }
  const rigaModifica = (chiave: string, eliminabile: boolean) => (
    <tr key={chiave} className="bg-accento-100">
      {colonne.map((c) => <td key={c.nome}>{campo(c)}</td>)}
      <td className="whitespace-nowrap">
        <Bottone piccolo disabled={inCorso} onClick={salvaRiga}><Check size={14} /> Salva</Bottone>
        <button type="button" title="Annulla" onClick={() => { setInModifica(null); setErrore(null) }} className="btn btn-ghost btn-piccolo"><X size={14} /></button>
        {eliminabile && <button type="button" title="Elimina" disabled={inCorso} onClick={() => void esegui(righe.filter((_, i) => i !== inModifica!.indice), 'eliminazione')} className="btn btn-ghost btn-piccolo !text-neutro-700 hover:!text-err-testo"><Trash2 size={14} /></button>}
      </td>
    </tr>
  )

  return (
    <Sezione titolo={titolo} azioni={<SoloSeModifica><Bottone piccolo variante="secondario" disabled={!!inModifica} onClick={() => setInModifica({ indice: -1, valori: nuova() })}><Plus size={14} /> Aggiungi</Bottone></SoloSeModifica>}>
      {errore && <div className="mb-3"><Avviso tipo="errore">{errore}</Avviso></div>}
      {righe.length === 0 && !inModifica ? <p className="m-0 text-sm text-neutro-700">{vuoto}</p> : (
        <div className="overflow-x-auto">
          <table className="tabella">
            <thead><tr>{colonne.map((c) => <th key={c.nome}>{c.etichetta}</th>)}<th /></tr></thead>
            <tbody>
              {indici.map((i) => (inModifica?.indice === i ? rigaModifica(`r${i}`, true) : (
                <tr key={`r${i}`}>
                  {colonne.map((c) => <td key={c.nome}>{mostra(c, righe[i][c.nome])}</td>)}
                  <td className="text-right"><SoloSeModifica><button type="button" title="Modifica" disabled={!!inModifica} onClick={() => setInModifica({ indice: i, valori: { ...righe[i] } })} className="btn btn-ghost btn-piccolo"><Pencil size={14} /></button></SoloSeModifica></td>
                </tr>
              )))}
              {inModifica?.indice === -1 && rigaModifica('nuova', false)}
            </tbody>
          </table>
        </div>
      )}
    </Sezione>
  )
}
