import { describe, expect, it } from 'vitest'
import {
  avvisiMulta, cambiaIntestazione, conducenteAl, filtraVeicoli, filtriDaIndirizzo, filtriInIndirizzo, intestazioneAl, intestazioneAttuale,
  nomeIntestatario, normalizzaTarga, nuovoVeicolo, primaRevisione, prossimaScadenza, proiezioneKm, proponiScadenzeMulta, propostaRinnovo,
  raggruppaPerSocieta, registraUscita, riepilogoElenco, scadenzeAperte, scadenzeDelVeicolo, scadenzeStandard, segnaFatta, statoScadenza, totaleMulta,
  applicaValoriVettura, valoriVettura, righeExcelFlotta,
} from './flotta'
import { contribuente, multa, veicolo } from './test/fixture'
import type { ScadenzaVeicolo } from './tipi'

const voce = (parz: Partial<ScadenzaVeicolo>): ScadenzaVeicolo => ({ id: 's1', tipo: 'bollo', descrizione: '', scadenza: '', importo_cent: null, non_dovuta: '', rinnovo_mesi: null, storico: [], ...parz })
const A = contribuente({ id: 'A', nome: 'Alfa' })
const B = contribuente({ id: 'B', nome: 'Beta' })
const CONTR = [A, B]
const dueIntestazioni = [{ contribuente_id: 'A', intestatario_testo: '', dal: '', al: '2024-03-31' }, { contribuente_id: 'B', intestatario_testo: '', dal: '2024-04-01', al: '' }]

describe('targa', () => {
  it('normalizzata in maiuscolo senza spazi, trattini e punti', () => {
    expect(normalizzaTarga(' ab-123.cd ')).toBe('AB123CD')
  })
})

describe('scadenze: rinnovo proposto', () => {
  it('prima revisione a fine mese dopo 4 anni dall\'immatricolazione', () => {
    expect(primaRevisione('2022-03-15')).toBe('2026-03-31')
  })
  it('revisione: fine del mese 2 anni dopo quella fatta', () => {
    expect(propostaRinnovo(voce({ tipo: 'revisione', scadenza: '2026-03-31' }), '2026-03-10')).toBe('2028-03-31')
  })
  it('bollo: +12 mesi dalla scadenza coperta', () => {
    expect(propostaRinnovo(voce({ tipo: 'bollo', scadenza: '2026-04-30' }), '2026-04-20')).toBe('2027-04-30')
  })
  it('assicurazione senza scadenza: +12 mesi dalla data in cui è stata pagata', () => {
    expect(propostaRinnovo(voce({ tipo: 'assicurazione' }), '2026-05-10')).toBe('2027-05-10')
  })
  it('tagliando: +12 mesi da quando è stato fatto', () => {
    expect(propostaRinnovo(voce({ tipo: 'tagliando', scadenza: '2026-01-31' }), '2026-02-15')).toBe('2027-02-15')
  })
  it('voce libera: rinnovo solo se indicato', () => {
    expect(propostaRinnovo(voce({ tipo: 'altro', scadenza: '2026-06-30', rinnovo_mesi: null }), '2026-06-01')).toBe('')
    expect(propostaRinnovo(voce({ tipo: 'altro', scadenza: '2026-06-30', rinnovo_mesi: 6 }), '2026-06-01')).toBe('2026-12-30')
  })
  it('segnare fatta mette la voce nello storico e imposta la nuova scadenza', () => {
    const v = veicolo({ scadenze: [voce({ id: 's1', tipo: 'bollo', scadenza: '2026-04-30' })] })
    const dopo = segnaFatta(v, 's1', { data_fatto: '2026-04-20', importo_cent: 25000, note: '', nuova_scadenza: '2027-04-30' })
    expect(dopo.scadenze[0].scadenza).toBe('2027-04-30')
    expect(dopo.scadenze[0].storico).toEqual([{ data_fatto: '2026-04-20', scadenza_coperta: '2026-04-30', importo_cent: 25000, note: '' }])
    expect(v.scadenze[0].storico).toEqual([])  // l'originale non cambia
  })
  it('le voci standard sono bollo, revisione, assicurazione e tagliando', () => {
    expect(scadenzeStandard().map((s) => s.tipo)).toEqual(['bollo', 'revisione', 'assicurazione', 'tagliando'])
    expect(nuovoVeicolo('Davide').scadenze).toHaveLength(4)
  })
})

