/**
 * Scadenze di una vettura: voci fisse (bollo, revisione, assicurazione, tagliando), voci libere e fine del contratto.
 * "Segna fatto" mette la scadenza nello storico e propone la successiva (bollo e assicurazione +12 mesi, revisione
 * fine mese +24 mesi, tagliando +12 mesi), sempre correggibile. `FinestraSegnaFatto` si usa anche nella scheda Scadenze.
 */
import { Fragment, useState } from 'react'
import { Check, History, Pencil, Plus } from 'lucide-react'
import { etichettaVoce, primaRevisione, propostaRinnovo, segnaFatta, statoScadenza, dataFlotta } from '../../lib/flotta'
import { nuovoId } from '../../lib/store'
import { useSessioneAttiva } from '../../lib/sessione'
import type { ScadenzaVeicolo, Veicolo } from '../../lib/tipi'
import { formattaEuro, oggiIso } from '../../lib/utils/formato'
import Modulo, { type CampoDef } from '../Modulo'
import { SoloSeModifica } from '../SoloLettura'
import { Bottone, Etichetta, Finestra } from '../ui'
import { salvaVettura } from './salvaVettura'
import { Sezione } from './ElencoInRiga'

interface ValoriFatto { data_fatto: string; importo_cent: number | null; note: string; nuova_scadenza: string }

/** Finestra "Segna fatto / pagato" di una voce: salva subito la vettura. */
export function FinestraSegnaFatto({ vettura, voceId, onChiudi }: { vettura: Veicolo | null; voceId: string | null; onChiudi: () => void }) {
  const { token, nome } = useSessioneAttiva()
  const voce = vettura?.scadenze.find((s) => s.id === voceId) ?? null
  const oggi = oggiIso()
  const campi: CampoDef<ValoriFatto>[] = [
    { nome: 'data_fatto', etichetta: voce?.tipo === 'bollo' || voce?.tipo === 'assicurazione' ? 'Pagato il' : 'Fatto il', tipo: 'data', obbligatorio: true },
    { nome: 'importo_cent', etichetta: 'Importo pagato', tipo: 'euro' },
    { nome: 'nuova_scadenza', etichetta: 'Prossima scadenza', tipo: 'data', aiuto: 'Proposta in automatico: correggerla se serve (vuota = nessun rinnovo).' },
    { nome: 'note', etichetta: 'Note', tipo: 'textarea', intera: true },
  ]
  async function salva(v: Partial<ValoriFatto>) {
    if (!vettura || !voce) return
    const x = v as ValoriFatto
    await salvaVettura(token, nome, segnaFatta(vettura, voce.id, { data_fatto: x.data_fatto, importo_cent: x.importo_cent, note: x.note ?? '', nuova_scadenza: x.nuova_scadenza ?? '' }), vettura, `${etichettaVoce(voce).toLowerCase()} fatto/pagato`)
    onChiudi()
  }
  return (
    <Finestra kicker={vettura ? `${vettura.modello} · ${vettura.targa}` : 'Flotta'} titolo={voce ? `${etichettaVoce(voce)}: segna fatto` : ''} aperta={!!voce} onChiudi={onChiudi}>
      {voce && (
        <Modulo<ValoriFatto> campi={campi} etichettaSalva="Segna fatto"
          iniziale={{ data_fatto: oggi, importo_cent: voce.importo_cent, note: '', nuova_scadenza: propostaRinnovo(voce, oggi) }}
          derivati={(v, campo) => (campo === 'data_fatto' && v.data_fatto ? { nuova_scadenza: propostaRinnovo(voce, v.data_fatto) } : {})}
          onSalva={salva} onAnnulla={onChiudi} />
      )}
    </Finestra>
  )
}

interface ValoriVoce {
  descrizione: string; scadenza: string; importo_cent: number | null; non_dovuta: string; rinnovo_mesi: number | null
  superbollo_cent: number | null; compagnia: string; numero_polizza: string; entro_km: string
}

