import { describe, expect, it } from 'vitest'
import { analizzaRigheFlotta, dataDaCella } from './importaFlotta'
import { contribuente, veicolo } from './test/fixture'
import type { Veicolo } from './tipi'

/** Numero di serie Excel di una data (come nelle celle dei file veri). */
const s = (iso: string) => { const [a, m, g] = iso.split('-').map(Number); return (Date.UTC(a, m - 1, g) - Date.UTC(1899, 11, 30)) / 86_400_000 }
const CONTR = [contribuente({ id: 'A', nome: 'Alfa' }), contribuente({ id: 'B', nome: 'Beta' }), contribuente({ id: 'G', nome: 'Gamma' })]
const leggi = (fogli: unknown[][][], esistenti: Veicolo[] = []) => analizzaRigheFlotta(fogli.map((righe, i) => ({ nome: `foglio${i}`, righe })), CONTR, esistenti, 'Davide')
const per = (r: { veicoli: Veicolo[] }, targa: string) => r.veicoli.find((v) => v.targa === targa)!
const voce = (v: Veicolo, tipo: string) => v.scadenze.find((x) => x.tipo === tipo)!

// Disposizione del "Prospetto Vetture" (blocchi uno sotto l'altro, vendute a destra con la propria intestazione)
const PROSPETTO = [
  [],
  ['Vetture di proprietà'],
  ['Società', 'Vetture', 'Targhe', 'Scadenza Bollo', 'Importo Superbollo', 'Scadenza Revisione', '', '', '', 'Vetture vendute'],
  ['Alfa Immob.', 'Urus', 'AA111AA', 'Pagato da BMW', 'Pagato da BMW', s('2025-10-31'), '', '', '', 'Colonna1', 'Colonna2', 'Colonna3'],
  ['Omega', 'FIAT 500', 'BB222BB', s('2023-10-31'), ' NO', s('2023-09-30'), '', '', '', 'Società', 'Vettura', 'Targa'],
  ['', 'Dokker', 'CC333CC', s('2023-04-30'), 'NO', s('2023-04-30'), '', '', '', 'Beta', 'Cayenne', 'DD444DD'],
  ['', 'Porsche d\'epoca', 'HH888HH', 'esente fino al 2025', '', '31/09/2023'],
  [],
  ['Vetture a noleggio'],
  ['Società', 'Vettura', 'Targa', 'Scadenza revisione', 'Scadenza Noleggio', 'Colonna1'],
  ['Beta', 'Renegade', 'EE555EE', '', s('2024-01-31'), 'va fatta voltura'],
  ['Gamma', 'Smart FORTWO', 'XY670VV', s('2024-06-30'), s('2023-07-24')],
]
// Disposizione di "Scadenza Bolli Vetture" (panoramica, vendute a destra senza intestazione propria, leasing sotto)
const BOLLI = [
  ['', '', 'Panoramica Vetture'],
  ['Veicolo', 'Targa', 'Società', 'Scadenza Bollo', 'Importo', 'Superbollo', 'Revisione', 'Assicurazione', '', 'Vetture Vendute'],
  ['Dokker', 'CC 333 CC', 'Omega', s('2023-01-31'), '', '', s('2023-04-30'), s('2022-12-09'), '', 'Porsche', 'FF666FF', 'Alfa (venduta)', s('2021-01-31')],
  ['Lamborghini URUS', 'AA111AA', 'Alfa', 'Pagati da BMW BANK per tutto il leasing', '', '', 2025, s('2022-12-09'), '', 'Dokker', 'CC333CC', 'Omega (venduta)', s('2023-05-15')],
  ['', '', 'TOTALE', 0, 0, 0],
  [],
  ['', 'Vetture in Leasing'],
  ['Veicolo', 'Targa', 'Società', 'Scadenza contratto'],
  ['Jeep Renegade', '', 'Beta (Leasys)', ''],
  ['Smart Fortwo 3door', 'XY670W', 'Gamma (ALD)', s('2023-07-24')],
  ['Mercedes Classe A', 'MM123MM', 'Gamma (BMW Bank)', s('2026-03-31')],
  ['Smart', '', 'Delta (ALD)', ''],
]

