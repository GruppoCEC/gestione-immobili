/**
 * Scheda "Vetture" della Flotta: tabella compatta con ricerca per targa, filtri attuali / passate / tutte e società
 * (i filtri stanno nell'indirizzo, così la stampa e il ritorno dalla scheda vettura li ritrovano).
 */
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Printer } from 'lucide-react'
import { filtraVeicoli, filtriDaIndirizzo, filtriInIndirizzo, intestazioneAttuale, nomeIntestatario, normalizzaTarga, nuovoVeicolo, prossimaScadenza, statoScadenza, type FiltriFlotta, dataFlotta } from '../../lib/flotta'
import { useSessioneAttiva } from '../../lib/sessione'
import { POSSESSI, STATI_VEICOLO, etichettaDi, type Contribuente, type MultaVeicolo, type Veicolo } from '../../lib/tipi'
import { oggiIso } from '../../lib/utils/formato'
import { SoloSeModifica } from '../SoloLettura'
import { Avviso, BarraRicerca, Bottone, Etichetta, Segmentato, Tabella, type Colonna } from '../ui'
import EditorVettura from './EditorVettura'

/** Testo che sembra una targa (lettere e cifre, almeno 5 caratteri): se non si trova, si propone di aggiungerla. */
const sembraTarga = (t: string) => { const n = normalizzaTarga(t); return n.length >= 5 && /\d/.test(n) && /^[A-Z0-9]+$/.test(n) }

export default function ElencoVetture({ veicoli, multe, contribuenti }: { veicoli: Veicolo[]; multe: MultaVeicolo[]; contribuenti: Contribuente[] }) {
  const { nome } = useSessioneAttiva()
  const navigate = useNavigate()
  const [parametri, setParametri] = useSearchParams()
  const filtri = filtriDaIndirizzo(parametri)
  const imposta = (f: Partial<FiltriFlotta>) => setParametri(new URLSearchParams(filtriInIndirizzo({ ...filtri, ...f })), { replace: true })
  const [nuova, setNuova] = useState<Veicolo | null>(null)
  const oggi = oggiIso()

  const righe = filtraVeicoli(veicoli, filtri, contribuenti)
  const multeAperte = (v: Veicolo) => multe.filter((m) => m.veicolo_id === v.id && m.stato === 'da_pagare').length
  const societa = [...contribuenti].sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
  const nessunaTarga = righe.length === 0 && sembraTarga(filtri.testo) && !veicoli.some((v) => normalizzaTarga(v.targa) === normalizzaTarga(filtri.testo))

  const colonne: Colonna<Veicolo>[] = [
    { chiave: 'societa', etichetta: 'Società', render: (v) => nomeIntestatario(intestazioneAttuale(v), contribuenti) },
    { chiave: 'vettura', etichetta: 'Vettura', render: (v) => (
      <span>{[v.marca, v.modello].filter(Boolean).join(' ') || '—'}{v.da_verificare && <> <Etichetta tono="giallo">da verificare</Etichetta></>}</span>
    ) },
    { chiave: 'targa', etichetta: 'Targa', render: (v) => <span className="num font-semibold">{v.targa || '—'}</span> },
    { chiave: 'possesso', etichetta: 'Possesso', render: (v) => <span className="whitespace-nowrap">{etichettaDi(POSSESSI, v.possesso).replace(' a lungo termine', '')}{v.contratto?.societa_finanziaria ? ` · ${v.contratto.societa_finanziaria}` : ''}</span> },
    { chiave: 'stato', etichetta: 'Stato', render: (v) => <Etichetta tono={v.stato === 'in_uso' ? 'verde' : 'grigio'}>{etichettaDi(STATI_VEICOLO, v.stato)}</Etichetta> },
    { chiave: 'scadenza', etichetta: 'Prossima scadenza', render: (v) => {
      if (v.stato !== 'in_uso') return <span className="text-neutro-700">uscita il {dataFlotta(v.data_fine) || '—'}</span>
      const p = prossimaScadenza(v)
      if (!p) return <span className="text-neutro-700">—</span>
      const st = statoScadenza(p.scadenza, oggi)
      return <span className="whitespace-nowrap">{p.etichetta} {dataFlotta(p.scadenza)} <Etichetta tono={st.tono}>{st.testo}</Etichetta></span>
    } },
    { chiave: 'multe', etichetta: 'Multe da pagare', allinea: 'dx', render: (v) => { const n = multeAperte(v); return n ? <Etichetta tono="rosso">{n}</Etichetta> : '' } },
  ]

  function apriNuova(passata: boolean) {
    const v = nuovoVeicolo(nome)
    setNuova(passata ? { ...v, targa: normalizzaTarga(filtri.testo), stato: 'venduta' } : v)
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <BarraRicerca valore={filtri.testo} onChange={(testo) => imposta({ testo })} segnaposto="Cerca targa, marca o modello…" />
        <Segmentato valore={filtri.vista} onChange={(vista) => imposta({ vista })}
          opzioni={[{ valore: 'attuali', etichetta: 'Attuali' }, { valore: 'passate', etichetta: 'Passate' }, { valore: 'tutte', etichetta: 'Tutte' }]} />
        <select value={filtri.societa} onChange={(e) => imposta({ societa: e.target.value })} className="input w-auto" aria-label="Società">
          <option value="">Tutte le società</option>
          {societa.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <span className="ml-auto flex items-center gap-2">
          <span className="text-[13px] text-neutro-700">{righe.length} vetture</span>
          <Link to={`/stampa/flotta/elenco?${filtriInIndirizzo(filtri)}`} className="btn btn-secondario no-underline"><Printer size={16} /> Stampa</Link>
          <SoloSeModifica><Bottone onClick={() => apriNuova(false)}><Plus size={16} /> Nuova vettura</Bottone></SoloSeModifica>
        </span>
      </div>
      {nessunaTarga && (
        <div className="mb-4">
          <Avviso tipo="attenzione">
            Targa {normalizzaTarga(filtri.testo)} non presente nella flotta (nemmeno tra le vetture passate).
            <SoloSeModifica> <Bottone piccolo variante="secondario" className="ml-2" onClick={() => apriNuova(true)}>Aggiungila come vettura passata</Bottone></SoloSeModifica>
          </Avviso>
        </div>
      )}
      <Tabella colonne={colonne} righe={righe} onRiga={(v) => navigate(`/flotta/vettura/${v.id}`)}
        vuoto={filtri.testo || filtri.societa ? 'Nessuna vettura con questi filtri.' : filtri.vista === 'passate' ? 'Nessuna vettura passata.' : 'Nessuna vettura. Premi "Nuova vettura" oppure carica i vecchi Excel da Importa → Flotta.'} />
      <EditorVettura nuova iniziale={nuova} contribuenti={contribuenti} aperta={nuova !== null} onChiudi={() => setNuova(null)} />
    </div>
  )
}
