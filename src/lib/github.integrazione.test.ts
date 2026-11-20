/**
 * Prova su GitHub VERO dei salvataggi "tutto o niente" (Git Data API), su un repository DI PROVA separato.
 * Non parte con `npm test`: serve `npm run prova-github` con le variabili GH_TOKEN_PROVA e GH_REPO_PROVA
 * (es. "GruppoCEC/gestione-immobili-prova"). Si rifiuta di girare sul repository dei dati reali.
 */
import { describe, expect, it, vi } from 'vitest'

const ambiente = (globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
const TOKEN = ambiente.GH_TOKEN_PROVA ?? ''
const [PROPRIETARIO, REPO] = (ambiente.GH_REPO_PROVA ?? '').split('/')
const ATTIVA = !!TOKEN && !!PROPRIETARIO && !!REPO
if (ATTIVA && /gestione-immobili-dati$/i.test(REPO)) throw new Error('STOP: questa prova va fatta su un repository di prova, non su quello dei dati reali.')

vi.mock('../config', () => ({
  CONFIG: { proprietario: PROPRIETARIO, repoDati: REPO, ramo: 'main', tokenCifrato: { versione: 2, iterazioni: 1, scadenza_token: null, utenti: { prova: {} } }, allegatoMaxByte: 25 * 1024 * 1024, allegatoAvvisoByte: 10 * 1024 * 1024, avvisoScadenzaTokenGiorni: 30 },
}))

describe.skipIf(!ATTIVA)('salvataggi su GitHub vero (repository di prova)', async () => {
  const gh = await import('./github')
  const st = await import('./store')
  const scheda = (id: string, x: Record<string, unknown> = {}) => ({ id, creato_il: '', creato_da: '', modificato_il: '', modificato_da: '', eliminato_il: null, ...x })
  const leggi = async (p: string) => JSON.parse((await gh.leggiFile(TOKEN, p))!.contenuto)

  it('accesso al repository di prova', async () => {
    expect(await gh.verificaAccesso(TOKEN)).toMatch(new RegExp(REPO, 'i'))
  })

  it('preparazione: collezioni vuote', async () => {
    st.svuotaCache()
    await st.aggiornaInsieme(TOKEN, [st.passo('societa', () => []), st.passo('contratti', () => []), st.passo('allegati', () => [])], 'Prova: azzera')
    expect(await leggi('dati/societa.json')).toEqual([])
  }, 60_000)

  it('due collezioni in UN commit, memoria allineata a GitHub', async () => {
    const prima = await gh.ultimoCommit(TOKEN)
    await st.aggiornaInsieme(TOKEN, [
      st.passo('societa', (r) => [...r, scheda('s1', { ragione_sociale: 'Alfa' })]),
      st.passo('contratti', (r, prec) => [...r, scheda('c1', { societa: prec.get('societa')!.length })]),
    ], 'Prova: società e contratto insieme')
    const dopo = await gh.ultimoCommit(TOKEN)
    const c = await gh.cambiamentiTra(TOKEN, prima, dopo)
    expect(c.messaggi).toEqual(['Prova: società e contratto insieme'])
    expect(c.file.map((f) => f.percorso).sort()).toEqual(['dati/contratti.json', 'dati/societa.json'])
    expect((await leggi('dati/contratti.json'))[0].societa).toBe(1)
    for (const n of ['societa', 'contratti'] as const) expect(st.shaInCache(n)).toBe((await gh.leggiFile(TOKEN, `dati/${n}.json`))!.sha)
  }, 60_000)

  it('se un collega salva nel frattempo il commit viene rifiutato (niente sovrascritture)', async () => {
    const base = await gh.testaRamo(TOKEN)
    const f = (await gh.leggiFile(TOKEN, 'dati/societa.json'))!
    await gh.scriviFile(TOKEN, 'dati/societa.json', JSON.stringify([...JSON.parse(f.contenuto), scheda('s2', { ragione_sociale: 'Beta (collega)' })], null, 2) + '\n', 'Prova: salvataggio del collega', f.sha)
    await expect(gh.scriviCommit(TOKEN, base, [{ percorso: 'dati/contratti.json', testo: '[]\n' }], 'Prova: commit vecchio')).rejects.toMatchObject({ conflitto: true })
    // aggiornaInsieme rilegge e riprova: restano sia il collega sia la nuova modifica
    st.svuotaCache()
    await st.aggiornaInsieme(TOKEN, [st.passo('societa', (r) => [...r, scheda('s3', { ragione_sociale: 'Gamma' })])], 'Prova: dopo il collega')
    expect((await leggi('dati/societa.json')).map((x: { id: string }) => x.id)).toEqual(['s1', 's2', 's3'])
  }, 60_000)

  it('allegato (file binario) e registrazione insieme; eliminazione anche di un file già assente', async () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0xff, 0x00, 0x10])
    await st.aggiornaInsieme(TOKEN, [st.passo('allegati', (r) => [...r, scheda('a1', { percorso: 'allegati/prova/x.pdf' })])], 'Prova: allegato',
      [{ percorso: 'allegati/prova/x.pdf', binario: new Blob([pdf], { type: 'application/pdf' }) }])
    expect(new Uint8Array(await (await gh.scaricaAllegato(TOKEN, 'allegati/prova/x.pdf')).arrayBuffer())).toEqual(pdf)
    const { esito } = await st.aggiornaInsieme(TOKEN, [st.passo('allegati', (r) => r.map((x) => ({ ...x, eliminato_il: 'oggi' })))], 'Prova: elimina allegati',
      [{ percorso: 'allegati/prova/x.pdf', elimina: true }, { percorso: 'allegati/prova/manca.pdf', elimina: true }])
    expect(esito.mancanti).toEqual(['allegati/prova/manca.pdf'])
    await expect(gh.scaricaAllegato(TOKEN, 'allegati/prova/x.pdf')).rejects.toMatchObject({ stato: 404 })
  }, 90_000)
})