function campiVoce(tipo: ScadenzaVeicolo['tipo']): CampoDef<ValoriVoce>[] {
  const c: CampoDef<ValoriVoce>[] = []
  if (tipo === 'altro') c.push({ nome: 'descrizione', etichetta: 'Descrizione', tipo: 'testo', obbligatorio: true, intera: true })
  c.push({ nome: 'scadenza', etichetta: 'Scadenza', tipo: 'data' })
  c.push({ nome: 'importo_cent', etichetta: tipo === 'assicurazione' ? 'Premio' : 'Importo', tipo: 'euro' })
  if (tipo === 'bollo') c.push({ nome: 'superbollo_cent', etichetta: 'Superbollo', tipo: 'euro' })
  if (tipo === 'assicurazione') c.push({ nome: 'compagnia', etichetta: 'Compagnia', tipo: 'testo' }, { nome: 'numero_polizza', etichetta: 'N. polizza', tipo: 'testo' })
  if (tipo === 'tagliando') c.push({ nome: 'entro_km', etichetta: 'O entro i km', tipo: 'testo' })
  if (tipo === 'altro') c.push({ nome: 'rinnovo_mesi', etichetta: 'Si rinnova ogni (mesi)', tipo: 'numero', aiuto: 'Vuoto = nessun rinnovo automatico.' })
  c.push({ nome: 'non_dovuta', etichetta: 'Non dovuta perché', tipo: 'testo', intera: true, aiuto: 'Es. "esente fino al 2027", "incluso nel noleggio". Se compilato, la voce non ha scadenza.' })
  return c
}

function valoriVoce(s: ScadenzaVeicolo, v: Veicolo): ValoriVoce {
  // Revisione mai indicata: si propone la prima (4 anni dall'immatricolazione)
  const scadenza = s.scadenza || (s.tipo === 'revisione' && v.data_immatricolazione && !s.storico.length ? primaRevisione(v.data_immatricolazione) : '')
  return {
    descrizione: s.descrizione, scadenza, importo_cent: s.importo_cent, non_dovuta: s.non_dovuta, rinnovo_mesi: s.rinnovo_mesi,
    superbollo_cent: s.superbollo_cent ?? null, compagnia: s.compagnia ?? '', numero_polizza: s.numero_polizza ?? '', entro_km: s.entro_km ?? '',
  }
}

function FinestraVoce({ vettura, voce, onChiudi }: { vettura: Veicolo; voce: ScadenzaVeicolo | null; onChiudi: () => void }) {
  const { token, nome } = useSessioneAttiva()
  const nuova = !!voce && !vettura.scadenze.some((s) => s.id === voce.id)
  async function salva(x: Partial<ValoriVoce>) {
    if (!voce) return
    const aggiornata: ScadenzaVeicolo = { ...voce, ...(x as ValoriVoce), descrizione: (x.descrizione ?? '').trim(), non_dovuta: (x.non_dovuta ?? '').trim() }
    const scadenze = nuova ? [...vettura.scadenze, aggiornata] : vettura.scadenze.map((s) => (s.id === voce.id ? aggiornata : s))
    await salvaVettura(token, nome, { ...vettura, scadenze }, vettura, nuova ? `nuova scadenza ${aggiornata.descrizione}` : `modifica scadenza ${etichettaVoce(aggiornata).toLowerCase()}`)
    onChiudi()
  }
  async function elimina() {
    if (!voce) return
    await salvaVettura(token, nome, { ...vettura, scadenze: vettura.scadenze.filter((s) => s.id !== voce.id) }, vettura, `elimina scadenza ${etichettaVoce(voce).toLowerCase()}`)
    onChiudi()
  }
  return (
    <Finestra kicker={`${vettura.modello} · ${vettura.targa}`} titolo={voce ? (nuova ? 'Nuova scadenza' : etichettaVoce(voce)) : ''} aperta={!!voce} onChiudi={onChiudi}>
      {voce && <Modulo<ValoriVoce> campi={campiVoce(voce.tipo)} iniziale={valoriVoce(voce, vettura)} onSalva={salva} onAnnulla={onChiudi}
        onElimina={voce.tipo === 'altro' && !nuova ? elimina : undefined} />}
    </Finestra>
  )
}

function dettagli(s: ScadenzaVeicolo): string {
  return [
    s.superbollo_cent ? `superbollo ${formattaEuro(s.superbollo_cent)}` : '', s.compagnia ?? '', s.numero_polizza ? `polizza ${s.numero_polizza}` : '',
    s.entro_km ? `o entro ${s.entro_km} km` : '', s.rinnovo_mesi ? `ogni ${s.rinnovo_mesi} mesi` : '',
  ].filter(Boolean).join(' · ')
}

