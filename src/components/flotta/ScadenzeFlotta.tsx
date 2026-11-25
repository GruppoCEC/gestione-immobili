/**
 * Scheda "Scadenze" della Flotta: elenco unico, per data, delle scadenze delle vetture in uso (scadute e prossimi
 * 90 giorni, oppure tutte), più le multe da pagare e i conducenti da comunicare. Solo dati della flotta.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { GIORNI_ORIZZONTE_SCADENZE, scadenzeAperte, statoScadenza, type RigaScadenza, dataFlotta } from '../../lib/flotta'
import type { Contribuente, MultaVeicolo, Veicolo } from '../../lib/tipi'
import { oggiIso } from '../../lib/utils/formato'
import { SoloSeModifica } from '../SoloLettura'
import { Bottone, Etichetta, Segmentato, Tabella, type Colonna } from '../ui'
import EditorMulta from './EditorMulta'
import { FinestraSegnaFatto } from './ScadenzeVettura'

type Riga = RigaScadenza & { id: string }
const VOCI_SEGNABILI = new Set(['bollo', 'revisione', 'assicurazione', 'tagliando', 'altro'])

export default function ScadenzeFlotta({ veicoli, multe, contribuenti }: { veicoli: Veicolo[]; multe: MultaVeicolo[]; contribuenti: Contribuente[] }) {
  const navigate = useNavigate()
  const [tutte, setTutte] = useState(false)
  const [fatto, setFatto] = useState<{ veicoloId: string; voceId: string } | null>(null)
  const [multa, setMulta] = useState<MultaVeicolo | null>(null)
  const oggi = oggiIso()
  const righe: Riga[] = scadenzeAperte(veicoli, multe, oggi, tutte).map((r, i) => ({ ...r, id: `${r.veicolo.id}-${r.tipo}-${r.voceId ?? r.multa?.id ?? ''}-${i}` }))

  const colonne: Colonna<Riga>[] = [
    { chiave: 'data', etichetta: 'Scadenza', render: (r) => { const st = statoScadenza(r.scadenza, oggi); return <span className="whitespace-nowrap">{dataFlotta(r.scadenza)} <Etichetta tono={st.tono}>{st.testo}</Etichetta></span> } },
    { chiave: 'voce', etichetta: 'Cosa', render: (r) => <span className="font-semibold">{r.etichetta}</span> },
    { chiave: 'vettura', etichetta: 'Vettura', render: (r) => <>{[r.veicolo.marca, r.veicolo.modello].filter(Boolean).join(' ')} <span className="num">{r.veicolo.targa}</span>{r.veicolo.stato !== 'in_uso' && <> <Etichetta>passata</Etichetta></>}</> },
    { chiave: 'azioni', etichetta: '', allinea: 'dx', render: (r) => (
      <span onClick={(e) => e.stopPropagation()}>
        {r.multa ? <Bottone piccolo variante="secondario" onClick={() => setMulta(r.multa!)}>Apri</Bottone>
          : VOCI_SEGNABILI.has(r.tipo) && r.voceId ? <SoloSeModifica><Bottone piccolo variante="secondario" onClick={() => setFatto({ veicoloId: r.veicolo.id, voceId: r.voceId! })}><Check size={14} /> Segna fatto</Bottone></SoloSeModifica> : null}
      </span>
    ) },
  ]
  const vettura = fatto ? veicoli.find((v) => v.id === fatto.veicoloId) ?? null : null

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmentato valore={tutte ? 'tutte' : 'prossime'} onChange={(x) => setTutte(x === 'tutte')}
          opzioni={[{ valore: 'prossime', etichetta: `Scadute e prossimi ${GIORNI_ORIZZONTE_SCADENZE} giorni` }, { valore: 'tutte', etichetta: 'Mostra tutte' }]} />
        <span className="ml-auto text-[13px] text-neutro-700">{righe.length} scadenze</span>
      </div>
      <Tabella colonne={colonne} righe={righe} onRiga={(r) => (r.multa ? setMulta(r.multa) : navigate(`/flotta/vettura/${r.veicolo.id}`))}
        vuoto={tutte ? 'Nessuna scadenza indicata.' : `Nessuna scadenza nei prossimi ${GIORNI_ORIZZONTE_SCADENZE} giorni.`} />
      <FinestraSegnaFatto vettura={vettura} voceId={fatto?.voceId ?? null} onChiudi={() => setFatto(null)} />
      <EditorMulta iniziale={multa} nuova={false} veicoli={veicoli} contribuenti={contribuenti} aperta={!!multa} onChiudi={() => setMulta(null)} />
    </div>
  )
}
