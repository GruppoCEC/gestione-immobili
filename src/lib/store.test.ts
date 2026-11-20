import { describe, expect, it } from 'vitest'
import { descriviUnione, soloCampiCambiati, sostituisciUnendo, unisciModifiche, type RecordBase } from './store'

type Scheda = RecordBase & { telefono: string; pec: string; note: string }
const base = (x: Partial<Scheda> = {}): Scheda => ({ id: 'k1', creato_il: '', creato_da: '', modificato_il: '2026-11-20T10:00:00Z', modificato_da: 'Davide', eliminato_il: null, telefono: '111', pec: 'a@pec.it', note: '', ...x })

describe('unione delle modifiche sulla stessa scheda', () => {
  it('solo i campi cambiati nel modulo', () => {
    expect(soloCampiCambiati({ telefono: '222', pec: 'a@pec.it' }, base())).toEqual({ telefono: '222' })
  })
  it('le modifiche del collega agli altri campi restano', () => {
    const aperta = base()
    const attuale = base({ pec: 'nuova@pec.it', modificato_il: '2026-11-20T10:05:00Z', modificato_da: 'Emanuela' })
    const u = unisciModifiche(attuale, { ...aperta, telefono: '222' }, aperta)
    expect([u.record.telefono, u.record.pec]).toEqual(['222', 'nuova@pec.it'])
    expect(u.esito).toEqual({ altri: 'Emanuela', stessiCampi: [] })
    expect(descriviUnione(u.esito)).toContain('Emanuela')
  })
  it('stesso campo cambiato da entrambi: vale l\'utente, con avviso', () => {
    const aperta = base()
    const attuale = base({ telefono: '333', modificato_il: '2026-11-20T10:05:00Z', modificato_da: 'Emanuela' })
    const u = unisciModifiche(attuale, { ...aperta, telefono: '222' }, aperta)
    expect(u.record.telefono).toBe('222')
    expect(descriviUnione(u.esito, { telefono: 'Telefono' })).toContain('Per Telefono vale la tua versione')
  })
  it('nessun collega: nessun avviso', () => {
    const aperta = base()
    const u = unisciModifiche(aperta, { ...aperta, note: 'x' }, aperta)
    expect(u.esito.altri).toBeNull()
    expect(descriviUnione(u.esito)).toBeNull()
  })
  it('sostituisce solo la scheda indicata e aggiorna chi l\'ha modificata', () => {
    const aperta = base()
    const r = sostituisciUnendo([aperta, base({ id: 'k2' })], 'k1', { ...aperta, note: 'ciao' }, aperta, 'Veronica')
    expect(r.record[0].note).toBe('ciao')
    expect(r.record[0].modificato_da).toBe('Veronica')
    expect(r.record[1].note).toBe('')
  })
})
