/**
 * Stampe della Flotta (da salvare in PDF con "Stampa → Salva come PDF"):
 * - scheda della singola vettura (A4 verticale);
 * - visione generale con i filtri della scheda Vetture (A4 orizzontale), raggruppata per società, con riepilogo.
 * Le scadenze hanno sempre accanto il testo ("scaduta da…", "tra… gg"): leggibili anche in bianco e nero.
 */
import type { ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { BarraStampa, COLORI_STAMPA, IntestazioneStampa, StileA4Orizzontale, StileA4Verticale } from '../components/stampa'
import { Caricamento } from '../components/ui'
import {
  avvisiMulta, dataRiferimentoMulta, etichettaVoce, filtraVeicoli, filtriDaIndirizzo, filtriInIndirizzo, intestazioneAl, intestazioneAttuale,
  nomeIntestatario, proiezioneKm, raggruppaPerSocieta, riepilogoElenco, statoScadenza, totaleMulta, dataFlotta } from '../lib/flotta'
import { attivi } from '../lib/store'
import { POSSESSI, SI_NO, STATI_MULTA, STATI_VEICOLO, TIPI_COPERTURA, etichettaDi, type Allegato, type Contribuente, type MultaVeicolo, type Veicolo } from '../lib/tipi'
import { useCollezioni } from '../lib/useCollezioni'
import { formattaEuro, oggiIso } from '../lib/utils/formato'

const descrizione = (v: Veicolo) => [v.marca, v.modello].filter(Boolean).join(' ') || '—'

/** Data di scadenza con il testo dello stato (per le vetture in uso). */
function Scad({ data, oggi, inUso = true, aCapo }: { data: string; oggi: string; inUso?: boolean; aCapo?: boolean }) {
  if (!data) return <span>—</span>
  const st = statoScadenza(data, oggi)
  if (aCapo) return <span>{dataFlotta(data)}{inUso && <span className={`tag tag-${st.tono} mt-0.5 !block w-fit !px-1.5 !text-[10px]`}>{st.testo}</span>}</span>
  return <span className="whitespace-nowrap">{dataFlotta(data)}{inUso && <> <span className={`tag tag-${st.tono}`}>{st.testo}</span></>}</span>
}

/** Larghezze fisse delle colonne della visione generale: tutte le società allineate e niente uscite dal foglio. */
const COLONNE_ELENCO = ['15%', '8%', '12%', '7%', '11%', '11%', '11%', '11%', '6%', '8%']

function Titoletto({ children }: { children: ReactNode }) {
  return <h2 className="mb-1 mt-5 border-b border-divisore pb-1 text-[15px]">{children}</h2>
}

function Righe({ righe }: { righe: Array<[string, ReactNode]> }) {
  const piene = righe.filter(([, v]) => v !== '' && v !== null && v !== undefined)
  if (!piene.length) return null
  return (
    <div className="grid grid-cols-2 gap-x-6 text-[12.5px]">
      {piene.map(([e, v]) => <div key={e} className="flex gap-2 border-b border-divisore py-1"><span className="w-[130px] flex-none text-neutro-700">{e}</span><span>{v}</span></div>)}
    </div>
  )
}

/* ---------------------------- scheda della singola vettura ---------------------------- */

export function StampaVettura() {
  const { id } = useParams()
  const { dati, caricamento } = useCollezioni(['veicoli', 'multe_veicoli', 'contribuenti', 'allegati'])
  const oggi = oggiIso()
  const v = attivi(dati<Veicolo>('veicoli')).find((x) => x.id === id)
  if (caricamento && !v) return <div className="p-10"><Caricamento /></div>
  if (!v) return <div className="p-10">Vettura non trovata.</div>
  const contribuenti = attivi(dati<Contribuente>('contribuenti'))
  const multe = attivi(dati<MultaVeicolo>('multe_veicoli')).filter((m) => m.veicolo_id === v.id).sort((a, b) => dataRiferimentoMulta(b).localeCompare(dataRiferimentoMulta(a)))
  const allegati = attivi(dati<Allegato>('allegati')).filter((a) => (a.collezione === 'veicoli' && a.record_id === v.id) || (a.collezione === 'multe_veicoli' && multe.some((m) => m.id === a.record_id)))
  const c = v.contratto
  const inUso = v.stato === 'in_uso'
  const km = proiezioneKm(v)
  const ultimaKm = [...v.km].sort((a, b) => b.data.localeCompare(a.data))[0]

  return (
    <div className="min-h-screen bg-sfondo print:bg-white" style={COLORI_STAMPA}>
      <StileA4Verticale />
      <BarraStampa indietro={`/flotta/vettura/${v.id}`} etichetta="Torna alla vettura" />
      <div className="pagina-stampa ombra-md mx-auto my-8 max-w-[794px] bg-white px-6 py-8 text-sm md:px-[44px] print:my-0">
        <IntestazioneStampa kicker={`Scheda vettura · ${nomeIntestatario(intestazioneAttuale(v), contribuenti)}`} titolo={<>{descrizione(v)} <span className="num">{v.targa}</span></>} logoPiccolo
          sotto={`${etichettaDi(STATI_VEICOLO, v.stato)}${!inUso && v.data_fine ? ` il ${dataFlotta(v.data_fine)}` : ''}${v.uscita_note ? ` (a: ${v.uscita_note})` : ''} · ${etichettaDi(POSSESSI, v.possesso)}${c?.societa_finanziaria ? ` · ${c.societa_finanziaria}` : ''}${v.da_verificare ? ' · dati da verificare' : ''}`} />

        <Titoletto>Dati del veicolo</Titoletto>
        <Righe righe={[
          ['Alimentazione', v.alimentazione], ['N. telaio', v.telaio], ['Immatricolazione', dataFlotta(v.data_immatricolazione)],
          ['Nel gruppo dal', dataFlotta(v.data_inizio)], ['Uscita', dataFlotta(v.data_fine)], ['Note', v.note],
        ]} />

        <Titoletto>Intestazioni</Titoletto>
        {v.intestazioni.length === 0 ? <p className="text-[12px]">Nessuna società indicata.</p> : (
          <table className="tabella-compatta !text-[12.5px]">
            <thead><tr><th>Società</th><th>Dal</th><th>Al</th></tr></thead>
            <tbody>{v.intestazioni.map((i, n) => <tr key={n}><td>{nomeIntestatario(i, contribuenti)}</td><td>{dataFlotta(i.dal) || 'non nota'}</td><td>{dataFlotta(i.al) || 'oggi'}</td></tr>)}</tbody>
          </table>
        )}

        {c && <>
          <Titoletto>Contratto di {v.possesso === 'leasing' ? 'leasing' : 'noleggio'}</Titoletto>
          <Righe righe={[
            ['Società', c.societa_finanziaria], ['N. contratto', c.numero], ['Decorrenza', dataFlotta(c.decorrenza)], ['Scadenza', c.scadenza ? <Scad key="scadenza" data={c.scadenza} oggi={oggi} inUso={inUso} /> : ''],
            ['Canone mensile', c.canone_mensile_cent ? formattaEuro(c.canone_mensile_cent) : ''], ['Anticipo', c.anticipo_cent ? formattaEuro(c.anticipo_cent) : ''],
            ['Riscatto', c.riscatto_cent ? formattaEuro(c.riscatto_cent) : ''], ['Km inclusi', c.km_inclusi ? c.km_inclusi.toLocaleString('it-IT') : ''],
            ['Bollo incluso', c.bollo_incluso ? etichettaDi(SI_NO, c.bollo_incluso) : ''], ['Assicurazione inclusa', c.assicurazione_inclusa ? etichettaDi(SI_NO, c.assicurazione_inclusa) : ''],
          ]} />
        </>}

        <Titoletto>Scadenze{!inUso && ' (vettura non più in uso)'}</Titoletto>
        <table className="tabella-compatta !text-[12.5px]">
          <thead><tr><th>Voce</th><th>Scadenza</th><th className="text-right">Importo</th><th>Storico (fatto il · scadenza coperta · importo)</th></tr></thead>
          <tbody>{v.scadenze.map((s) => (
            <tr key={s.id}>
              <td className="whitespace-nowrap font-medium">{etichettaVoce(s)}</td>
              <td>{s.non_dovuta ? `non dovuta: ${s.non_dovuta}` : <Scad data={s.scadenza} oggi={oggi} inUso={inUso} />}</td>
              <td className="num whitespace-nowrap text-right">{s.importo_cent ? formattaEuro(s.importo_cent) : ''}{s.superbollo_cent ? ` + superbollo ${formattaEuro(s.superbollo_cent)}` : ''}</td>
              <td className="text-[11.5px]">{[s.compagnia, s.numero_polizza && `polizza ${s.numero_polizza}`].filter(Boolean).join(' · ')}
                {[...s.storico].reverse().map((e, i) => <div key={i}>{dataFlotta(e.data_fatto)} · {dataFlotta(e.scadenza_coperta) || '—'} · {e.importo_cent ? formattaEuro(e.importo_cent) : '—'}{e.note ? ` · ${e.note}` : ''}</div>)}</td>
            </tr>
          ))}</tbody>
        </table>

        {(v.km.length > 0 || v.conducenti.length > 0) && <>
          <Titoletto>Km e conducenti</Titoletto>
          <Righe righe={[
            ['Ultima lettura', ultimaKm ? `${ultimaKm.km.toLocaleString('it-IT')} km il ${dataFlotta(ultimaKm.data)}` : ''],
            ['Previsti a fine contratto', km ? `circa ${km.km_previsti.toLocaleString('it-IT')} km${km.supera ? ' (oltre i km inclusi)' : ''}` : ''],
            ['Conducenti', v.conducenti.map((x) => `${x.nome}${x.dal || x.al ? ` (${dataFlotta(x.dal) || '…'} – ${dataFlotta(x.al) || 'oggi'})` : ''}`).join('; ')],
          ]} />
        </>}

        {v.coperture.length > 0 && <>
          <Titoletto>Coperture e garanzie accessorie</Titoletto>
          <table className="tabella-compatta !text-[12.5px]">
            <thead><tr><th>Tipo</th><th>Fornitore</th><th>N.</th><th>Scadenza</th><th>Note</th></tr></thead>
            <tbody>{v.coperture.map((x) => <tr key={x.id}><td>{etichettaDi(TIPI_COPERTURA, x.tipo)}</td><td>{x.fornitore}</td><td>{x.numero}</td><td><Scad data={x.scadenza} oggi={oggi} inUso={inUso} /></td><td>{x.note}</td></tr>)}</tbody>
          </table>
        </>}

        <Titoletto>Multe e cartelle</Titoletto>
        {multe.length === 0 ? <p className="text-[12px]">Nessuna multa o cartella.</p> : (
          <table className="tabella-compatta !text-[12.5px]">
            <thead><tr><th>Data</th><th>Ente / verbale</th><th>Società allora</th><th className="text-right">Totale</th><th>Stato</th></tr></thead>
            <tbody>{multe.map((m) => {
              const av = avvisiMulta(m, v, contribuenti)
              return (
                <tr key={m.id}>
                  <td className="whitespace-nowrap">{m.data_fatto ? dataFlotta(m.data_fatto) : m.anno_riferimento ? `bollo ${m.anno_riferimento}` : '—'}</td>
                  <td>{[m.ente, m.numero_verbale].filter(Boolean).join(' · ')}</td>
                  <td>{nomeIntestatario(intestazioneAl(v, dataRiferimentoMulta(m)), contribuenti)}</td>
                  <td className="num whitespace-nowrap text-right">{formattaEuro(totaleMulta(m))}</td>
                  <td>{etichettaDi(STATI_MULTA, m.stato)}{m.data_pagamento ? ` il ${dataFlotta(m.data_pagamento)}` : ''}{av.map((a, i) => <div key={i} className="text-[11px]">{a.testo}</div>)}</td>
                </tr>
              )
            })}</tbody>
          </table>
        )}

        {allegati.length > 0 && <>
          <Titoletto>Documenti allegati nella piattaforma</Titoletto>
          <p className="text-[12px]">{allegati.map((a) => a.nome_file).join(' · ')}</p>
        </>}
      </div>
    </div>
  )
}

/* ---------------------------- visione generale ---------------------------- */

const ETICHETTE_VISTA = { attuali: 'Vetture attuali', passate: 'Vetture passate', tutte: 'Tutte le vetture' }

export function StampaElencoFlotta() {
  const [parametri] = useSearchParams()
  const filtri = filtriDaIndirizzo(parametri)
  const { dati, caricamento } = useCollezioni(['veicoli', 'multe_veicoli', 'contribuenti'])
  const oggi = oggiIso()
  const contribuenti = attivi(dati<Contribuente>('contribuenti'))
  const veicoli = filtraVeicoli(attivi(dati<Veicolo>('veicoli')), filtri, contribuenti)
  const multe = attivi(dati<MultaVeicolo>('multe_veicoli'))
  if (caricamento && !veicoli.length) return <div className="p-10"><Caricamento /></div>
  const gruppi = raggruppaPerSocieta(veicoli, contribuenti)
  const r = riepilogoElenco(veicoli, multe, oggi)
  const voce = (v: Veicolo, tipo: string) => v.scadenze.find((s) => s.tipo === tipo)
  const cellaVoce = (v: Veicolo, tipo: string) => { const s = voce(v, tipo); return !s ? '—' : s.non_dovuta ? <span className="text-[11px]">non dovuto</span> : <Scad data={s.scadenza} oggi={oggi} aCapo /> }
  const daPagare = (v: Veicolo) => multe.filter((m) => m.veicolo_id === v.id && m.stato === 'da_pagare')
  const filtriTesto = [ETICHETTE_VISTA[filtri.vista], filtri.societa ? `società ${contribuenti.find((c) => c.id === filtri.societa)?.nome ?? ''}` : '', filtri.testo ? `ricerca "${filtri.testo}"` : ''].filter(Boolean).join(' · ')

  return (
    <div className="min-h-screen bg-sfondo print:bg-white" style={COLORI_STAMPA}>
      <StileA4Orizzontale />
      <BarraStampa indietro={`/flotta?${filtriInIndirizzo(filtri)}`} etichetta="Torna alla flotta" />
      <div className="pagina-stampa ombra-md mx-auto my-8 max-w-[1123px] bg-white px-6 py-8 text-sm md:px-[40px] print:my-0">
        <IntestazioneStampa kicker="Flotta aziendale" titolo="Visione generale" sotto={`${filtriTesto} · ${veicoli.length} vetture`} logoPiccolo />
        {gruppi.length === 0 && <p className="mt-6">Nessuna vettura con questi filtri.</p>}
        {gruppi.map((g) => (
          <section key={g.nome} className="mt-5">
            <div className="mb-1 flex items-baseline justify-between border-b border-divisore pb-1">
              <b className="text-[15px]">{g.nome}</b><span className="text-[12px]">{g.veicoli.length} {g.veicoli.length === 1 ? 'vettura' : 'vetture'}</span>
            </div>
            <table className="tabella-compatta !text-[12px]" style={{ tableLayout: 'fixed', width: '100%' }}>
              <colgroup>{COLONNE_ELENCO.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
              <thead><tr><th>Vettura</th><th>Targa</th><th>Possesso</th><th>Stato</th><th>Bollo</th><th>Revisione</th><th>Assicurazione</th><th>Fine contratto</th><th className="text-right">Ultimi km</th><th className="text-right">Multe aperte</th></tr></thead>
              <tbody>{g.veicoli.map((v) => {
                const inUso = v.stato === 'in_uso'
                const mm = daPagare(v)
                const ultima = [...v.km].sort((a, b) => b.data.localeCompare(a.data))[0]
                return (
                  <tr key={v.id}>
                    <td className="font-medium">{descrizione(v)}</td>
                    <td className="num font-semibold">{v.targa}</td>
                    <td>{etichettaDi(POSSESSI, v.possesso).replace(' a lungo termine', '')}{v.contratto?.societa_finanziaria ? ` · ${v.contratto.societa_finanziaria}` : ''}</td>
                    <td>{etichettaDi(STATI_VEICOLO, v.stato).replace(/ \(.*\)$/, '')}</td>
                    {inUso ? <>
                      <td>{cellaVoce(v, 'bollo')}</td><td>{cellaVoce(v, 'revisione')}</td><td>{cellaVoce(v, 'assicurazione')}</td>
                      <td>{v.possesso !== 'proprieta' && v.contratto?.scadenza ? <Scad data={v.contratto.scadenza} oggi={oggi} aCapo /> : '—'}</td>
                    </> : <td colSpan={4} className="text-neutro-700">uscita il {dataFlotta(v.data_fine) || '—'}{v.uscita_note ? ` (a: ${v.uscita_note})` : ''}</td>}
                    <td className="num whitespace-nowrap text-right">{ultima ? ultima.km.toLocaleString('it-IT') : '—'}</td>
                    <td className="num text-right">{mm.length ? `${mm.length} · ${formattaEuro(mm.reduce((t, m) => t + totaleMulta(m), 0))}` : '—'}</td>
                  </tr>
                )
              })}</tbody>
            </table>
          </section>
        ))}

        {veicoli.length > 0 && (
          <section className="mt-6 grid grid-cols-3 gap-3 text-[12px]">
            <div className="border border-divisore px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.08em]">Vetture</div>
              <div>{POSSESSI.map((o) => `${etichettaDi(POSSESSI, o.valore).replace(' a lungo termine', '')}: ${r.perPossesso[o.valore as keyof typeof r.perPossesso]}`).join(' · ')}</div>
              <div>{STATI_VEICOLO.filter((o) => r.perStato[o.valore as keyof typeof r.perStato]).map((o) => `${o.etichetta.replace(/ \(.*\)$/, '')}: ${r.perStato[o.valore as keyof typeof r.perStato]}`).join(' · ')}</div>
            </div>
            <div className="border border-divisore px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.08em]">Scadenze dei prossimi 30 giorni (e scadute)</div>
              {r.scadenze30.length === 0 ? <div>Nessuna.</div> : r.scadenze30.map((s, i) => <div key={i}>{dataFlotta(s.scadenza)} · {s.etichetta} · {s.veicolo.targa}</div>)}
            </div>
            <div className="border border-divisore px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.08em]">Multe e cartelle da pagare</div>
              <div className="num mt-0.5 font-titolo text-[20px] font-semibold leading-none">{formattaEuro(r.multeDaPagare.totale_cent)}</div>
              <div className="mt-0.5">{r.multeDaPagare.numero} da pagare</div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
