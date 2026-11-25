/**
 * Scheda "Multe e cartelle" della Flotta: tutte le multe e cartelle del bollo, anche delle vetture passate, con la
 * società intestataria alla data del fatto e gli avvisi "già venduta" (da contestare) / "intestata a un'altra società".
 */
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { avvisiMulta, dataRiferimentoMulta, intestazioneAl, normalizzaTarga, nomeIntestatario, nuovaMulta, totaleMulta, dataFlotta } from '../../lib/flotta'
import { normalizzaNome } from '../../lib/importaTributi'
import { useSessioneAttiva } from '../../lib/sessione'
import { STATI_MULTA, TIPI_MULTA, etichettaDi, type Contribuente, type MultaVeicolo, type Veicolo } from '../../lib/tipi'
import { formattaEuro } from '../../lib/utils/formato'
import { SoloSeModifica } from '../SoloLettura'
import { BarraRicerca, Bottone, Etichetta, Tabella, type Colonna } from '../ui'
import EditorMulta from './EditorMulta'

export default function ElencoMulte({ veicoli, multe, contribuenti }: { veicoli: Veicolo[]; multe: MultaVeicolo[]; contribuenti: Contribuente[] }) {
  const { nome } = useSessioneAttiva()
  const [stato, setStato] = useState<string>('da_pagare')
  const [societa, setSocieta] = useState('')
  const [testo, setTesto] = useState('')
  const [aperta, setAperta] = useState<{ m: MultaVeicolo; nuova: boolean } | null>(null)
  const perId = new Map(veicoli.map((v) => [v.id, v]))
  const societaAllora = (m: MultaVeicolo) => { const v = perId.get(m.veicolo_id); return v ? intestazioneAl(v, dataRiferimentoMulta(m)) : null }

  const righe = multe
    .filter((m) => perId.has(m.veicolo_id))
    .filter((m) => !stato || m.stato === stato)
    .filter((m) => !societa || societaAllora(m)?.contribuente_id === societa)
    .filter((m) => {
      if (!testo.trim()) return true
      const v = perId.get(m.veicolo_id)!
      return normalizzaTarga(v.targa).includes(normalizzaTarga(testo)) || normalizzaNome(`${m.numero_verbale} ${m.ente}`).includes(normalizzaNome(testo))
    })
    .sort((a, b) => dataRiferimentoMulta(b).localeCompare(dataRiferimentoMulta(a)))

  const colonne: Colonna<MultaVeicolo>[] = [
    { chiave: 'data', etichetta: 'Data', render: (m) => m.data_fatto ? dataFlotta(m.data_fatto) : m.anno_riferimento ? `bollo ${m.anno_riferimento}` : '—' },
    { chiave: 'tipo', etichetta: 'Tipo', render: (m) => etichettaDi(TIPI_MULTA, m.tipo).replace(/ \(.*\)$/, '') },
    { chiave: 'vettura', etichetta: 'Vettura', render: (m) => { const v = perId.get(m.veicolo_id)!; return <>{v.modello} <span className="num font-semibold">{v.targa}</span></> } },
    { chiave: 'societa', etichetta: 'Società al momento del fatto', render: (m) => nomeIntestatario(societaAllora(m), contribuenti) },
    { chiave: 'ente', etichetta: 'Ente / verbale', render: (m) => [m.ente, m.numero_verbale].filter(Boolean).join(' · ') },
    { chiave: 'totale', etichetta: 'Totale', allinea: 'dx', render: (m) => formattaEuro(totaleMulta(m)) },
    { chiave: 'scadenza', etichetta: 'Scadenza', render: (m) => dataFlotta(m.scadenza_pagamento) },
    { chiave: 'stato', etichetta: 'Stato', render: (m) => {
      const av = avvisiMulta(m, perId.get(m.veicolo_id)!, contribuenti)
      return <span className="flex flex-wrap gap-1">
        <Etichetta tono={m.stato === 'da_pagare' ? 'rosso' : m.stato === 'pagata' ? 'verde' : 'grigio'}>{etichettaDi(STATI_MULTA, m.stato).replace(/ \(.*\)$/, '')}</Etichetta>
        {av.map((a, i) => <span key={i} title={a.testo}><Etichetta tono={a.tipo === 'errore' ? 'rosso' : 'giallo'}>{a.tipo === 'errore' ? 'da contestare' : 'altra società'}</Etichetta></span>)}
      </span>
    } },
  ]

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <BarraRicerca valore={testo} onChange={setTesto} segnaposto="Cerca targa, verbale o ente…" />
        <select value={stato} onChange={(e) => setStato(e.target.value)} className="input w-auto" aria-label="Stato">
          <option value="">Tutti gli stati</option>
          {STATI_MULTA.map((o) => <option key={o.valore} value={o.valore}>{o.etichetta}</option>)}
        </select>
        <select value={societa} onChange={(e) => setSocieta(e.target.value)} className="input w-auto" aria-label="Società">
          <option value="">Tutte le società</option>
          {[...contribuenti].sort((a, b) => a.nome.localeCompare(b.nome, 'it')).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <span className="ml-auto flex items-center gap-2">
          <span className="text-[13px] text-neutro-700">{righe.length} · totale {formattaEuro(righe.reduce((t, m) => t + totaleMulta(m), 0))}</span>
          <SoloSeModifica><Bottone onClick={() => setAperta({ m: nuovaMulta(nome, ''), nuova: true })}><Plus size={16} /> Nuova multa / cartella</Bottone></SoloSeModifica>
        </span>
      </div>
      <Tabella colonne={colonne} righe={righe} onRiga={(m) => setAperta({ m, nuova: false })}
        vuoto={stato === 'da_pagare' && !testo && !societa ? 'Nessuna multa o cartella da pagare.' : 'Nessuna multa con questi filtri.'} />
      <EditorMulta iniziale={aperta?.m ?? null} nuova={aperta?.nuova ?? false} veicoli={veicoli} contribuenti={contribuenti} aperta={!!aperta} onChiudi={() => setAperta(null)} />
    </div>
  )
}
