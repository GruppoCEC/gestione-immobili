import { describe, expect, it } from 'vitest'
import { testoAggiornamento } from './aggiornamenti'

describe('avviso di aggiornamento', () => {
  it('nomina chi ha salvato e le sezioni, esclusi i propri salvataggi', () => {
    expect(testoAggiornamento(['Emanuela: modifica contratto', 'Davide: nuovo movimento'], ['Contratti', 'Canoni e incassi'], 'Davide'))
      .toBe('Emanuela ha aggiornato: Contratti, Canoni e incassi')
    expect(testoAggiornamento(['Emanuela: x', 'Veronica: y'], ['Canoni e incassi', 'Canoni e incassi'], 'Davide'))
      .toBe('Emanuela e Veronica hanno aggiornato: Canoni e incassi')
  })
  it('niente avviso per i propri salvataggi o senza sezioni ricaricate', () => {
    expect(testoAggiornamento(['Davide: x'], ['Contratti'], 'Davide')).toBeNull()
    expect(testoAggiornamento(['Emanuela: x'], [], 'Davide')).toBeNull()
  })
})