describe('scadenze: colori', () => {
  it('rosso se scaduta, giallo nei 30 giorni prima, grigio oltre', () => {
    expect(statoScadenza('2026-11-20', '2026-11-25')).toEqual({ tono: 'rosso', testo: 'scaduta da 5 gg', giorni: -5 })
    expect(statoScadenza('2026-11-25', '2026-11-25')).toEqual({ tono: 'giallo', testo: 'scade oggi', giorni: 0 })
    expect(statoScadenza('2026-12-25', '2026-11-25').tono).toBe('giallo')
    expect(statoScadenza('2026-12-25', '2026-11-25').testo).toBe('tra 30 gg')
    expect(statoScadenza('2026-12-26', '2026-11-25').tono).toBe('grigio')
    expect(statoScadenza('', '2026-11-25')).toEqual({ tono: 'grigio', testo: 'non indicata', giorni: null })
  })
})

describe('intestazioni e conducenti nel tempo', () => {
  const v = veicolo({ intestazioni: dueIntestazioni })
  it('società intestataria alla data del fatto', () => {
    expect(intestazioneAl(v, '2023-06-01')?.contribuente_id).toBe('A')
    expect(intestazioneAl(v, '2024-04-01')?.contribuente_id).toBe('B')
    expect(intestazioneAttuale(v)?.contribuente_id).toBe('B')
  })
  it('vettura caricata senza data di inizio: intestazione valida da sempre', () => {
    expect(intestazioneAl(veicolo(), '2010-01-01')?.contribuente_id).toBe('A')
  })
  it('periodo scoperto tra due intestazioni: nessuna', () => {
    const conBuco = veicolo({ intestazioni: [{ contribuente_id: 'A', intestatario_testo: '', dal: '2020-01-01', al: '2021-12-31' }, { contribuente_id: 'B', intestatario_testo: '', dal: '2023-01-01', al: '' }] })
    expect(intestazioneAl(conBuco, '2022-06-01')).toBeNull()
  })
  it('vettura passata: l\'attuale è l\'ultima intestazione', () => {
    const passata = veicolo({ intestazioni: [{ ...dueIntestazioni[0] }, { ...dueIntestazioni[1], al: '2025-06-30' }] })
    expect(intestazioneAttuale(passata)?.contribuente_id).toBe('B')
  })
  it('nome dell\'intestataria, anche da abbinare', () => {
    expect(nomeIntestatario({ contribuente_id: 'A', intestatario_testo: '', dal: '', al: '' }, CONTR)).toBe('Alfa')
    expect(nomeIntestatario({ contribuente_id: '', intestatario_testo: 'Omega', dal: '', al: '' }, CONTR)).toBe('da abbinare: Omega')
    expect(nomeIntestatario(null, CONTR)).toBe('—')
  })
  it('conducente alla data', () => {
    const c = veicolo({ conducenti: [{ nome: 'Mario', dal: '2024-01-01', al: '2024-12-31' }, { nome: 'Anna', dal: '2025-01-01', al: '' }] })
    expect(conducenteAl(c, '2024-06-01')).toBe('Mario')
    expect(conducenteAl(c, '2026-01-01')).toBe('Anna')
    expect(conducenteAl(c, '2023-01-01')).toBe('')
  })
  it('cambio intestazione: la precedente si chiude il giorno prima', () => {
    const dopo = cambiaIntestazione(veicolo(), 'B', '2024-04-01')
    expect(dopo.intestazioni).toEqual(dueIntestazioni)
  })
  it('cambio intestazione con data non successiva a quella attuale: errore', () => {
    expect(() => cambiaIntestazione(veicolo({ intestazioni: dueIntestazioni }), 'A', '2024-03-01')).toThrow()
  })
  it('vendita: stato, data e intestazione chiusa', () => {
    const dopo = registraUscita(veicolo(), { stato: 'venduta', data_fine: '2025-06-30', uscita_note: 'Concessionario' })
    expect([dopo.stato, dopo.data_fine, dopo.uscita_note, dopo.intestazioni[0].al]).toEqual(['venduta', '2025-06-30', 'Concessionario', '2025-06-30'])
  })
})

