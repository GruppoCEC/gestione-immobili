/**
 * Flotta aziendale: vetture delle società (attuali e passate), scadenze, multe e cartelle.
 * Le società intestatarie sono gli uffici dei Tributi (collezione contribuenti). Visibile a Davide ed Emanuela.
 */
import { useSearchParams } from 'react-router-dom'
import ElencoMulte from '../components/flotta/ElencoMulte'
import ElencoVetture from '../components/flotta/ElencoVetture'
import ScadenzeFlotta from '../components/flotta/ScadenzeFlotta'
import { Avviso, Caricamento, IntestazionePagina, Segmentato } from '../components/ui'
import { attivi } from '../lib/store'
import type { Contribuente, MultaVeicolo, Veicolo } from '../lib/tipi'
import { useCollezioni } from '../lib/useCollezioni'

type Scheda = 'vetture' | 'scadenze' | 'multe'

export default function PaginaFlotta() {
  const { dati, caricamento, errore } = useCollezioni(['veicoli', 'multe_veicoli', 'contribuenti'])
  // La scheda aperta sta nell'indirizzo (?scheda=multe): tornando da una vettura o da una stampa si riapre quella giusta
  const [parametri, setParametri] = useSearchParams()
  const scelta = parametri.get('scheda')
  const scheda: Scheda = scelta === 'scadenze' || scelta === 'multe' ? scelta : 'vetture'
  const setScheda = (s: Scheda) => setParametri(s === 'vetture' ? {} : { scheda: s }, { replace: true })
  const veicoli = attivi(dati<Veicolo>('veicoli'))
  const multe = attivi(dati<MultaVeicolo>('multe_veicoli'))
  const contribuenti = attivi(dati<Contribuente>('contribuenti'))
  return (
    <div>
      <IntestazionePagina kicker="Amministrazione" titolo="Flotta aziendale"
        sottotitolo="Vetture delle società, attuali e passate: dati, scadenze, km, coperture, multe e cartelle."
        azioni={<Segmentato valore={scheda} onChange={setScheda} opzioni={[{ valore: 'vetture', etichetta: 'Vetture' }, { valore: 'scadenze', etichetta: 'Scadenze' }, { valore: 'multe', etichetta: 'Multe e cartelle' }]} />} />
      {errore && <div className="mb-4"><Avviso tipo="errore">{errore}</Avviso></div>}
      {caricamento && !errore ? <Caricamento />
        : scheda === 'vetture' ? <ElencoVetture veicoli={veicoli} multe={multe} contribuenti={contribuenti} />
        : scheda === 'scadenze' ? <ScadenzeFlotta veicoli={veicoli} multe={multe} contribuenti={contribuenti} />
        : <ElencoMulte veicoli={veicoli} multe={multe} contribuenti={contribuenti} />}
    </div>
  )
}
