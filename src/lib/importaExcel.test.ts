import { describe, expect, it } from 'vitest'
import { centesimi } from './importaExcel'

describe('importi letti dalle celle Excel', () => {
  it('numeri e testi in formato italiano o inglese', () => {
    expect(centesimi(1234.56)).toBe(123456)
    expect(centesimi('1.234,56')).toBe(123456)
    expect(centesimi('1,234.56')).toBe(123456)
    expect(centesimi('€ 650,00')).toBe(65000)
    expect(centesimi('')).toBe(0)
    expect(centesimi(null)).toBe(0)
  })
})