describe('date delle celle', () => {
  it('numero di serie Excel, data JavaScript con fuso, testo italiano', () => {
    expect(dataDaCella(s('2023-10-31'))).toEqual({ data: '2023-10-31' })
    expect(dataDaCella(new Date('2023-10-30T23:00:00Z'))).toEqual({ data: '2023-10-31' })
    expect(dataDaCella('15/03/2024')).toEqual({ data: '2024-03-15' })
  })
  it('date impossibili, anni e testi restano testo; celle vuote nulle', () => {
    expect(dataDaCella('31/09/2023')).toEqual({ testo: '31/09/2023' })
    expect(dataDaCella(2025)).toEqual({ testo: '2025' })
    expect(dataDaCella('Esente')).toEqual({ testo: 'Esente' })
    expect(dataDaCella('')).toBeNull()
    expect(dataDaCella(0)).toBeNull()
  })
})

describe('lettura del Prospetto vetture', () => {
  const r = leggi([PROSPETTO])
  it('blocco proprietà e blocco noleggio', () => {
    expect(per(r, 'AA111AA').possesso).toBe('proprieta')
    const ren = per(r, 'EE555EE')
    expect(ren.possesso).toBe('noleggio')
    expect(ren.contratto?.scadenza).toBe('2024-01-31')
    expect(ren.note).toContain('va fatta voltura')
  })
  it('società abbinata agli uffici dei tributi, togliendo "Immob."', () => {
    expect(per(r, 'AA111AA').intestazioni[0].contribuente_id).toBe('A')
  })
  it('società vuota: quella della riga sopra; non trovata: da abbinare con avviso', () => {
    expect(per(r, 'CC333CC').intestazioni[0]).toMatchObject({ contribuente_id: '', intestatario_testo: 'Omega' })
    expect(r.avvisi.some((a) => a.includes('Omega'))).toBe(true)
  })
  it('vendute nel gruppo di colonne a destra', () => {
    const v = per(r, 'DD444DD')
    expect([v.stato, v.modello, v.intestazioni[0].contribuente_id]).toEqual(['venduta', 'Cayenne', 'B'])
  })
  it('scadenze dalle date; testi del bollo come "non dovuto"; "NO" ignorato', () => {
    const fiat = per(r, 'BB222BB')
    expect([voce(fiat, 'bollo').scadenza, voce(fiat, 'revisione').scadenza]).toEqual(['2023-10-31', '2023-09-30'])
    expect(fiat.note).toBe('')
    expect(voce(per(r, 'AA111AA'), 'bollo').non_dovuta).toBe('Pagato da BMW')
    expect(voce(per(r, 'HH888HH'), 'bollo').non_dovuta).toBe('esente fino al 2025')
  })
  it('data impossibile nelle note', () => {
    expect(per(r, 'HH888HH').note).toContain('Revisione nel file: 31/09/2023')
  })
  it('tutte da verificare, riga TOTALE e righe vuote saltate', () => {
    expect(r.veicoli.every((v) => v.da_verificare)).toBe(true)
    expect(r.veicoli).toHaveLength(7)
  })
})

