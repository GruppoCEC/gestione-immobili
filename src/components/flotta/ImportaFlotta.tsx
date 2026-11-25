/**
 * Importa → Flotta: caricamento iniziale delle vetture dai vecchi Excel ("Prospetto Vetture.xlsx" e/o "Scadenza Bolli
 * Vetture.xlsx"). Prima di salvare si vede l'anteprima con gli avvisi; le targhe già presenti non vengono ricaricate.
 * Tutte le vetture caricate restano "da verificare" finché non si controllano.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Car, Upload } from 'lucide-react'
import { dataFlotta, intestazioneAttuale, nomeIntestatario } from '../../lib/flotta'
import { analizzaExcelFlotta, type AnteprimaFlotta } from '../../lib/importaFlotta'
import { useSessioneAttiva } from '../../lib/sessione'
import { aggiorna, attivi } from '../../lib/store'
import { POSSESSI, STATI_VEICOLO, etichettaDi, type Contribuente, type Veicolo } from '../../lib/tipi'
import { useCollezioni } from '../../lib/useCollezioni'
import { useSoloLettura } from '../SoloLettura'
import { Avviso, Bottone, Tabella } from '../ui'

export default function ImportaFlotta() {
  const { token, nome } = useSessioneAttiva()
  const { dati, caricamento } = useCollezioni(['veicoli', 'contribuenti'])
  const soloLettura = useSoloLettura()
  const [anteprima, setAnteprima] = useState<AnteprimaFlotta | null>(null)
  const [nomiFile, setNomiFile] = useState<string[]>([])
  const [errore, setErrore] = useState<string | null>(null)
  const [esito, setEsito] = useState<string | null>(null)
  const [inCorso, setInCorso] = useState(false)
  const contribuenti = attivi(dati<Contribuente>('contribuenti'))

  async function leggi(elenco: FileList | null) {
    if (!elenco?.length) return
    setErrore(null); setEsito(null)
    try {
      const file = await Promise.all([...elenco].map(async (f) => ({ nome: f.name, buffer: await f.arrayBuffer() })))
      setNomiFile(file.map((f) => f.nome))
      setAnteprima(await analizzaExcelFlotta(file, contribuenti, dati<Veicolo>('veicoli'), nome))
    } catch (e) { setErrore('Impossibile leggere il file: ' + (e as Error).message) }
  }

  async function carica() {
    if (!anteprima?.veicoli.length) return
    setInCorso(true); setErrore(null)
    try {
      const n = anteprima.veicoli.length
      // Un solo salvataggio; le targhe arrivate nel frattempo (un collega) non vengono duplicate
      await aggiorna<Veicolo>(token, 'veicoli', (rec) => {
        const presenti = new Set(attivi(rec).map((v) => v.targa))
        return [...rec, ...anteprima.veicoli.filter((v) => !presenti.has(v.targa))]
      }, `${nome}: caricamento di ${n} vetture dagli Excel`)
      setEsito(`Caricate ${n} vetture.`)
      setAnteprima(null)
    } catch (e) { setErrore((e as Error).message) } finally { setInCorso(false) }
  }

  const scad = (v: Veicolo, tipo: string) => { const s = v.scadenze.find((x) => x.tipo === tipo); return s?.non_dovuta ? 'non dovuto' : dataFlotta(s?.scadenza) }

  return (
    <div>
      {soloLettura && <div className="mb-5"><Avviso tipo="info">Hai accesso in sola lettura: il caricamento è riservato a chi può modificare i dati.</Avviso></div>}
      <div className="blueprint flex flex-wrap items-center gap-4 !border-dashed p-7">
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
        <Car size={32} className="flex-none text-accento-700" />
        <div className="min-w-0 flex-1">
          <div className="font-medium">{nomiFile.length ? nomiFile.join(' + ') : 'Nessun file selezionato'}</div>
          <div className="text-[13px] text-neutro-700">Scegli uno o entrambi i file delle vetture ("Prospetto Vetture.xlsx", "Scadenza Bolli Vetture.xlsx"): le vetture si uniscono per targa.</div>
        </div>
        <label className={`btn btn-secondario ${caricamento || soloLettura ? 'pointer-events-none opacity-45' : ''}`}>
          <Upload size={16} /> Scegli file Excel…
          <input type="file" accept=".xlsx,.xls" multiple className="hidden" onChange={(e) => { void leggi(e.target.files); e.target.value = '' }} disabled={caricamento || soloLettura} />
        </label>
      </div>

      {errore && <div className="mt-5"><Avviso tipo="errore">{errore}</Avviso></div>}
      {esito && <div className="mt-5"><Avviso tipo="ok">{esito} <Link to="/flotta?vista=tutte" className="underline">Apri la Flotta</Link> e controlla le vetture segnate "da verificare".</Avviso></div>}

      {anteprima && (
        <div className="mt-8">
          {anteprima.avvisi.length > 0 && <div className="mb-4"><Avviso tipo="attenzione"><ul className="m-0 list-disc pl-5">{anteprima.avvisi.map((a, i) => <li key={i}>{a}</li>)}</ul></Avviso></div>}
          {anteprima.doppioni.length > 0 && <div className="mb-4"><Avviso tipo="info">Già presenti nella flotta, non verranno caricate: {anteprima.doppioni.join(', ')}.</Avviso></div>}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[13px] text-neutro-700">{anteprima.veicoli.length} vetture da caricare</span>
            <Bottone onClick={carica} disabled={inCorso || soloLettura || anteprima.veicoli.length === 0}>{inCorso ? 'Caricamento…' : `Carica ${anteprima.veicoli.length} vetture`}</Bottone>
          </div>
          <Tabella righe={anteprima.veicoli} colonne={[
            { chiave: 't', etichetta: 'Targa', render: (v) => <span className="num font-semibold">{v.targa}</span> },
            { chiave: 'v', etichetta: 'Vettura', render: (v) => v.modello },
            { chiave: 's', etichetta: 'Società', render: (v) => nomeIntestatario(intestazioneAttuale(v), contribuenti) },
            { chiave: 'p', etichetta: 'Possesso', render: (v) => `${etichettaDi(POSSESSI, v.possesso).replace(' a lungo termine', '')}${v.contratto?.societa_finanziaria ? ` · ${v.contratto.societa_finanziaria}` : ''}` },
            { chiave: 'st', etichetta: 'Stato', render: (v) => `${etichettaDi(STATI_VEICOLO, v.stato)}${v.data_fine ? ` il ${dataFlotta(v.data_fine)}` : ''}` },
            { chiave: 'b', etichetta: 'Bollo', render: (v) => scad(v, 'bollo') },
            { chiave: 'r', etichetta: 'Revisione', render: (v) => scad(v, 'revisione') },
            { chiave: 'a', etichetta: 'Assicurazione', render: (v) => scad(v, 'assicurazione') },
            { chiave: 'f', etichetta: 'Fine contratto', render: (v) => dataFlotta(v.contratto?.scadenza) },
            { chiave: 'n', etichetta: 'Note', render: (v) => <span className="text-[12px]">{v.note}</span> },
          ]} />
        </div>
      )}
    </div>
  )
}
