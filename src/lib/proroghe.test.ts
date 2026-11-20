import { describe, expect, it } from 'vitest'
import { contrattiScadutiSenzaRinnovo, prossimaScadenza, proroghePreviste } from './proroghe'
import { contratto } from './test/fixture'

describe('prossimaScadenza', () => {
  it('dopo i rinnovi indica la scadenza del periodo in corso', () => {
    const c = contratto({ tipologia: 'abitativo_4_4', data_decorrenza: '2018-01-01', prima_scadenza: '2022-01-01' })
    expect(prossimaScadenza(c, '2021-06-01')).toBe('2022-01-01')
    expect(prossimaScadenza(c, '2026-11-20')).toBe('2030-01-01')
    expect(prossimaScadenza(c, '2026-01-01')).toBe('2026-01-01')
  })
  it('commerciale 6+6', () => {
    const c = contratto({ tipologia: 'commerciale_6_6', data_decorrenza: '2014-05-01', prima_scadenza: '2020-05-01' })
    expect(prossimaScadenza(c, '2026-11-20')).toBe('2032-05-01')
  })
  it('senza rinnovo automatico o transitorio resta la prima scadenza', () => {
    expect(prossimaScadenza(contratto({ rinnovo_automatico: 'no', prima_scadenza: '2024-01-01' }), '2026-11-20')).toBe('2024-01-01')
    expect(prossimaScadenza(contratto({ tipologia: 'transitorio', durata_anni: 1, prima_scadenza: '2024-01-01' }), '2026-11-20')).toBe('2024-01-01')
    expect(prossimaScadenza(contratto({ prima_scadenza: '' }), '2026-11-20')).toBe('')
  })
})

describe('proroghePreviste', () => {
  it('propone la proroga alla scadenza dei contratti con rinnovo automatico', () => {
    const c = contratto({ data_decorrenza: '2022-01-01', prima_scadenza: '2026-01-01' })
    const p = proroghePreviste([c], [], '2026-11-20')
    expect(p.map((x) => x.data)).toEqual(['2026-01-01'])
  })
  it('non propone proroghe ai contratti senza rinnovo automatico', () => {
    const c = contratto({ rinnovo_automatico: 'no', data_decorrenza: '2022-01-01', prima_scadenza: '2026-01-01' })
    expect(proroghePreviste([c], [], '2026-11-20')).toEqual([])
    expect(contrattiScadutiSenzaRinnovo([c], '2026-11-20').map((x) => x.id)).toEqual(['c1'])
  })
})
