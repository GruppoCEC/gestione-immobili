/** Salvataggio di una vettura della flotta (nuova o modificata), condiviso da tutte le finestre della scheda. */
import { avvisa } from '../../lib/aggiornamenti'
import { normalizzaTarga } from '../../lib/flotta'
import { aggiorna, attivi, campiModifica, descriviUnione, sostituisciUnendo, type EsitoUnione } from '../../lib/store'
import type { Veicolo } from '../../lib/tipi'

/** Salva una vettura (nuova o modificata) unendo le modifiche di un collega; controlla che la targa non sia già presente. */
export async function salvaVettura(token: string, nome: string, vettura: Veicolo, iniziale: Veicolo | null, azione: string): Promise<void> {
  let esito: EsitoUnione | null = null
  await aggiorna<Veicolo>(token, 'veicoli', (rec) => {
    const doppia = attivi(rec).find((r) => r.id !== vettura.id && normalizzaTarga(r.targa) === vettura.targa)
    if (doppia) throw new Error(`Targa già presente nella flotta: ${[doppia.marca, doppia.modello].filter(Boolean).join(' ')} ${doppia.targa}. Cercarla nell'elenco (anche tra le vetture passate).`)
    if (!iniziale) return [...rec, vettura]
    const u = sostituisciUnendo(rec, vettura.id, { ...vettura, ...campiModifica(nome) }, iniziale, nome)
    esito = u.esito
    return u.record
  }, `${nome}: ${azione} ${vettura.targa}`)
  avvisa(descriviUnione(esito, { intestazioni: 'Intestazioni', scadenze: 'Scadenze', km: 'Km', coperture: 'Coperture', conducenti: 'Conducenti', contratto: 'Contratto', note: 'Note', stato: 'Stato' }))
}
