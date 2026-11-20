/** Filtri "responsabile" e "ufficio" usati nelle schede dei Fornitori (Studi e Royalty). */
import type { Contribuente } from '../lib/tipi'
import { responsabiliDi } from '../lib/tributi'

interface Props {
  uffici: Contribuente[]
  responsabile: string
  ufficio: string
  onResponsabile: (r: string) => void
  onUfficio: (id: string) => void
}

/** Scegliendo un responsabile l'elenco degli uffici si restringe ai suoi e la scelta dell'ufficio si azzera. */
export default function FiltroUffici({ uffici, responsabile, ufficio, onResponsabile, onUfficio }: Props) {
  return (
    <>
      <select value={responsabile} onChange={(e) => { onResponsabile(e.target.value); onUfficio('') }} className="input w-auto">
        <option value="">Tutti i responsabili</option>
        {responsabiliDi(uffici).map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <select value={ufficio} onChange={(e) => onUfficio(e.target.value)} className="input w-auto">
        <option value="">Tutti gli uffici</option>
        {uffici.filter((s) => !responsabile || s.responsabile === responsabile).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
      </select>
    </>
  )
}
