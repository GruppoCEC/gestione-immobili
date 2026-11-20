import { describe, expect, it } from 'vitest'
import { contribuenteNelTesto } from './importaTributi'
import type { Contribuente } from './tipi'

const c = (id: string, nome: string, extra: Partial<Contribuente> = {}) => ({ id, nome, alias: [], ragione_sociale: '', ...extra }) as unknown as Contribuente

describe('contribuenteNelTesto', () => {
  const elenco = [c('a', 'Esempio'), c('b', 'Prova Uno', { ragione_sociale: 'Studio Prova Uno srl' }), c('d', 'Centro', { alias: ['Esempio Centro'] })]
  it('riconosce nome, ragione sociale e alias come parole intere; vince il più lungo', () => {
    expect(contribuenteNelTesto('STUDIO PROVA UNO SRL', elenco)?.id).toBe('b')
    expect(contribuenteNelTesto('Studio Esempio Centro srl', elenco)?.id).toBe('d')
    expect(contribuenteNelTesto('STUDIO ESEMPIO SRL', elenco)?.id).toBe('a')
    expect(contribuenteNelTesto('ESEMPIONE', elenco)).toBeNull()
  })
})