describe('multe e cartelle', () => {
  const venduta = veicolo({ stato: 'venduta', data_fine: '2025-06-30', uscita_note: 'Rossi srl', intestazioni: [{ contribuente_id: 'A', intestatario_testo: '', dal: '', al: '2025-06-30' }] })
  it('fatto dopo la vendita: da contestare', () => {
    const av = avvisiMulta(multa({ data_fatto: '2025-07-10' }), venduta, CONTR)
    expect(av.filter((a) => a.tipo === 'errore')).toHaveLength(1)
    expect(av[0].testo).toContain('30/06/2025')
    expect(av[0].testo).toContain('venduta')
  })
  it('cartella del bollo per un anno successivo alla vendita: da contestare', () => {
    expect(avvisiMulta(multa({ tipo: 'cartella_bollo', anno_riferimento: 2026 }), venduta, CONTR).some((a) => a.tipo === 'errore')).toBe(true)
    expect(avvisiMulta(multa({ tipo: 'cartella_bollo', anno_riferimento: 2025 }), venduta, CONTR).some((a) => a.tipo === 'errore')).toBe(false)
  })
  it('fatto prima dell\'arrivo nel gruppo: da contestare', () => {
    expect(avvisiMulta(multa({ data_fatto: '2019-01-01' }), veicolo({ data_inizio: '2020-01-01' }), CONTR).some((a) => a.tipo === 'errore')).toBe(true)
  })
  it('fatto quando era intestata a un\'altra società', () => {
    const av = avvisiMulta(multa({ data_fatto: '2023-06-01' }), veicolo({ intestazioni: dueIntestazioni }), CONTR)
    expect(av).toEqual([{ tipo: 'attenzione', testo: 'Al momento del fatto era intestata a Alfa (oggi Beta)' }])
  })
  it('vettura passata: la società successiva è "poi", non "oggi"', () => {
    const passata = veicolo({ stato: 'venduta', data_fine: '2025-06-30', intestazioni: [dueIntestazioni[0], { ...dueIntestazioni[1], al: '2025-06-30' }] })
    expect(avvisiMulta(multa({ data_fatto: '2023-06-01' }), passata, CONTR)[0].testo).toBe('Al momento del fatto era intestata a Alfa (poi Beta)')
  })
  it('nessun avviso per una multa normale', () => {
    expect(avvisiMulta(multa({ data_fatto: '2026-06-01' }), veicolo(), CONTR)).toEqual([])
  })
  it('scadenze proposte dalla data di notifica', () => {
    expect(proponiScadenzeMulta('2026-11-01')).toEqual({ scadenza_pagamento: '2026-12-31', scadenza_ridotta: '2026-11-06', scadenza_conducente: '2026-12-31' })
  })
  it('totale con le spese di rinotifica', () => {
    expect(totaleMulta(multa({ importo_cent: 4200, spese_rinotifica_cent: 1550 }))).toBe(5750)
    expect(totaleMulta(multa())).toBe(0)
  })
})

