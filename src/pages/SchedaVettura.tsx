/**
 * Scheda di una vettura della flotta: dati e contratto, scadenze, km, conducenti, coperture, intestazioni nel tempo,
 * multe e allegati. Da qui si registrano il cambio di intestazione e la vendita / restituzione.
 */
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRightLeft, CheckCheck, LogOut, Pencil, Plus, Printer, Trash2 } from 'lucide-react'
import EditorMulta from '../components/flotta/EditorMulta'
import EditorVettura from '../components/flotta/EditorVettura'
import { salvaVettura } from '../components/flotta/salvaVettura'
import ElencoInRiga, { Sezione } from '../components/flotta/ElencoInRiga'
import { FinestraCambioIntestazione, FinestraUscita } from '../components/flotta/FinestreVettura'
import ScadenzeVettura from '../components/flotta/ScadenzeVettura'
import Allegati from '../components/Allegati'
import { SoloSeModifica } from '../components/SoloLettura'
import { Avviso, Bottone, Caricamento, Etichetta, IntestazionePagina } from '../components/ui'
import { avvisiMulta, dataRiferimentoMulta, intestazioneAl, intestazioneAttuale, nomeIntestatario, nuovaMulta, proiezioneKm, totaleMulta, dataFlotta } from '../lib/flotta'
import { useSessioneAttiva } from '../lib/sessione'
import { aggiorna, attivi, campiModifica, nuovoId } from '../lib/store'
import { CATEGORIE_ALLEGATO_FLOTTA, POSSESSI, SI_NO, STATI_MULTA, STATI_VEICOLO, TIPI_COPERTURA, etichettaDi, type Conducente, type Contribuente, type Copertura, type LetturaKm, type MultaVeicolo, type Veicolo } from '../lib/tipi'
import { useCollezioni } from '../lib/useCollezioni'
import { formattaEuro } from '../lib/utils/formato'

function Dato({ etichetta, children }: { etichetta: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-divisore py-1.5 text-sm last:border-0">
      <span className="w-[170px] flex-none text-neutro-700">{etichetta}</span>
      <span className="min-w-0">{children || <span className="text-neutro-600">—</span>}</span>
    </div>
  )
}

