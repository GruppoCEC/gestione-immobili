import { describe, expect, it } from 'vitest'
import { calcolaRavvedimento, percentualeSanzione, primoLavorativo, scadenzaVersamento } from './ravvedimento'

describe('primoLavorativo', () => {
  it('salta Pasquetta, sabati, domeniche e festivi', () => {
    expect(primoLavorativo('2026-04-06')).toBe('2026-04-07') // Pasquetta 2026
    expect(primoLavorativo('2026-08-15')).toBe('2026-08-17') // sabato di Ferragosto
    expect(primoLavorativo('2026-12-25')).toBe('2026-12-28')
    expect(primoLavorativo('2026-11-20')).toBe('2026-11-20')
  })
  it('scadenza del versamento a 30 giorni', () => {
    expect(scadenzaVersamento('2026-01-01')).toBe('2026-02-02') // 31/01 è sabato
  })
})

describe('percentualeSanzione', () => {
  it('regime vecchio (30%) e nuovo (25%)', () => {
    expect(percentualeSanzione(5, '2024-01-01').percentuale).toBeCloseTo(0.5)
    expect(percentualeSanzione(20, '2025-01-01').percentuale).toBeCloseTo(1.25)
    expect(percentualeSanzione(60, '2025-01-01').percentuale).toBeCloseTo(25 / 18)
    expect(percentualeSanzione(0, '2025-01-01').percentuale).toBe(0)
  })
})

describe('calcolaRavvedimento', () => {
  it('interessi divisi per anno con il tasso di ciascun anno', () => {
    const r = calcolaRavvedimento(10000, '2025-12-20', '2026-01-10', { 2025: 2, 2026: 1.6 })
    expect(r.giorniRitardo).toBe(21)
    expect(r.dettaglioInteressi.map((q) => [q.anno, q.giorni])).toEqual([[2025, 11], [2026, 10]])
    expect(r.interessi_cent).toBe(10)
    expect(r.sanzione_cent).toBe(125)
    expect(r.totale_cent).toBe(10135)
  })
  it('segnala i tassi mancanti', () => {
    expect(calcolaRavvedimento(10000, '2025-12-20', '2026-01-10', { 2025: 2 }).tassiMancanti).toEqual([2026])
  })
})