describe('elenco unico delle scadenze', () => {
  const oggi = '2026-11-25'
  it('le vetture passate non hanno scadenze', () => {
    const v = veicolo({ stato: 'venduta', data_fine: '2025-01-01', scadenze: [voce({ scadenza: '2024-01-31' })] })
    expect(scadenzeDelVeicolo(v)).toEqual([])
    expect(scadenzeAperte([v], [], oggi, true)).toEqual([])
  })
  it('esclude le voci non dovute e senza data; aggiunge fine contratto e coperture', () => {
    const v = veicolo({
      possesso: 'noleggio',
      contratto: { societa_finanziaria: 'ALD', numero: '', decorrenza: '2024-01-01', scadenza: '2027-01-01', canone_mensile_cent: null, anticipo_cent: null, riscatto_cent: null, km_inclusi: null, bollo_incluso: 'si', assicurazione_inclusa: 'si' },
      scadenze: [voce({ id: 'b', scadenza: '2026-12-01', non_dovuta: 'pagato dal noleggio' }), voce({ id: 'r', tipo: 'revisione', scadenza: '' }), voce({ id: 't', tipo: 'tagliando', scadenza: '2026-12-10' })],
      coperture: [{ id: 'k', tipo: 'kasko', fornitore: '', numero: '', scadenza: '2026-12-20', note: '' }],
    })
    expect(scadenzeDelVeicolo(v).map((r) => r.tipo).sort()).toEqual(['copertura', 'fine_contratto', 'tagliando'])
    expect(prossimaScadenza(v)?.tipo).toBe('tagliando')
  })
  it('entro 90 giorni, oppure tutte; ordinate per data', () => {
    const v = veicolo({ scadenze: [voce({ id: 'lontana', scadenza: '2027-03-05' }), voce({ id: 'scaduta', tipo: 'revisione', scadenza: '2026-10-31' })] })
    expect(scadenzeAperte([v], [], oggi, false).map((r) => r.voceId)).toEqual(['scaduta'])
    expect(scadenzeAperte([v], [], oggi, true).map((r) => r.voceId)).toEqual(['scaduta', 'lontana'])
  })
  it('multe da pagare e conducente da comunicare', () => {
    const v = veicolo()
    const m1 = multa({ id: 'm1', scadenza_pagamento: '2026-12-01' })
    const m2 = multa({ id: 'm2', stato: 'pagata', scadenza_pagamento: '2026-12-01', scadenza_conducente: '2026-12-05' })
    const m3 = multa({ id: 'm3', stato: 'pagata', scadenza_conducente: '2026-12-05', conducente_comunicato: true })
    const righe = scadenzeAperte([v], [m1, m2, m3], oggi, false)
    expect(righe.map((r) => [r.tipo, r.multa?.id])).toEqual([['multa_pagamento', 'm1'], ['multa_conducente', 'm2']])
  })
})

describe('km', () => {
  const contratto = { societa_finanziaria: 'ALD', numero: '', decorrenza: '2025-01-01', scadenza: '2028-01-01', canone_mensile_cent: null, anticipo_cent: null, riscatto_cent: null, km_inclusi: 60000, bollo_incluso: '' as const, assicurazione_inclusa: '' as const }
  it('proiezione lineare a fine contratto con una lettura', () => {
    const p = proiezioneKm(veicolo({ possesso: 'noleggio', contratto, km: [{ data: '2026-01-01', km: 25000, note: '' }] }))
    expect(p?.supera).toBe(true)
    expect(Math.abs((p?.km_previsti ?? 0) - 75000)).toBeLessThan(100)
  })
  it('con due letture usa la prima e l\'ultima', () => {
    const p = proiezioneKm(veicolo({ possesso: 'noleggio', contratto, km: [{ data: '2025-01-01', km: 10000, note: '' }, { data: '2026-01-01', km: 20000, note: '' }] }))
    expect(Math.abs((p?.km_previsti ?? 0) - 40000)).toBeLessThan(100)
    expect(p?.supera).toBe(false)
  })
  it('senza km inclusi o senza letture: nessuna proiezione', () => {
    expect(proiezioneKm(veicolo({ contratto: { ...contratto, km_inclusi: null }, km: [{ data: '2026-01-01', km: 1, note: '' }] }))).toBeNull()
    expect(proiezioneKm(veicolo({ contratto }))).toBeNull()
  })
})

