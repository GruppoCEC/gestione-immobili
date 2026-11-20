import { describe, expect, it } from 'vitest'
import { fineMese, mensilita, royaltyDaRegistrare, scomponiTotale, totaliTariffa } from './fornitori'
import type { Contribuente, FatturaFornitore } from './tipi'

const base = { creato_il: '', creato_da: '', modificato_il: '', modificato_da: '', eliminato_il: null }
const studio = (parz: Partial<Contribuente> = {}): Contribuente => ({
  ...base, id: 'st1', nome: 'Ufficio di prova', alias: [], ragione_sociale: '', codice_fiscale: '', partita_iva: '',
  responsabile: 'Mario', email: '', email_cc: '', studio: '', societa_id: '', conduttore_id: '', note: '',
  royalty_importi: { Tecnocasa: [{ dal: '2026-08', imponibile_cent: 81967, iva_percento: 22, totale_cent: 100000 }] },
  ...parz,
} as Contribuente)
const fattura = (parz: Partial<FatturaFornitore>): FatturaFornitore => ({
  ...base, id: 'f1', contribuente_id: 'st1', fornitore: 'Tecnocasa', tipologia: 'royalty', numero: '1', data_fattura: '2026-09-01',
  scadenza: '', competenza: '2026-09', importo_cent: 100000, pagata: false, pagata_il: '', note: '', ...parz,
})

describe('importi delle royalty', () => {
  it('scompone il totale con IVA al centesimo', () => {
    expect(scomponiTotale(100000, 22)).toEqual({ imponibile_cent: 81967, iva_cent: 18033 })
    expect(totaliTariffa({ dal: '2026-01', imponibile_cent: 81967, iva_percento: 22, totale_cent: 100000 }).totale_cent).toBe(100000)
    expect(totaliTariffa({ dal: '2026-01', imponibile_cent: 100000, iva_percento: 22 }).totale_cent).toBe(122000)
  })
  it('fine mese', () => {
    expect(fineMese('2026-02')).toBe('2026-02-28')
    expect(fineMese('2026-12')).toBe('2026-12-31')
  })
})

describe('mensilita', () => {
  it('senza fattura: da pagare nel mese, insoluta dopo', () => {
    expect(mensilita(studio(), 'Tecnocasa', '2026-10', [], '2026-10-05').stato).toBe('da_pagare')
    expect(mensilita(studio(), 'Tecnocasa', '2026-09', [], '2026-10-05').stato).toBe('insoluta')
    expect(mensilita(studio(), 'Tecnocasa', '2026-07', [], '2026-10-05').stato).toBeNull()
  })
  it('con la fattura vale la fattura', () => {
    const m = mensilita(studio(), 'Tecnocasa', '2026-09', [fattura({ pagata: true, pagata_il: '2026-09-20', importo_cent: 95000 })], '2026-10-05')
    expect(m.stato).toBe('pagata')
    expect(m.importo_cent).toBe(95000)
  })
})

describe('royaltyDaRegistrare', () => {
  it('mensilità calcolate fino al mese corrente, escluse quelle già registrate', () => {
    const r = royaltyDaRegistrare(studio(), [fattura({ competenza: '2026-09' })], '2026-10-05')
    expect(r.map((f) => f.competenza)).toEqual(['2026-08', '2026-10'])
  })
  it('nessuna mensilità per chi non paga quella royalty', () => {
    expect(royaltyDaRegistrare(studio({ senza_royalty: ['Tecnocasa'] }), [], '2026-10-05')).toEqual([])
  })
})

describe('fatture raggruppate per studio', () => {
  it('stesso risultato di royaltyDaRegistrare sull\'elenco completo', async () => {
    const { fattureConRoyalty, raggruppaPerStudio } = await import('./fornitori')
    const tutte = [fattura({ competenza: '2026-09' }), fattura({ id: 'f2', contribuente_id: 'altro', competenza: '2026-08' })]
    const r = fattureConRoyalty(studio(), raggruppaPerStudio(tutte), '2026-10-05')
    expect(r.map((f) => f.competenza)).toEqual(['2026-09', '2026-08', '2026-10'])
  })
})

describe('registraMensilita', () => {
  it('nuova registrazione con scadenza a fine mese, oppure aggiorna quella esistente', async () => {
    const { registraMensilita } = await import('./fornitori')
    const n = registraMensilita('Prova', { contribuente_id: 'st1', fornitore: 'Tecnocasa', competenza: '2026-02' }, undefined, { importo_cent: 100000, pagata: true, pagata_il: '2026-03-01' })
    expect([n.tipologia, n.scadenza, n.importo_cent, n.pagata, n.modificato_da]).toEqual(['royalty', '2026-02-28', 100000, true, 'Prova'])
    const e = registraMensilita('Prova', { contribuente_id: 'st1', fornitore: 'Tecnocasa', competenza: '2026-09' }, fattura({}), { numero: '77' })
    expect([e.id, e.numero, e.importo_cent]).toEqual(['f1', '77', 100000])
  })
})
