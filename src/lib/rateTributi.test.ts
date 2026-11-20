import { describe, expect, it } from 'vitest'
import { calcolaRate, decorrenzaDaElaborazione, dividiQuota } from './rateTributi'

describe('dividiQuota', () => {
  it('separa imposta e sanzioni al 10%', () => {
    expect(dividiQuota(11000, 10)).toEqual({ quota_capitale_cent: 10000, sanzioni_cent: 1000 })
  })
})

describe('calcolaRate', () => {
  const rate = calcolaRate({
    importo_cent: 100001, n_rate: 4, prima_scadenza: '2026-01-31', periodicita: 'trimestrale',
    tasso_percento: 3.5, decorrenza_interessi: '2025-12-31', sanzioni_percento: 10,
  })
  it("il resto dei centesimi va sulla prima rata", () => {
    expect(rate.map((r) => r.quota_capitale_cent + r.sanzioni_cent)).toEqual([25001, 25000, 25000, 25000])
  })
  it('scadenze a fine trimestre, spostate al primo giorno lavorativo', () => {
    expect(rate.map((r) => r.scadenza)).toEqual(['2026-01-31', '2026-04-30', '2026-07-31', '2026-11-02'])
  })
  it('interessi dalla seconda rata', () => {
    expect(rate[0].interessi_cent).toBe(0)
    expect(rate[1].interessi_cent).toBe(288) // 250 € × 3,5% × 120 giorni / 365
  })
})

describe('decorrenzaDaElaborazione', () => {
  it('ultimo giorno del mese successivo', () => {
    expect(decorrenzaDaElaborazione('2026-01-15')).toBe('2026-02-28')
  })
})
