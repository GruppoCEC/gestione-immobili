import { beforeEach, describe, expect, it } from 'vitest'

// localStorage finto (in Node non esiste): la modalità prova salva lì
const memoria = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => memoria.get(k) ?? null, setItem: (k: string, v: string) => void memoria.set(k, String(v)),
  removeItem: (k: string) => void memoria.delete(k), clear: () => memoria.clear(), key: (i: number) => [...memoria.keys()][i] ?? null,
  get length() { return memoria.size },
} as Storage

const { shaGit, TOKEN_DEMO } = await import('./github')
const { aggiornaInsieme, passo, svuotaCache } = await import('./store')
const { controllaBackup } = await import('./backup')

const P = 'gestione-immobili.demo.'
const scheda = (id: string, x: Record<string, unknown> = {}) => ({ id, creato_il: '', creato_da: '', modificato_il: '', modificato_da: '', eliminato_il: null, ...x })

describe('impronta dei file come GitHub', () => {
  it('SHA-1 git di "hello\\n"', async () => {
    expect(await shaGit(new TextEncoder().encode('hello\n'))).toBe('ce013625030ba8dba906f756967f9e9ca394464a')
  })
})

describe('salvataggio di più collezioni in un colpo solo (modalità prova)', () => {
  beforeEach(() => { memoria.clear(); svuotaCache() })
  it('scrive tutte le collezioni cambiate con un solo salvataggio e passa i risultati ai passi successivi', async () => {
    memoria.set(P + 'dati/annualita.json', JSON.stringify([scheda('a1', { anno: 2025 })]))
    memoria.set(P + 'dati/contratti.json', JSON.stringify([scheda('c1', { canone: 100 })]))
    memoria.set(P + 'dati/movimenti.json', JSON.stringify([scheda('m1')]))
    let vistoDalSecondo = 0
    await aggiornaInsieme(TOKEN_DEMO, [
      passo('annualita', (r) => [...r, scheda('a2', { anno: 2026 })]),
      passo('contratti', (r, prec) => { vistoDalSecondo = prec.get('annualita')!.length; return r.map((c) => ({ ...c, canone: 102 })) }),
      passo('movimenti', (r) => r), // nessun cambiamento: non viene scritto
    ], 'Prova: annualità e canone')
    expect(vistoDalSecondo).toBe(2)
    expect(JSON.parse(memoria.get(P + 'dati/annualita.json')!)).toHaveLength(2)
    expect(JSON.parse(memoria.get(P + 'dati/contratti.json')!)[0].canone).toBe(102)
    const commits = JSON.parse(memoria.get(P + '_commits')!)
    expect(commits).toHaveLength(1)
    expect(commits[0].percorsi).toEqual(['dati/annualita.json', 'dati/contratti.json'])
  })
  it('allegato: file e registrazione insieme; eliminazione di un file assente segnalata', async () => {
    memoria.set(P + 'dati/allegati.json', '[]')
    const { esito } = await aggiornaInsieme(TOKEN_DEMO, [passo('allegati', (r) => [...r, scheda('al1')])], 'Prova: allegato',
      [{ percorso: 'allegati/2026/x.pdf', binario: new Blob(['%PDF'], { type: 'application/pdf' }) }, { percorso: 'allegati/2026/manca.pdf', elimina: true }])
    expect(memoria.get(P + 'allegati/2026/x.pdf')).toMatch(/^data:application\/pdf;base64,/)
    expect(esito.mancanti).toEqual(['allegati/2026/manca.pdf'])
  })
})

describe('controllo del backup prima del ripristino', () => {
  const valido = { versione: 1, creato_il: '2026-11-01T10:00:00Z', creato_da: 'Davide', collezioni: { societa: [scheda('s1')], contratti: [scheda('c1'), scheda('c2')], vecchia: [] } }
  it('file valido: riepilogo e avvisi', () => {
    const c = controllaBackup(JSON.stringify(valido))
    expect(c.righe.map((r) => [r.nome, r.nelBackup])).toEqual([['societa', 1], ['contratti', 2]])
    expect(c.avvisi.some((a) => a.includes('"vecchia"'))).toBe(true)
    expect(c.avvisi.some((a) => a.includes('"immobili" non è nel backup'))).toBe(true)
  })
  it('file rovinati: errore e nessuna scrittura', () => {
    expect(() => controllaBackup('non json')).toThrow(/JSON/)
    expect(() => controllaBackup(JSON.stringify({ versione: 2, collezioni: {} }))).toThrow(/backup valido/)
    expect(() => controllaBackup(JSON.stringify({ ...valido, collezioni: { societa: {} } }))).toThrow(/non è un elenco/)
    expect(() => controllaBackup(JSON.stringify({ ...valido, collezioni: { societa: [{ nome: 'x' }] } }))).toThrow(/scheda n. 1/)
    expect(() => controllaBackup(JSON.stringify({ ...valido, collezioni: { societa: [scheda('s1'), scheda('s1')] } }))).toThrow(/ripetute/)
  })
})
