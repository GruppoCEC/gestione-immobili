import { describe, expect, it } from 'vitest'
import { inizioAnnualita, regoleImposta } from './imposta'
import { contratto, societa } from './test/fixture'

describe('regoleImposta', () => {
  it('commerciale di una società: 1% anche se la locazione è esente IVA', () => {
    const c = contratto({ tipologia: 'commerciale_6_6', regime_iva: 'esente' })
    expect(regoleImposta(c, societa({ tipo: 'societa' }))).toEqual({ percento: 1, base: 100 })
  })
  it('commerciale di una persona fisica: 2%', () => {
    const c = contratto({ tipologia: 'commerciale_6_6', regime_iva: 'esente' })
    expect(regoleImposta(c, societa({ tipo: 'persona' }))).toEqual({ percento: 2, base: 100 })
  })
  it('senza locatore noto resta la regola del regime IVA', () => {
    expect(regoleImposta(contratto({ tipologia: 'uso_diverso', regime_iva: 'con_iva' })).percento).toBe(1)
    expect(regoleImposta(contratto({ tipologia: 'uso_diverso', regime_iva: 'esente' })).percento).toBe(2)
  })
  it('abitativi: 2%, concordato 3+2 su base 70%', () => {
    expect(regoleImposta(contratto({ tipologia: 'abitativo_4_4' }), societa())).toEqual({ percento: 2, base: 100 })
    expect(regoleImposta(contratto({ tipologia: 'abitativo_3_2' }), societa())).toEqual({ percento: 2, base: 70 })
  })
})

describe('inizioAnnualita', () => {
  it("giorno e mese della decorrenza con l'anno scelto", () => {
    expect(inizioAnnualita(contratto({ data_decorrenza: '2022-03-15' }), 2026)).toBe('2026-03-15')
    expect(inizioAnnualita(contratto({ data_decorrenza: '' }), 2026)).toBe('')
  })
})
