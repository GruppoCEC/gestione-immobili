import { describe, expect, it } from 'vitest'
import { UTENTI, livello, sezioneDiPercorso } from './permessi'
import { NOMI_COLLEZIONI } from './store'

const utente = (id: string) => UTENTI.find((u) => u.id === id)

describe('sezione Flotta aziendale', () => {
  it('i percorsi della flotta e le sue stampe appartengono alla sezione flotta', () => {
    expect(sezioneDiPercorso('/flotta')).toBe('flotta')
    expect(sezioneDiPercorso('/flotta/vettura/x')).toBe('flotta')
    expect(sezioneDiPercorso('/stampa/flotta/elenco')).toBe('flotta')
    expect(sezioneDiPercorso('/stampa/flotta/vettura/x')).toBe('flotta')
  })
  it('Davide ed Emanuela modificano, Veronica non vede', () => {
    expect(livello(utente('davide'), 'flotta')).toBe('modifica')
    expect(livello(utente('emanuela'), 'flotta')).toBe('modifica')
    expect(livello(utente('veronica'), 'flotta')).toBe('nessuno')
  })
  it('le collezioni della flotta sono registrate (entrano in backup e ripristino)', () => {
    expect(NOMI_COLLEZIONI).toContain('veicoli')
    expect(NOMI_COLLEZIONI).toContain('multe_veicoli')
  })
})
