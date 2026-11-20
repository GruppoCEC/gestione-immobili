import { afterEach, describe, expect, it, vi } from 'vitest'
import { aggiungiAnni, aggiungiMesi, analizzaEuro, formattaData, formattaEuro, oggiIso } from './formato'

describe('analizzaEuro', () => {
  it('formato italiano con virgola e punti delle migliaia', () => {
    expect(analizzaEuro('1.350,00')).toBe(135000)
    expect(analizzaEuro('1350,00')).toBe(135000)
    expect(analizzaEuro('1.234.567,89')).toBe(123456789)
    expect(analizzaEuro('€ 1.000,50')).toBe(100050)
    expect(analizzaEuro('0,5')).toBe(50)
  })
  it('punto usato come separatore dei decimali (650.50 non deve diventare 65.050,00)', () => {
    expect(analizzaEuro('650.50')).toBe(65050)
    expect(analizzaEuro('650.5')).toBe(65050)
    expect(analizzaEuro('12345.67')).toBe(1234567)
  })
  it('punti delle migliaia senza decimali', () => {
    expect(analizzaEuro('1.350')).toBe(135000)
    expect(analizzaEuro('1.234.567')).toBe(123456700)
  })
  it('numeri interi e valori non validi', () => {
    expect(analizzaEuro('1350')).toBe(135000)
    expect(analizzaEuro('')).toBeNull()
    expect(analizzaEuro('  ')).toBeNull()
    expect(analizzaEuro('abc')).toBeNull()
  })
})

describe('aggiungiMesi', () => {
  it("non perde un giorno al passaggio all'ora legale", () => {
    expect(aggiungiMesi('2026-03-15', 1)).toBe('2026-04-15')
    expect(aggiungiMesi('2026-01-15', 3)).toBe('2026-04-15')
    expect(aggiungiMesi('2026-11-20', 6)).toBe('2027-05-20')
  })
  it("a fine mese si ferma all'ultimo giorno del mese", () => {
    expect(aggiungiMesi('2026-01-31', 1)).toBe('2026-02-28')
    expect(aggiungiMesi('2024-01-31', 1)).toBe('2024-02-29')
    expect(aggiungiMesi('2026-08-31', 6)).toBe('2027-02-28')
    expect(aggiungiMesi('2026-03-31', 1)).toBe('2026-04-30')
  })
  it("cambio d'anno e mesi negativi", () => {
    expect(aggiungiMesi('2026-12-10', 1)).toBe('2027-01-10')
    expect(aggiungiMesi('2026-01-10', -1)).toBe('2025-12-10')
  })
})

describe('aggiungiAnni', () => {
  it('aggiunge anni e gestisce il 29 febbraio', () => {
    expect(aggiungiAnni('2022-03-01', 4)).toBe('2026-03-01')
    expect(aggiungiAnni('2024-02-29', 1)).toBe('2025-02-28')
    expect(aggiungiAnni('2024-02-29', 4)).toBe('2028-02-29')
  })
})

describe('oggiIso', () => {
  afterEach(() => { vi.useRealTimers() })
  it("usa la data italiana anche subito dopo mezzanotte", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-14T22:30:00Z')) // 00:30 del 15/06 in Italia (ora legale)
    expect(oggiIso()).toBe('2026-06-15')
    vi.setSystemTime(new Date('2026-12-31T23:15:00Z')) // 00:15 del 01/01/2027 in Italia
    expect(oggiIso()).toBe('2027-01-01')
  })
})

describe('formattazione', () => {
  it('euro e date', () => {
    expect(formattaEuro(135000).replace(/\s/g, ' ')).toBe('1.350,00 €')
    expect(formattaEuro(null)).toBe('—')
    expect(formattaData('2026-09-24')).toBe('24/09/2026')
  })
})
