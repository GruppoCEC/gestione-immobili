/**
 * Finestra "Nuova vettura" / "Modifica dati": dati del veicolo, società, stato e contratto di leasing o noleggio.
 * Il modulo lavora su campi "piatti" (ValoriVettura in lib/flotta.ts) che poi diventano la vettura completa.
 * La società di una vettura esistente qui si CORREGGE (es. abbinare una vettura caricata dall'Excel); un passaggio
 * a un'altra società si registra invece con "Cambio intestazione", che ne conserva lo storico.
 */
import { useNavigate } from 'react-router-dom'
import { applicaValoriVettura, valoriVettura, type ValoriVettura } from '../../lib/flotta'
import { useSessioneAttiva } from '../../lib/sessione'
import { POSSESSI, SI_NO, STATI_VEICOLO, type Contribuente, type Opzione, type Veicolo } from '../../lib/tipi'
import Modulo, { type CampoDef } from '../Modulo'
import { Finestra } from '../ui'
import { salvaVettura } from './salvaVettura'

const opzioniSocieta = (contribuenti: Contribuente[]): Opzione[] =>
  [...contribuenti].sort((a, b) => a.nome.localeCompare(b.nome, 'it')).map((c) => ({ valore: c.id, etichetta: c.nome }))

function campi(contribuenti: Contribuente[], nuova: boolean): CampoDef<ValoriVettura>[] {
  return [
    { nome: 'societa', etichetta: nuova ? 'Società intestataria' : 'Società intestataria attuale', tipo: 'select', opzioni: opzioniSocieta(contribuenti), obbligatorio: nuova, intera: true, sezione: 'Vettura',
      aiuto: nuova ? 'Le società sono quelle dei Tributi: se manca, aggiungerla lì.' : 'Solo per correggere o abbinare. Per un passaggio a un\'altra società usare «Cambio intestazione».' },
    { nome: 'targa', etichetta: 'Targa', tipo: 'testo', obbligatorio: true },
    { nome: 'marca', etichetta: 'Marca', tipo: 'testo' },
    { nome: 'modello', etichetta: 'Modello', tipo: 'testo', obbligatorio: true },
    { nome: 'alimentazione', etichetta: 'Alimentazione', tipo: 'testo' },
    { nome: 'telaio', etichetta: 'N. telaio', tipo: 'testo' },
    { nome: 'data_immatricolazione', etichetta: 'Immatricolazione', tipo: 'data' },
    { nome: 'possesso', etichetta: 'Possesso', tipo: 'select', opzioni: POSSESSI, obbligatorio: true, sezione: 'Possesso e stato' },
    { nome: 'stato', etichetta: 'Stato', tipo: 'select', opzioni: STATI_VEICOLO, obbligatorio: true },
    { nome: 'data_inizio', etichetta: 'Nel gruppo dal', tipo: 'data' },
    { nome: 'data_fine', etichetta: 'Venduta / restituita il', tipo: 'data', aiuto: 'Obbligatoria se la vettura non è più in uso.' },
    { nome: 'uscita_note', etichetta: 'Venduta / restituita a', tipo: 'testo', intera: true },
    { nome: 'fin_societa', etichetta: 'Società di leasing / noleggio', tipo: 'testo', sezione: 'Contratto (solo leasing e noleggio)' },
    { nome: 'fin_numero', etichetta: 'N. contratto', tipo: 'testo' },
    { nome: 'fin_decorrenza', etichetta: 'Decorrenza', tipo: 'data' },
    { nome: 'fin_scadenza', etichetta: 'Scadenza contratto', tipo: 'data' },
    { nome: 'fin_canone', etichetta: 'Canone mensile', tipo: 'euro' },
    { nome: 'fin_anticipo', etichetta: 'Anticipo', tipo: 'euro' },
    { nome: 'fin_riscatto', etichetta: 'Riscatto (leasing)', tipo: 'euro' },
    { nome: 'fin_km', etichetta: 'Km inclusi', tipo: 'numero' },
    { nome: 'fin_bollo', etichetta: 'Bollo incluso', tipo: 'select', opzioni: SI_NO },
    { nome: 'fin_assicurazione', etichetta: 'Assicurazione inclusa', tipo: 'select', opzioni: SI_NO },
    { nome: 'note', etichetta: 'Note', tipo: 'textarea', intera: true, sezione: 'Note' },
  ]
}

export default function EditorVettura({ iniziale, contribuenti, aperta, onChiudi, nuova }: {
  iniziale: Veicolo | null; contribuenti: Contribuente[]; aperta: boolean; onChiudi: () => void; nuova?: boolean
}) {
  const { token, nome } = useSessioneAttiva()
  const navigate = useNavigate()
  const elenco = campi(contribuenti, !!nuova)
  async function salva(valori: Partial<ValoriVettura>) {
    if (!iniziale) return
    const vettura = applicaValoriVettura(iniziale, { ...valoriVettura(iniziale), ...valori } as ValoriVettura)
    await salvaVettura(token, nome, vettura, nuova ? null : iniziale, nuova ? 'nuova vettura' : 'modifica vettura')
    onChiudi()
    if (nuova) navigate(`/flotta/vettura/${vettura.id}`)
  }
  return (
    <Finestra kicker="Flotta" titolo={nuova ? 'Nuova vettura' : `Modifica vettura${iniziale ? ` — ${iniziale.targa}` : ''}`} aperta={aperta} onChiudi={onChiudi} larga>
      {iniziale && <Modulo<ValoriVettura> campi={elenco} iniziale={valoriVettura(iniziale)} onSalva={salva} onAnnulla={onChiudi} />}
    </Finestra>
  )
}
