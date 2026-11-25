/** Finestre della scheda vettura: passaggio a un'altra società del gruppo e uscita (vendita, restituzione, altro). */
import { cambiaIntestazione, intestazioneAttuale, nomeIntestatario, registraUscita } from '../../lib/flotta'
import { useSessioneAttiva } from '../../lib/sessione'
import { STATI_VEICOLO, type Contribuente, type StatoVeicolo, type Veicolo } from '../../lib/tipi'
import { oggiIso } from '../../lib/utils/formato'
import Modulo, { type CampoDef } from '../Modulo'
import { Finestra } from '../ui'
import { salvaVettura } from './salvaVettura'

interface ValoriCambio { dal: string; societa: string }

export function FinestraCambioIntestazione({ vettura, contribuenti, aperta, onChiudi }: { vettura: Veicolo; contribuenti: Contribuente[]; aperta: boolean; onChiudi: () => void }) {
  const { token, nome } = useSessioneAttiva()
  const attuale = intestazioneAttuale(vettura)
  const opzioni = [...contribuenti].filter((c) => c.id !== attuale?.contribuente_id).sort((a, b) => a.nome.localeCompare(b.nome, 'it')).map((c) => ({ valore: c.id, etichetta: c.nome }))
  const campi: CampoDef<ValoriCambio>[] = [
    { nome: 'societa', etichetta: 'Nuova società intestataria', tipo: 'select', opzioni, obbligatorio: true, intera: true, aiuto: `Oggi: ${nomeIntestatario(attuale, contribuenti)}. L'intestazione attuale si chiude il giorno prima del passaggio.` },
    { nome: 'dal', etichetta: 'Data del passaggio', tipo: 'data', obbligatorio: true },
  ]
  async function salva(v: Partial<ValoriCambio>) {
    const nuovo = cambiaIntestazione(vettura, v.societa ?? '', v.dal ?? '')
    await salvaVettura(token, nome, nuovo, vettura, `cambio intestazione a ${contribuenti.find((c) => c.id === v.societa)?.nome ?? ''}`)
    onChiudi()
  }
  return (
    <Finestra kicker={`${vettura.modello} · ${vettura.targa}`} titolo="Cambio intestazione" aperta={aperta} onChiudi={onChiudi}>
      {aperta && <Modulo<ValoriCambio> campi={campi} iniziale={{ dal: oggiIso(), societa: '' }} onSalva={salva} onAnnulla={onChiudi} etichettaSalva="Registra il passaggio" />}
    </Finestra>
  )
}

interface ValoriUscita { stato: string; data_fine: string; uscita_note: string }

export function FinestraUscita({ vettura, aperta, onChiudi }: { vettura: Veicolo; aperta: boolean; onChiudi: () => void }) {
  const { token, nome } = useSessioneAttiva()
  const campi: CampoDef<ValoriUscita>[] = [
    { nome: 'stato', etichetta: 'Cosa è successo', tipo: 'select', opzioni: STATI_VEICOLO.filter((o) => o.valore !== 'in_uso'), obbligatorio: true, stile: 'radio' },
    { nome: 'data_fine', etichetta: 'Data', tipo: 'data', obbligatorio: true },
    { nome: 'uscita_note', etichetta: 'A chi (acquirente, concessionario, società di noleggio)', tipo: 'testo', intera: true },
  ]
  async function salva(v: Partial<ValoriUscita>) {
    const stato = (v.stato ?? 'venduta') as Exclude<StatoVeicolo, 'in_uso'>
    await salvaVettura(token, nome, registraUscita(vettura, { stato, data_fine: v.data_fine ?? '', uscita_note: v.uscita_note ?? '' }), vettura, stato === 'venduta' ? 'vettura venduta' : stato === 'restituita' ? 'vettura restituita' : 'vettura uscita dalla flotta')
    onChiudi()
  }
  return (
    <Finestra kicker={`${vettura.modello} · ${vettura.targa}`} titolo="Vettura venduta / restituita" aperta={aperta} onChiudi={onChiudi}>
      {aperta && <Modulo<ValoriUscita> campi={campi} iniziale={{ stato: vettura.possesso === 'proprieta' ? 'venduta' : 'restituita', data_fine: oggiIso(), uscita_note: '' }} onSalva={salva} onAnnulla={onChiudi} />}
    </Finestra>
  )
}
