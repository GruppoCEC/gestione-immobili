import { describe, expect, it } from 'vitest'
import { aggiungiGiorni, dataEstesa, fineMese, fineMeseDopo, giorniTra, meseBreveAnno, meseBreveAnnoCorto, meseDopo, meseLungo, mesiDellAnno } from './date'

describe('date comuni', () => {
  it('giorni', () => {
    expect(aggiungiGiorni('2026-03-28', 3)).toBe('2026-03-31')
    expect(aggiungiGiorni('2026-03-01', -1)).toBe('2026-02-28')
    expect(giorniTra('2026-03-01', '2026-04-01')).toBe(31)
  })
  it('mesi', () => {
    expect(fineMese('2024-02')).toBe('2024-02-29')
    expect(fineMese('2026-12')).toBe('2026-12-31')
    expect(meseDopo('2026-12')).toBe('2027-01')
    expect(meseDopo('2026-01', -1)).toBe('2025-12')
    expect(meseDopo('2026-01-31', 3)).toBe('2026-04')
    expect(fineMeseDopo('2026-01-31', 3)).toBe('2026-04-30')
    expect(mesiDellAnno(2026)[11]).toBe('2026-12')
  })
  it('testi', () => {
    expect(meseLungo('2026-03')).toBe('marzo 2026')
    expect(meseBreveAnno('2026-03')).toBe('Mar 2026')
    expect(meseBreveAnnoCorto('2026-03')).toBe('Mar 26')
    expect(dataEstesa('2026-11-20')).toBe('venerdì 20 novembre 2026')
  })
})
