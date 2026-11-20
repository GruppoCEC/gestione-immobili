import { describe, expect, it } from 'vitest'
import { riepilogoPratiche, situazioneRata, stessoPiano, trovaDoppioni } from './tributi'
import type { PraticaTributo, RataTributo } from './tipi'

const rata = (numero: number, scadenza: string, totale: number, pagata = false): RataTributo => ({
  numero, scadenza, quota_capitale_cent: totale, sanzioni_cent: 0, interessi_cent: 0, totale_cent: totale, pagata, pagata_il: pagata ? scadenza : '', note: '',
})
const pratica = (parz: Partial<PraticaTributo>): PraticaTributo => ({
  creato_il: '', creato_da: '', modificato_il: '', modificato_da: '', eliminato_il: null,
  id: 'p1', contribuente_id: 'u1', tipo: 'avviso_bonario', tributo: 'IVA I TRIM 26', anno_rateizzo: 2026, numero_atto: '',
  data_notifica: '', termine_pagamento: '', importo_cent: null, gia_versato_cent: null, stato: 'rateizzato', rate_concordate: null,
  rate: [], note: '', ...parz,
} as PraticaTributo)

describe('situazioneRata', () => {
  const p = pratica({ rate: [rata(1, '2026-03-31', 1000), rata(2, '2026-06-30', 1000)] })
  it('avviso bonario: rata saltata recuperabile entro la successiva', () => {
    expect(situazioneRata(p, p.rate[0], '2026-04-10')).toEqual({ tipo: 'da_recuperare', entro: '2026-06-30' })
    expect(situazioneRata(p, p.rate[0], '2026-07-01')).toEqual({ tipo: 'oltre_termine', entro: '2026-06-30' })
    expect(situazioneRata(p, p.rate[1], '2026-04-10')).toEqual({ tipo: 'da_pagare' })
  })
})

describe('riepilogoPratiche', () => {
  it('le rate non pagate dei piani decaduti non sono "da pagare"', () => {
    const attiva = pratica({ id: 'a', rate: [rata(1, '2026-01-31', 1000, true), rata(2, '2026-04-30', 1000)] })
    const decaduta = pratica({ id: 'd', stato: 'decaduto', rate: [rata(1, '2026-01-31', 500, true), rata(2, '2026-04-30', 500)] })
    const r = riepilogoPratiche([attiva, decaduta], '2026-03-01')
    expect(r.residuo.totale_cent).toBe(1000)
    expect(r.decaduto.totale_cent).toBe(500)
    expect(r.pagato.totale_cent).toBe(1500)
  })
})

describe('piani doppi', () => {
  it('stesso piano con differenza di pochi centesimi', () => {
    const a = pratica({ id: 'a', rate: [rata(1, '2026-01-31', 804692), rata(2, '2026-04-30', 100000)] })
    const b = pratica({ id: 'b', rate: [rata(1, '2026-01-31', 804693), rata(2, '2026-04-30', 100000, true)] })
    expect(stessoPiano(a, b)).toBe(true)
    const g = trovaDoppioni([a, b])
    expect(g).toHaveLength(1)
    expect(g[0].tieni.rate[1].pagata).toBe(true)
  })
  it('importi diversi: piani diversi', () => {
    const a = pratica({ id: 'a', rate: [rata(1, '2026-01-31', 50000)] })
    const b = pratica({ id: 'b', rate: [rata(1, '2026-01-31', 90000)] })
    expect(stessoPiano(a, b)).toBe(false)
  })
})