export default function SchedaVettura() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { token, nome } = useSessioneAttiva()
  const { dati, caricamento, errore } = useCollezioni(['veicoli', 'multe_veicoli', 'contribuenti'])
  const [finestra, setFinestra] = useState<'modifica' | 'intestazione' | 'uscita' | null>(null)
  const [multa, setMulta] = useState<{ m: MultaVeicolo; nuova: boolean } | null>(null)
  const [confermaElimina, setConfermaElimina] = useState(false)
  const [erroreAzione, setErroreAzione] = useState<string | null>(null)

  const veicoli = attivi(dati<Veicolo>('veicoli'))
  const contribuenti = attivi(dati<Contribuente>('contribuenti'))
  const v = veicoli.find((x) => x.id === id)
  if (caricamento && !v) return <Caricamento />
  if (!v) return <div className="p-6">Vettura non trovata. <Link to="/flotta" className="underline">Torna alla flotta</Link></div>

  const multe = attivi(dati<MultaVeicolo>('multe_veicoli')).filter((m) => m.veicolo_id === v.id).sort((a, b) => dataRiferimentoMulta(b).localeCompare(dataRiferimentoMulta(a)))
  const attuale = intestazioneAttuale(v)
  const km = proiezioneKm(v)
  const c = v.contratto
  const salvaElenco = (campo: 'km' | 'conducenti' | 'coperture', etichetta: string) => (righe: unknown[], azione: string) =>
    salvaVettura(token, nome, { ...v, [campo]: righe }, v, `${etichetta}: ${azione}`)
  const esegui = async (f: () => Promise<void>) => { setErroreAzione(null); try { await f() } catch (e) { setErroreAzione((e as Error).message) } }

  async function elimina() {
    await aggiorna<Veicolo>(token, 'veicoli', (rec) => rec.map((r) => (r.id === v!.id ? { ...r, eliminato_il: new Date().toISOString(), ...campiModifica(nome) } : r)), `${nome}: elimina vettura ${v!.targa}`)
    navigate('/flotta')
  }

  return (
    <div>
      <Link to="/flotta" className="btn btn-ghost mb-2 no-underline"><ArrowLeft size={16} /> Flotta</Link>
      <IntestazionePagina kicker={`Flotta · ${nomeIntestatario(attuale, contribuenti)}`}
        titolo={<>{[v.marca, v.modello].filter(Boolean).join(' ')} <span className="num">{v.targa}</span></>}
        sottotitolo={<span className="flex flex-wrap items-center gap-2">
          <Etichetta tono={v.stato === 'in_uso' ? 'verde' : 'grigio'}>{etichettaDi(STATI_VEICOLO, v.stato)}{v.stato !== 'in_uso' && v.data_fine ? ` il ${dataFlotta(v.data_fine)}` : ''}</Etichetta>
          <span>{etichettaDi(POSSESSI, v.possesso)}{c?.societa_finanziaria ? ` · ${c.societa_finanziaria}` : ''}</span>
          {v.uscita_note && <span>· a {v.uscita_note}</span>}
          {v.da_verificare && <Etichetta tono="giallo">dati del vecchio Excel, da verificare</Etichetta>}
        </span>}
        azioni={<>
          <Link to={`/stampa/flotta/vettura/${v.id}`} className="btn btn-secondario no-underline"><Printer size={16} /> Stampa</Link>
          <SoloSeModifica>
            {v.da_verificare && <Bottone variante="secondario" onClick={() => esegui(() => salvaVettura(token, nome, { ...v, da_verificare: false }, v, 'dati verificati'))}><CheckCheck size={16} /> Dati verificati</Bottone>}
            <Bottone variante="secondario" onClick={() => setFinestra('modifica')}><Pencil size={16} /> Modifica dati</Bottone>
            {v.stato === 'in_uso' && <Bottone variante="secondario" onClick={() => setFinestra('intestazione')}><ArrowRightLeft size={16} /> Cambio intestazione</Bottone>}
            {v.stato === 'in_uso' && <Bottone variante="secondario" onClick={() => setFinestra('uscita')}><LogOut size={16} /> Venduta / restituita</Bottone>}
          </SoloSeModifica>
        </>} />
      {(errore || erroreAzione) && <div className="mb-4"><Avviso tipo="errore">{errore || erroreAzione}</Avviso></div>}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="lg:col-span-2"><ScadenzeVettura vettura={v} /></div>

        <div className="lg:col-span-2">
        <Sezione titolo="Multe e cartelle" azioni={<SoloSeModifica><Bottone piccolo variante="secondario" onClick={() => setMulta({ m: nuovaMulta(nome, v.id), nuova: true })}><Plus size={14} /> Nuova</Bottone></SoloSeModifica>}>
          {multe.length === 0 ? <p className="m-0 text-sm text-neutro-700">Nessuna multa o cartella.</p> : (
            <table className="tabella">
              <thead><tr><th>Data</th><th>Ente</th><th>Società allora</th><th className="text-right">Totale</th><th>Stato</th></tr></thead>
              <tbody>{multe.map((m) => {
                const av = avvisiMulta(m, v, contribuenti)
                return (
                  <tr key={m.id} className="cliccabile" onClick={() => setMulta({ m, nuova: false })}>
                    <td>{m.data_fatto ? dataFlotta(m.data_fatto) : m.anno_riferimento ? `bollo ${m.anno_riferimento}` : '—'}</td>
                    <td>{m.ente}{m.numero_verbale ? ` · ${m.numero_verbale}` : ''}</td>
                    <td>{nomeIntestatario(intestazioneAl(v, dataRiferimentoMulta(m)), contribuenti)}</td>
                    <td className="num text-right">{formattaEuro(totaleMulta(m))}</td>
                    <td><Etichetta tono={m.stato === 'da_pagare' ? 'rosso' : 'grigio'}>{etichettaDi(STATI_MULTA, m.stato)}</Etichetta>{av.some((a) => a.tipo === 'errore') && <> <Etichetta tono="rosso">da contestare</Etichetta></>}</td>
                  </tr>
                )
              })}</tbody>
            </table>
          )}
        </Sezione>
        </div>

        <Sezione titolo="Dati e contratto">
          <Dato etichetta="Società attuale">{nomeIntestatario(attuale, contribuenti)}</Dato>
          <Dato etichetta="Alimentazione">{v.alimentazione}</Dato>
          <Dato etichetta="N. telaio">{v.telaio}</Dato>
          <Dato etichetta="Immatricolazione">{dataFlotta(v.data_immatricolazione)}</Dato>
          <Dato etichetta="Nel gruppo">{v.data_inizio || v.data_fine ? `${v.data_inizio ? `dal ${dataFlotta(v.data_inizio)}` : ''}${v.data_fine ? ` al ${dataFlotta(v.data_fine)}` : ''}` : ''}</Dato>
          {c && <>
            <Dato etichetta="Contratto">{[c.societa_finanziaria, c.numero && `n. ${c.numero}`].filter(Boolean).join(' · ')}</Dato>
            <Dato etichetta="Durata">{c.decorrenza || c.scadenza ? `${dataFlotta(c.decorrenza) || '—'} → ${dataFlotta(c.scadenza) || '—'}` : ''}</Dato>
            <Dato etichetta="Canone mensile">{c.canone_mensile_cent ? formattaEuro(c.canone_mensile_cent) : ''}</Dato>
            <Dato etichetta="Anticipo / riscatto">{[c.anticipo_cent && `anticipo ${formattaEuro(c.anticipo_cent)}`, c.riscatto_cent && `riscatto ${formattaEuro(c.riscatto_cent)}`].filter(Boolean).join(' · ')}</Dato>
            <Dato etichetta="Km inclusi">{c.km_inclusi ? c.km_inclusi.toLocaleString('it-IT') : ''}</Dato>
            <Dato etichetta="Inclusi nel canone">{[c.bollo_incluso && `bollo: ${etichettaDi(SI_NO, c.bollo_incluso)}`, c.assicurazione_inclusa && `assicurazione: ${etichettaDi(SI_NO, c.assicurazione_inclusa)}`].filter(Boolean).join(' · ')}</Dato>
          </>}
          {v.note && <Dato etichetta="Note"><span className="whitespace-pre-line">{v.note}</span></Dato>}
        </Sezione>

        <div>
          <ElencoInRiga<LetturaKm> titolo="Km" righe={v.km} ordina={(a, b) => b.data.localeCompare(a.data)} vuoto="Nessuna lettura dei km."
            colonne={[{ nome: 'data', etichetta: 'Data', tipo: 'data', obbligatorio: true }, { nome: 'km', etichetta: 'Km', tipo: 'numero', obbligatorio: true }, { nome: 'note', etichetta: 'Note', tipo: 'testo' }]}
            nuova={() => ({ data: '', km: 0, note: '' })} onSalva={salvaElenco('km', 'km')} />
          {km && <div className="mt-2"><Avviso tipo={km.supera ? 'attenzione' : 'info'}>A questo ritmo a fine contratto: circa {km.km_previsti.toLocaleString('it-IT')} km (inclusi {c?.km_inclusi?.toLocaleString('it-IT')}).</Avviso></div>}
        </div>

        <ElencoInRiga<Conducente> titolo="Conducenti" righe={v.conducenti} ordina={(a, b) => (b.dal || '').localeCompare(a.dal || '')} vuoto="Nessun conducente indicato."
          colonne={[{ nome: 'nome', etichetta: 'Chi guida', tipo: 'testo', obbligatorio: true }, { nome: 'dal', etichetta: 'Dal', tipo: 'data' }, { nome: 'al', etichetta: 'Al', tipo: 'data' }]}
          nuova={() => ({ nome: '', dal: '', al: '' })} onSalva={salvaElenco('conducenti', 'conducenti')} />

        <ElencoInRiga<Copertura> titolo="Coperture e garanzie" righe={v.coperture} vuoto="Nessuna copertura o garanzia accessoria."
          colonne={[{ nome: 'tipo', etichetta: 'Tipo', tipo: 'select', opzioni: TIPI_COPERTURA, obbligatorio: true }, { nome: 'fornitore', etichetta: 'Fornitore', tipo: 'testo' }, { nome: 'numero', etichetta: 'N.', tipo: 'testo' }, { nome: 'scadenza', etichetta: 'Scadenza', tipo: 'data' }, { nome: 'note', etichetta: 'Note', tipo: 'testo' }]}
          nuova={() => ({ id: nuovoId(), tipo: '', fornitore: '', numero: '', scadenza: '', note: '' })} onSalva={salvaElenco('coperture', 'coperture')} />

        <Sezione titolo="Intestazioni nel tempo" azioni={v.stato === 'in_uso' ? <SoloSeModifica><Bottone piccolo variante="secondario" onClick={() => setFinestra('intestazione')}><ArrowRightLeft size={14} /> Cambio intestazione</Bottone></SoloSeModifica> : undefined}>
          {v.intestazioni.length === 0 ? <p className="m-0 text-sm text-neutro-700">Nessuna società indicata: usare «Modifica dati».</p> : (
            <table className="tabella">
              <thead><tr><th>Società</th><th>Dal</th><th>Al</th></tr></thead>
              <tbody>{[...v.intestazioni].reverse().map((i, n) => (
                <tr key={n}><td>{nomeIntestatario(i, contribuenti)}{!i.contribuente_id && <> <Etichetta tono="giallo">da abbinare</Etichetta></>}</td><td>{dataFlotta(i.dal) || 'non nota'}</td><td>{dataFlotta(i.al) || 'oggi'}</td></tr>
              ))}</tbody>
            </table>
          )}
        </Sezione>

        <div className="lg:col-span-2">
          <Allegati collezione="veicoli" recordId={v.id} categorie={CATEGORIE_ALLEGATO_FLOTTA} descrizione={`vettura ${v.targa}`} />
        </div>
      </div>

      <SoloSeModifica>
        <div className="mt-8 flex items-center gap-3 border-t border-divisore pt-4">
          {!confermaElimina
            ? <Bottone variante="secondario" onClick={() => setConfermaElimina(true)}><Trash2 size={16} /> Elimina la vettura</Bottone>
            : <>
              <span className="text-sm">Eliminare la vettura {v.targa}? Usarlo solo per un doppione o un errore: una vettura venduta va segnata «Venduta / restituita».</span>
              <Bottone onClick={() => esegui(elimina)}>Sì, elimina</Bottone>
              <Bottone variante="secondario" onClick={() => setConfermaElimina(false)}>Annulla</Bottone>
            </>}
        </div>
      </SoloSeModifica>

      <EditorVettura iniziale={finestra === 'modifica' ? v : null} contribuenti={contribuenti} aperta={finestra === 'modifica'} onChiudi={() => setFinestra(null)} />
      <FinestraCambioIntestazione vettura={v} contribuenti={contribuenti} aperta={finestra === 'intestazione'} onChiudi={() => setFinestra(null)} />
      <FinestraUscita vettura={v} aperta={finestra === 'uscita'} onChiudi={() => setFinestra(null)} />
      <EditorMulta iniziale={multa?.m ?? null} nuova={multa?.nuova ?? false} veicoli={veicoli} contribuenti={contribuenti} aperta={!!multa} onChiudi={() => setMulta(null)} />
    </div>
  )
}