export default function ScadenzeVettura({ vettura }: { vettura: Veicolo }) {
  const [fatto, setFatto] = useState<string | null>(null)
  const [voce, setVoce] = useState<ScadenzaVeicolo | null>(null)
  const [storico, setStorico] = useState<string | null>(null)
  const oggi = oggiIso()
  const inUso = vettura.stato === 'in_uso'
  const fine = vettura.possesso !== 'proprieta' ? vettura.contratto?.scadenza ?? '' : ''

  return (
    <Sezione titolo="Scadenze" azioni={<SoloSeModifica><Bottone piccolo variante="secondario" onClick={() => setVoce({ id: nuovoId(), tipo: 'altro', descrizione: '', scadenza: '', importo_cent: null, non_dovuta: '', rinnovo_mesi: null, storico: [] })}><Plus size={14} /> Altra scadenza</Bottone></SoloSeModifica>}>
      {!inUso && <p className="m-0 mb-3 text-sm text-neutro-700">Vettura non più in uso: le scadenze non vengono più seguite (resta lo storico).</p>}
      <div className="overflow-x-auto">
        <table className="tabella">
          <thead><tr><th>Voce</th><th>Scadenza</th><th className="text-right">Importo</th><th>Dettagli</th><th /></tr></thead>
          <tbody>
            {vettura.scadenze.map((s) => {
              const st = statoScadenza(s.scadenza, oggi)
              return (
                <Fragment key={s.id}>
                  <tr>
                    <td className="font-semibold">{etichettaVoce(s)}</td>
                    <td>{s.non_dovuta ? <span className="text-neutro-700">non dovuta: {s.non_dovuta}</span>
                      : <>{dataFlotta(s.scadenza) || '—'} {inUso && s.scadenza && <Etichetta tono={st.tono}>{st.testo}</Etichetta>}</>}</td>
                    <td className="num text-right">{s.importo_cent ? formattaEuro(s.importo_cent) : ''}</td>
                    <td className="text-[13px] text-neutro-700">{dettagli(s)}</td>
                    <td className="whitespace-nowrap text-right">
                      {s.storico.length > 0 && <button type="button" title="Storico" onClick={() => setStorico(storico === s.id ? null : s.id)} className="btn btn-ghost btn-piccolo"><History size={14} /> {s.storico.length}</button>}
                      <SoloSeModifica>
                        {inUso && !s.non_dovuta && <Bottone piccolo variante="secondario" onClick={() => setFatto(s.id)}><Check size={14} /> Segna fatto</Bottone>}
                        <button type="button" title="Modifica" onClick={() => setVoce(s)} className="btn btn-ghost btn-piccolo"><Pencil size={14} /></button>
                      </SoloSeModifica>
                    </td>
                  </tr>
                  {storico === s.id && [...s.storico].reverse().map((e, i) => (
                    <tr key={i} className="text-[13px] text-neutro-700">
                      <td className="pl-6">fatto il {dataFlotta(e.data_fatto)}</td>
                      <td>scadenza coperta {dataFlotta(e.scadenza_coperta) || '—'}</td>
                      <td className="num text-right">{e.importo_cent ? formattaEuro(e.importo_cent) : ''}</td>
                      <td colSpan={2}>{e.note}</td>
                    </tr>
                  ))}
                </Fragment>
              )
            })}
            {fine && (
              <tr>
                <td className="font-semibold">{vettura.possesso === 'leasing' ? 'Fine leasing' : 'Fine noleggio'}</td>
                <td>{dataFlotta(fine)} {inUso && <Etichetta tono={statoScadenza(fine, oggi).tono}>{statoScadenza(fine, oggi).testo}</Etichetta>}</td>
                <td /><td className="text-[13px] text-neutro-700">{vettura.contratto?.societa_finanziaria}</td><td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <FinestraSegnaFatto vettura={vettura} voceId={fatto} onChiudi={() => setFatto(null)} />
      <FinestraVoce vettura={vettura} voce={voce} onChiudi={() => setVoce(null)} />
    </Sezione>
  )
}
