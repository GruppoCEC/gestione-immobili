import { describe, expect, it } from 'vitest'
import { descriviErrore } from './github'
import { modoApertura } from './allegati'

describe('messaggi di errore di GitHub', () => {
  it('conflitto vero solo con 409 o 422 sullo SHA', () => {
    expect(descriviErrore(409).conflitto).toBe(true)
    expect(descriviErrore(422, 'sha wasn\'t supplied').conflitto).toBe(true)
    const r = descriviErrore(422, 'Invalid request: content too large')
    expect(r.conflitto).toBe(false)
    expect(r.messaggio).toMatch(/rifiutato/)
  })
  it('troppe richieste: indica l\'orario', () => {
    const reset = Math.floor(new Date(2026, 10, 20, 15, 42).getTime() / 1000)
    const h = new Headers({ 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset) })
    expect(descriviErrore(403, 'API rate limit exceeded', h).messaggio).toMatch(/dopo le 15:42/)
    expect(descriviErrore(429).messaggio).toMatch(/Troppe richieste/)
  })
  it('permessi, server non disponibile, niente inglese nel messaggio', () => {
    expect(descriviErrore(403, 'Resource not accessible by personal access token').messaggio).toMatch(/permessi/)
    expect(descriviErrore(503, 'Service Unavailable').messaggio).toMatch(/non risponde/)
    expect(descriviErrore(418, 'I\'m a teapot').messaggio).not.toMatch(/teapot/)
  })
})

describe('apertura degli allegati', () => {
  it('PDF e immagini si aprono', () => {
    expect(modoApertura('application/pdf', 'contratto.pdf')).toEqual({ apri: true, tipo: 'application/pdf' })
    expect(modoApertura('', 'foto.JPG')).toEqual({ apri: true, tipo: 'image/jpeg' })
  })
  it('tutto il resto si scarica, anche se il tipo dichiarato dice altro', () => {
    expect(modoApertura('text/html', 'pagina.html').apri).toBe(false)
    expect(modoApertura('image/svg+xml', 'logo.svg').apri).toBe(false)
    expect(modoApertura('application/pdf', 'trucco.html').apri).toBe(false)
    expect(modoApertura('text/html', 'finto.pdf').apri).toBe(false)
    expect(modoApertura('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'lettera.docx')).toEqual({ apri: false, tipo: 'application/octet-stream' })
  })
})