describe('filtri e riepiloghi', () => {
  const inUso = veicolo({ id: 'u', targa: 'AB123CD', intestazioni: dueIntestazioni })
  const passata = veicolo({ id: 'p', targa: 'ZZ999ZZ', modello: 'Smart', stato: 'venduta', data_fine: '2023-01-01' })
  it('attuali, passate, tutte', () => {
    expect(filtraVeicoli([inUso, passata], { vista: 'attuali', societa: '', testo: '' }, CONTR).map((v) => v.id)).toEqual(['u'])
    expect(filtraVeicoli([inUso, passata], { vista: 'passate', societa: '', testo: '' }, CONTR).map((v) => v.id)).toEqual(['p'])
    expect(filtraVeicoli([inUso, passata], { vista: 'tutte', societa: '', testo: '' }, CONTR)).toHaveLength(2)
  })
  it('società intestataria in qualsiasi periodo', () => {
    expect(filtraVeicoli([inUso], { vista: 'tutte', societa: 'A', testo: '' }, CONTR).map((v) => v.id)).toEqual(['u'])
  })
  it('ricerca per targa scritta in un altro modo e per modello', () => {
    expect(filtraVeicoli([inUso, passata], { vista: 'tutte', societa: '', testo: 'ab 123' }, CONTR).map((v) => v.id)).toEqual(['u'])
    expect(filtraVeicoli([inUso, passata], { vista: 'tutte', societa: '', testo: 'smart' }, CONTR).map((v) => v.id)).toEqual(['p'])
  })
  it('filtri nell\'indirizzo, andata e ritorno', () => {
    expect(filtriDaIndirizzo(new URLSearchParams(''))).toEqual({ vista: 'attuali', societa: '', testo: '' })
    const f = { vista: 'passate' as const, societa: 'A', testo: 'ab 1' }
    expect(filtriDaIndirizzo(new URLSearchParams(filtriInIndirizzo(f)))).toEqual(f)
  })
  it('riepilogo: conteggi e totale delle multe da pagare', () => {
    const r = riepilogoElenco([inUso, passata], [multa({ veicolo_id: 'u', importo_cent: 4200, spese_rinotifica_cent: 1000 }), multa({ id: 'x', veicolo_id: 'u', importo_cent: 9999, stato: 'pagata' }), multa({ id: 'altra', veicolo_id: 'fuori-elenco', importo_cent: 100 })], '2026-11-25')
    expect(r.perPossesso.proprieta).toBe(2)
    expect(r.perStato).toMatchObject({ in_uso: 1, venduta: 1 })
    expect(r.multeDaPagare).toEqual({ numero: 1, totale_cent: 5200 })
  })
  it('raggruppamento per società attuale: alfabetico, da abbinare in fondo', () => {
    const daAbbinare = veicolo({ id: 'd', intestazioni: [{ contribuente_id: '', intestatario_testo: 'Omega', dal: '', al: '' }] })
    const g = raggruppaPerSocieta([daAbbinare, inUso, veicolo({ id: 'a' })], CONTR)
    expect(g.map((x) => x.nome)).toEqual(['Alfa', 'Beta', 'da abbinare: Omega'])
  })
})

