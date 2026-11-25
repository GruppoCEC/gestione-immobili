/**
 * Finestra di una multa o cartella del bollo. La vettura si sceglie scrivendo la targa (anche tra le vetture passate);
 * dalla data di notifica si propongono le scadenze, dalla data del fatto il conducente. Gli avvisi ("già venduta",
 * "intestata a un'altra società") si vedono mentre si scrive.
 */
import { useState, type ReactNode } from 'react'
import { avvisa } from '../../lib/aggiornamenti'
import { avvisiMulta, conducenteAl, dataRiferimentoMulta, intestazioneAl, nomeIntestatario, normalizzaTarga, proponiScadenzeMulta } from '../../lib/flotta'
import { useSessioneAttiva } from '../../lib/sessione'
import { aggiorna, campiModifica, descriviUnione, sostituisciUnendo, type EsitoUnione } from '../../lib/store'
import { CATEGORIE_ALLEGATO_FLOTTA, STATI_MULTA, TIPI_MULTA, type Contribuente, type MultaVeicolo, type Veicolo } from '../../lib/tipi'
import Allegati from '../Allegati'
import { useSoloLettura } from '../SoloLettura'
import { Avviso, Bottone, Finestra, InputEuro, useModificheNonSalvate } from '../ui'

function Campo({ etichetta, children, intera, aiuto }: { etichetta: string; children: ReactNode; intera?: boolean; aiuto?: string }) {
  return (
    <label className={`block ${intera ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block text-[13px] font-semibold">{etichetta}</span>
      {children}
      {aiuto && <span className="mt-1 block text-[12px] text-neutro-700">{aiuto}</span>}
    </label>
  )
}

function Corpo({ iniziale, nuova, veicoli, contribuenti, onChiudi }: { iniziale: MultaVeicolo; nuova: boolean; veicoli: Veicolo[]; contribuenti: Contribuente[]; onChiudi: () => void }) {
  const { token, nome } = useSessioneAttiva()
  const soloLettura = useSoloLettura()
  const [m, setM] = useState(iniziale)
  // Ultima versione salvata: serve per l'avviso delle modifiche non salvate e per unire le modifiche di un collega
  const [salvato, setSalvato] = useState(iniziale)
  const [salvata, setSalvata] = useState(false)
  const [targa, setTarga] = useState(veicoli.find((v) => v.id === iniziale.veicolo_id)?.targa ?? '')
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, setInCorso] = useState(false)
  const esistente = !nuova || salvata
  const esci = useModificheNonSalvate(!soloLettura && JSON.stringify(m) !== JSON.stringify(salvato))
  const imp = <K extends keyof MultaVeicolo>(k: K, v: MultaVeicolo[K]) => setM((x) => ({ ...x, [k]: v }))
  const vettura = veicoli.find((v) => v.id === m.veicolo_id) ?? null
  const avvisi = vettura ? avvisiMulta(m, vettura, contribuenti) : []
  const dataRif = dataRiferimentoMulta(m)

  function scegliTarga(t: string) {
    setTarga(t)
    const v = veicoli.find((x) => normalizzaTarga(x.targa) === normalizzaTarga(t))
    imp('veicolo_id', v?.id ?? '')
  }
  function notifica(d: string) {
    setM((x) => {
      const p = d ? proponiScadenzeMulta(d) : null
      return { ...x, data_notifica: d, ...(p ? { scadenza_pagamento: x.scadenza_pagamento || p.scadenza_pagamento, scadenza_ridotta: x.scadenza_ridotta || p.scadenza_ridotta, scadenza_conducente: x.scadenza_conducente || p.scadenza_conducente } : {}) }
    })
  }
  function fatto(d: string) {
    setM((x) => ({ ...x, data_fatto: d, conducente: x.conducente || (vettura && d ? conducenteAl(vettura, d) : '') }))
  }

  async function salva() {
    if (!vettura) { setErrore('Scegliere la vettura scrivendo la targa (se non c\'è, aggiungerla prima dalla scheda Vetture, anche come vettura passata).'); return }
    if (m.tipo === 'cartella_bollo' ? !m.anno_riferimento && !m.data_fatto : !m.data_fatto) { setErrore(m.tipo === 'cartella_bollo' ? 'Indicare l\'anno del bollo.' : 'Indicare la data del fatto.'); return }
    if (m.stato === 'pagata' && !m.data_pagamento) { setErrore('Indicare la data del pagamento.'); return }
    setInCorso(true); setErrore(null)
    const azione = !esistente ? `nuova ${m.tipo === 'cartella_bollo' ? 'cartella bollo' : 'multa'}` : m.stato === 'pagata' && salvato.stato !== 'pagata' ? 'multa pagata' : 'modifica multa'
    try {
      let esito: EsitoUnione | null = null
      await aggiorna<MultaVeicolo>(token, 'multe_veicoli', (rec) => {
        if (!rec.some((r) => r.id === m.id)) return [...rec, m]
        const u = sostituisciUnendo(rec, m.id, { ...m, ...campiModifica(nome) }, salvato, nome)
        esito = u.esito
        return u.record
      }, `${nome}: ${azione} ${vettura.targa}`)
      avvisa(descriviUnione(esito, { stato: 'Stato', importo_cent: 'Importo', note: 'Note' }))
      const eraNuova = !esistente
      setSalvato(m); setSalvata(true)
      if (!eraNuova) onChiudi()   // una multa nuova resta aperta per allegare il verbale
    } catch (e) { setErrore((e as Error).message) } finally { setInCorso(false) }
  }
  async function elimina() {
    setInCorso(true)
    try {
      await aggiorna<MultaVeicolo>(token, 'multe_veicoli', (rec) => rec.map((r) => (r.id === m.id ? { ...r, eliminato_il: new Date().toISOString(), ...campiModifica(nome) } : r)), `${nome}: elimina multa ${vettura?.targa ?? ''}`)
      onChiudi()
    } catch (e) { setErrore((e as Error).message); setInCorso(false) }
  }

  const targhe = [...veicoli].sort((a, b) => a.targa.localeCompare(b.targa))
  const dis = soloLettura
  const testo = (k: 'ente' | 'numero_verbale' | 'conducente' | 'note') => <input value={m[k]} disabled={dis} onChange={(e) => imp(k, e.target.value)} className="input" />
  const data = (k: 'scadenza_pagamento' | 'scadenza_ridotta' | 'scadenza_conducente' | 'data_pagamento') => <input type="date" value={m[k]} disabled={dis} onChange={(e) => imp(k, e.target.value)} className="input" />
  const euro = (k: 'importo_cent' | 'importo_ridotto_cent' | 'spese_rinotifica_cent') => (dis ? <input disabled value={m[k] ?? ''} className="input" /> : <InputEuro valore={m[k]} onChange={(c) => imp(k, c)} />)

  return (
    <div>
      {avvisi.map((a, i) => <div key={i} className="mb-3"><Avviso tipo={a.tipo === 'errore' ? 'errore' : 'attenzione'}>{a.testo}</Avviso></div>)}
      {vettura && dataRif && !avvisi.length && (
        <p className="m-0 mb-3 text-[13px] text-neutro-700">Al momento del fatto intestata a <strong>{nomeIntestatario(intestazioneAl(vettura, dataRif), contribuenti)}</strong>.</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etichetta="Targa" aiuto={vettura ? `${[vettura.marca, vettura.modello].filter(Boolean).join(' ')}${vettura.stato !== 'in_uso' ? ' (vettura passata)' : ''}` : targa ? 'Targa non presente nella flotta' : 'Scrivere o scegliere la targa'}>
          <input value={targa} list="targhe-flotta" disabled={dis || salvata} onChange={(e) => scegliTarga(e.target.value)} className="input num uppercase" />
          <datalist id="targhe-flotta">{targhe.map((v) => <option key={v.id} value={v.targa}>{v.modello}</option>)}</datalist>
        </Campo>
        <Campo etichetta="Tipo">
          <select value={m.tipo} disabled={dis} onChange={(e) => imp('tipo', e.target.value as MultaVeicolo['tipo'])} className="input">
            {TIPI_MULTA.map((o) => <option key={o.valore} value={o.valore}>{o.etichetta}</option>)}
          </select>
        </Campo>
        <Campo etichetta="Ente">{testo('ente')}</Campo>
        <Campo etichetta={m.tipo === 'cartella_bollo' ? 'N. cartella / avviso' : 'N. verbale'}>{testo('numero_verbale')}</Campo>
        {m.tipo === 'cartella_bollo'
          ? <Campo etichetta="Anno del bollo"><input type="number" value={m.anno_riferimento ?? ''} disabled={dis} onChange={(e) => imp('anno_riferimento', e.target.value ? Number(e.target.value) : null)} className="input num" /></Campo>
          : <Campo etichetta="Data del fatto"><input type="date" value={m.data_fatto} disabled={dis} onChange={(e) => fatto(e.target.value)} className="input" /></Campo>}
        <Campo etichetta="Notificata il" aiuto="Si propongono le scadenze: pagamento 60 gg, ridotto 5 gg, conducente 60 gg."><input type="date" value={m.data_notifica} disabled={dis} onChange={(e) => notifica(e.target.value)} className="input" /></Campo>
        <Campo etichetta="Importo">{euro('importo_cent')}</Campo>
        <Campo etichetta="Scadenza pagamento">{data('scadenza_pagamento')}</Campo>
        <Campo etichetta="Importo ridotto (30%)">{euro('importo_ridotto_cent')}</Campo>
        <Campo etichetta="Scadenza pagamento ridotto">{data('scadenza_ridotta')}</Campo>
        <Campo etichetta="Spese di rinotifica">{euro('spese_rinotifica_cent')}</Campo>
        <Campo etichetta="Conducente">{testo('conducente')}</Campo>
        <Campo etichetta="Comunicare il conducente entro">{data('scadenza_conducente')}</Campo>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" className="accent-accento" checked={m.conducente_comunicato} disabled={dis} onChange={(e) => imp('conducente_comunicato', e.target.checked)} /> Conducente comunicato
        </label>
        <Campo etichetta="Stato">
          <select value={m.stato} disabled={dis} onChange={(e) => imp('stato', e.target.value as MultaVeicolo['stato'])} className="input">
            {STATI_MULTA.map((o) => <option key={o.valore} value={o.valore}>{o.etichetta}</option>)}
          </select>
        </Campo>
        <Campo etichetta="Pagata il">{data('data_pagamento')}</Campo>
        <Campo etichetta="Note" intera><textarea value={m.note} rows={2} disabled={dis} onChange={(e) => imp('note', e.target.value)} className="input" /></Campo>
      </div>
      {errore && <div className="mt-4"><Avviso tipo="errore">{errore}</Avviso></div>}
      {salvata && nuova && <div className="mt-4"><Avviso tipo="ok">Salvata. Ora puoi allegare il verbale o la cartella qui sotto.</Avviso></div>}
      {!dis && (
        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <Bottone disabled={inCorso} onClick={salva}>Salva</Bottone>
          <Bottone variante="secondario" onClick={() => esci(onChiudi)}>{salvata ? 'Chiudi' : 'Annulla'}</Bottone>
          {esistente && <Bottone variante="secondario" className="ml-auto" disabled={inCorso} onClick={elimina}>Elimina</Bottone>}
        </div>
      )}
      {(esistente || salvata) && <div className="mt-6"><Allegati collezione="multe_veicoli" recordId={m.id} categorie={CATEGORIE_ALLEGATO_FLOTTA} descrizione={`multa ${vettura?.targa ?? ''}`} /></div>}
    </div>
  )
}

export default function EditorMulta({ iniziale, nuova, veicoli, contribuenti, aperta, onChiudi }: {
  iniziale: MultaVeicolo | null; nuova: boolean; veicoli: Veicolo[]; contribuenti: Contribuente[]; aperta: boolean; onChiudi: () => void
}) {
  return (
    <Finestra kicker="Flotta" titolo={iniziale?.tipo === 'cartella_bollo' ? 'Cartella del bollo' : 'Multa'} aperta={aperta} onChiudi={onChiudi} larga>
      {iniziale && <Corpo key={iniziale.id} iniziale={iniziale} nuova={nuova} veicoli={veicoli} contribuenti={contribuenti} onChiudi={onChiudi} />}
    </Finestra>
  )
}