describe('lettura di Scadenza bolli e unione dei due file', () => {
  const r = leggi([PROSPETTO, BOLLI])
  it('vendute senza intestazione propria: veicolo, targa, società, data', () => {
    const v = per(r, 'FF666FF')
    expect([v.stato, v.data_fine, v.intestazioni[0].contribuente_id, v.intestazioni[0].al]).toEqual(['venduta', '2021-01-31', 'A', '2021-01-31'])
  })
  it('stessa targa scritta in modo diverso: una sola vettura; la data più recente vince, l\'altra nelle note', () => {
    const v = per(r, 'CC333CC')
    expect(r.veicoli.filter((x) => x.targa === 'CC333CC')).toHaveLength(1)
    expect(voce(v, 'bollo').scadenza).toBe('2023-04-30')
    expect(v.note).toContain('31/01/2023')
    expect(voce(v, 'assicurazione').scadenza).toBe('2022-12-09')
  })
  it('venduta in un file e in uso nell\'altro: venduta', () => {
    expect([per(r, 'CC333CC').stato, per(r, 'CC333CC').data_fine]).toEqual(['venduta', '2023-05-15'])
  })
  it('il modello più completo vince; anno al posto della data nelle note', () => {
    const urus = per(r, 'AA111AA')
    expect(urus.modello).toBe('Lamborghini URUS')
    expect(urus.note).toContain('Revisione nel file: 2025')
  })
  it('blocco leasing: ALD e Leasys sono noleggi, le altre finanziarie leasing', () => {
    expect(per(r, 'XY670W')).toMatchObject({ possesso: 'noleggio', contratto: { societa_finanziaria: 'ALD', scadenza: '2023-07-24' } })
    expect(per(r, 'MM123MM')).toMatchObject({ possesso: 'leasing', contratto: { societa_finanziaria: 'BMW Bank' } })
    expect(per(r, 'XY670W').intestazioni[0].contribuente_id).toBe('G')
  })
  it('riga senza targa unita alla vettura della stessa società con lo stesso modello', () => {
    expect(per(r, 'EE555EE').contratto?.societa_finanziaria).toBe('Leasys')
  })
  it('riga senza targa non abbinabile: avviso', () => {
    expect(r.avvisi.some((a) => a.includes('senza targa') && a.includes('Smart') && a.includes('Delta'))).toBe(true)
  })
  it('targhe quasi uguali della stessa vettura: avviso di possibile errore di battitura', () => {
    expect(r.avvisi.some((a) => a.includes('XY670VV') && a.includes('XY670W'))).toBe(true)
  })
})

describe('doppioni', () => {
  it('targa già presente nella flotta: non caricata e segnalata', () => {
    const r = leggi([PROSPETTO], [veicolo({ targa: 'AA111AA' })])
    expect(r.doppioni).toEqual(['AA111AA'])
    expect(r.veicoli.some((v) => v.targa === 'AA111AA')).toBe(false)
  })
  it('una vettura eliminata non conta come doppione', () => {
    expect(leggi([PROSPETTO], [veicolo({ targa: 'AA111AA', eliminato_il: '2026-01-01' })]).doppioni).toEqual([])
  })
})

describe('casi trovati nei file veri', () => {
  it('data impossibile nella colonna del bollo: nelle note, non come "bollo non dovuto"', () => {
    const r = leggi([[['Veicolo', 'Targa', 'Società', 'Scadenza Bollo'], ['Toyota IQ', 'GG777GG', 'Alfa', '31/09/2023']]])
    expect(voce(per(r, 'GG777GG'), 'bollo').non_dovuta).toBe('')
    expect(per(r, 'GG777GG').note).toContain('Bollo nel file: 31/09/2023')
  })
  it('stessa società scritta per intero e abbreviata: nessun avviso di società diversa', () => {
    const contr = [contribuente({ id: 'M', nome: 'Motori' })]
    const righe = [['Veicolo', 'Targa', 'Società'], ['Porsche', 'PP111PP', 'Gruppo Prova Motori'], ['Porsche', 'PP111PP', 'Gruppo Prova Mot.']]
    const r = analizzaRigheFlotta([{ nome: 'f', righe }], contr, [], 'Davide')
    expect(r.avvisi.filter((a) => a.includes('Società diversa'))).toEqual([])
    expect(r.veicoli[0].note).toBe('')
  })
})