describe('modulo della vettura', () => {
  const nuova = veicolo({ intestazioni: [], targa: '' })
  it('nuova vettura: targa normalizzata e prima intestazione dalla data di arrivo', () => {
    const v = applicaValoriVettura(nuova, { ...valoriVettura(nuova), societa: 'A', targa: 'ab 123 cd', modello: 'Panda', data_inizio: '2026-01-10' })
    expect(v.targa).toBe('AB123CD')
    expect(v.intestazioni).toEqual([{ contribuente_id: 'A', intestatario_testo: '', dal: '2026-01-10', al: '' }])
  })
  it('vettura esistente: la società si corregge (abbinamento), senza nuova intestazione', () => {
    const daAbbinare = veicolo({ intestazioni: [{ contribuente_id: '', intestatario_testo: 'Omega', dal: '', al: '' }] })
    const v = applicaValoriVettura(daAbbinare, { ...valoriVettura(daAbbinare), societa: 'B' })
    expect(v.intestazioni).toEqual([{ contribuente_id: 'B', intestatario_testo: '', dal: '', al: '' }])
  })
  it('venduta senza data: errore', () => {
    expect(() => applicaValoriVettura(veicolo(), { ...valoriVettura(veicolo()), stato: 'venduta', data_fine: '' })).toThrow()
  })
  it('venduta con data: chiude l\'intestazione', () => {
    const v = applicaValoriVettura(veicolo(), { ...valoriVettura(veicolo()), stato: 'venduta', data_fine: '2025-06-30' })
    expect([v.stato, v.data_fine, v.intestazioni[0].al]).toEqual(['venduta', '2025-06-30', '2025-06-30'])
  })
  it('di nuovo in uso: riapre l\'ultima intestazione e toglie la data di uscita', () => {
    const passata = veicolo({ stato: 'venduta', data_fine: '2025-06-30', intestazioni: [{ contribuente_id: 'A', intestatario_testo: '', dal: '', al: '2025-06-30' }] })
    const v = applicaValoriVettura(passata, { ...valoriVettura(passata), stato: 'in_uso' })
    expect([v.stato, v.data_fine, v.intestazioni[0].al]).toEqual(['in_uso', '', ''])
  })
  it('proprietà: nessun contratto; noleggio: contratto dai campi fin_*', () => {
    const base = valoriVettura(veicolo())
    expect(applicaValoriVettura(veicolo(), { ...base, possesso: 'proprieta', fin_societa: 'ALD' }).contratto).toBeNull()
    const nol = applicaValoriVettura(veicolo(), { ...base, possesso: 'noleggio', fin_societa: ' ALD ', fin_km: 60000, fin_canone: 35000 })
    expect(nol.contratto).toMatchObject({ societa_finanziaria: 'ALD', km_inclusi: 60000, canone_mensile_cent: 35000 })
  })
  it('andata e ritorno senza modifiche: vettura uguale', () => {
    const v = veicolo({ possesso: 'noleggio', contratto: { societa_finanziaria: 'ALD', numero: '1', decorrenza: '2024-01-01', scadenza: '2027-01-01', canone_mensile_cent: 100, anticipo_cent: null, riscatto_cent: null, km_inclusi: 1, bollo_incluso: 'si', assicurazione_inclusa: '' } })
    expect(applicaValoriVettura(v, valoriVettura(v))).toEqual(v)
  })
})

describe('Excel di consultazione', () => {
  it('una riga per vettura e una per multa, con nomi, date italiane ed euro', () => {
    const v = veicolo({ intestazioni: dueIntestazioni, scadenze: [voce({ tipo: 'bollo', scadenza: '2026-04-30' })] })
    const { vetture, multe } = righeExcelFlotta([v], [multa({ data_fatto: '2023-06-01', importo_cent: 4200, spese_rinotifica_cent: 1000 })], CONTR)
    expect(vetture[0]).toMatchObject({ 'Targa': 'AB123CD', 'Società attuale': 'Beta', 'Stato': 'In uso', 'Bollo': '30/04/2026', 'Intestazioni': 'Alfa (… – 31/03/2024); Beta (01/04/2024 – oggi)' })
    expect(multe[0]).toMatchObject({ 'Targa': 'AB123CD', 'Data': '01/06/2023', 'Società al momento del fatto': 'Alfa', 'Totale': 52 })
  })
})
