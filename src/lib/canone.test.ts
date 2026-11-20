import { describe, expect, it } from 'vitest'
import { adeguaCanoniRegistrati, canoneMensilePer, scadenzaCanone, totaliAnnoContratto } from './canone'
import { annualita, contratto, movimento } from './test/fixture'

describe('scadenzaCanone', () => {
  it('il 10 del mese per default', () => {
    expect(scadenzaCanone(contratto(), '2026-03')).toBe('2026-03-10')
  })
  it("giorno 31 nei mesi più corti: ultimo giorno del mese", () => {
    const c = contratto({ giorno_scadenza: 31 })
    expect(scadenzaCanone(c, '2026-02')).toBe('2026-02-28')
    expect(scadenzaCanone(c, '2024-02')).toBe('2024-02-29')
    expect(scadenzaCanone(c, '2026-04')).toBe('2026-04-30')
    expect(scadenzaCanone(c, '2026-05')).toBe('2026-05-31')
  })
})

describe('canoneMensilePer', () => {
  const c = contratto()
  const a = annualita({ data_inizio: '2026-01-01', canone_mensile_precedente_cent: 100000, canone_mensile_nuovo_cent: 102000 })
  it("prima dell'annualità vale il canone precedente, dopo il nuovo", () => {
    expect(canoneMensilePer(c, [a], '2025-12').imponibile_cent).toBe(100000)
    expect(canoneMensilePer(c, [a], '2026-01').imponibile_cent).toBe(102000)
    expect(canoneMensilePer(c, [a], '2026-07').dal).toBe('2026-01')
  })
  it('con IVA calcola imposta e totale', () => {
    const k = canoneMensilePer(contratto({ regime_iva: 'con_iva', iva_percento: 22 }), [], '2026-01')
    expect(k.iva_cent).toBe(22000)
    expect(k.totale_cent).toBe(122000)
  })
})

describe('totaliAnnoContratto', () => {
  it('conta i mesi scaduti anche senza movimenti e quelli non incassati', () => {
    const c = contratto({ data_decorrenza: '2022-01-01' })
    const mov = [movimento({ competenza: '2026-01', incassato_cent: 100000, stato: 'incassato' })]
    const t = totaliAnnoContratto(c, [], mov, 2026, '2026-03-20')
    expect(t.dovuto).toBe(300000)
    expect(t.incassato).toBe(100000)
    expect(t.mesiNonIncassati).toEqual(['2026-02', '2026-03'])
  })
  it('si ferma alla cessazione del contratto', () => {
    const c = contratto({ data_cessazione: '2026-02-28', stato: 'cessato' })
    const t = totaliAnnoContratto(c, [], [], 2026, '2026-06-20')
    expect(t.mesiNonIncassati).toEqual(['2026-01', '2026-02'])
  })
})

describe('adeguaCanoniRegistrati', () => {
  it("porta al nuovo canone i mesi registrati con l'importo vecchio", () => {
    const a = annualita({ data_inizio: '2026-01-01', canone_mensile_nuovo_cent: 102000 })
    const mov = [
      movimento({ id: 'm1', competenza: '2026-01', incassato_cent: 100000, stato: 'incassato' }),
      movimento({ id: 'm2', competenza: '2026-02', imponibile_cent: 99000, dovuto_cent: 99000 }),
    ]
    const r = adeguaCanoniRegistrati(mov, a, [a], [100000], { modificato_il: 'x', modificato_da: 'Test' })
    expect(r.mesi).toEqual(['2026-01'])
    expect(r.record[0].dovuto_cent).toBe(102000)
    expect(r.record[0].stato).toBe('parziale')
    expect(r.record[1].imponibile_cent).toBe(99000) // importo inserito a mano: non toccato
  })
})
