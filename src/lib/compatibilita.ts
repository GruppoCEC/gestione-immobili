/**
 * Compatibilità con i browser datati (Chrome 109, l'ultimo per Windows 7).
 *
 * La libreria che legge i PDF (pdfjs) usa alcune funzioni JavaScript arrivate dopo Chrome 109 e non le aggiunge da sola.
 * Qui vengono aggiunte SOLO se il browser non le ha già (sui browser recenti non cambia nulla).
 * Verificato con la simulazione descritta in docs/LIMITI_E_BACKUP.md (sezione "Browser supportati").
 */

/** Vero se il browser è datato (manca Promise.withResolvers, Chrome < 119): letto PRIMA di aggiungere le funzioni. */
export const browserDatato = typeof (Promise as unknown as { withResolvers?: unknown }).withResolvers !== 'function'

type Qualsiasi = any // eslint-disable-line @typescript-eslint/no-explicit-any

/** Aggiunge una funzione a un oggetto solo se manca (non enumerabile, come quelle originali). */
function aggiungi(obj: Qualsiasi, nome: string, valore: unknown): void {
  if (obj && typeof obj[nome] === 'undefined') {
    Object.defineProperty(obj, nome, { value: valore, writable: true, configurable: true, enumerable: false })
  }
}

aggiungi(Promise, 'withResolvers', function withResolvers(this: PromiseConstructor) {
  let resolve!: (v: unknown) => void, reject!: (e: unknown) => void
  const promise = new this((ok, ko) => { resolve = ok; reject = ko })
  return { promise, resolve, reject }
})
aggiungi(Promise, 'try', function provaPromise(this: PromiseConstructor, fn: (...a: unknown[]) => unknown, ...args: unknown[]) {
  return new this((ok) => ok(fn(...args)))
})

aggiungi(URL, 'parse', (url: string, base?: string) => { try { return new URL(url, base) } catch { return null } })

aggiungi(Math, 'sumPrecise', (valori: Iterable<number>) => { let s = -0; for (const v of valori) s += v; return s })

// Base64 / esadecimale su Uint8Array
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
aggiungi(Uint8Array, 'fromBase64', (testo: string, opzioni?: { alphabet?: string }) => {
  let t = testo.replace(/\s/g, '')
  if (opzioni?.alphabet === 'base64url') t = t.replace(/-/g, '+').replace(/_/g, '/')
  while (t.length % 4) t += '='
  const bin = atob(t)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
})
aggiungi(Uint8Array.prototype, 'toBase64', function toBase64(this: Uint8Array, opzioni?: { alphabet?: string; omitPadding?: boolean }) {
  let s = ''
  for (let i = 0; i < this.length; i += 3) {
    const n = (this[i] << 16) | ((this[i + 1] ?? 0) << 8) | (this[i + 2] ?? 0)
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < this.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < this.length ? B64[n & 63] : '=')
  }
  if (opzioni?.alphabet === 'base64url') s = s.replace(/\+/g, '-').replace(/\//g, '_')
  return opzioni?.omitPadding ? s.replace(/=+$/, '') : s
})
aggiungi(Uint8Array.prototype, 'toHex', function toHex(this: Uint8Array) {
  let s = ''
  for (let i = 0; i < this.length; i++) s += this[i].toString(16).padStart(2, '0')
  return s
})
aggiungi(Uint8Array, 'fromHex', (testo: string) => {
  const out = new Uint8Array(testo.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(testo.substr(i * 2, 2), 16)
  return out
})

// Operazioni sugli insiemi
aggiungi(Set.prototype, 'union', function union(this: Set<unknown>, altro: Iterable<unknown> & { keys?: () => Iterable<unknown> }) {
  const r = new Set(this); for (const x of (altro.keys ? altro.keys() : altro)) r.add(x); return r
})
aggiungi(Set.prototype, 'intersection', function intersection(this: Set<unknown>, altro: { has: (x: unknown) => boolean }) {
  const r = new Set(); for (const x of this) if (altro.has(x)) r.add(x); return r
})
aggiungi(Set.prototype, 'difference', function difference(this: Set<unknown>, altro: { has: (x: unknown) => boolean }) {
  const r = new Set(); for (const x of this) if (!altro.has(x)) r.add(x); return r
})

// ArrayBuffer.transfer: copia (il buffer originale resta utilizzabile, differenza ininfluente per la lettura dei PDF)
function trasferisci(this: ArrayBuffer, lunghezza?: number): ArrayBuffer {
  const n = lunghezza ?? this.byteLength
  const nuovo = new ArrayBuffer(n)
  new Uint8Array(nuovo).set(new Uint8Array(this, 0, Math.min(n, this.byteLength)))
  return nuovo
}
aggiungi(ArrayBuffer.prototype, 'transfer', trasferisci)
aggiungi(ArrayBuffer.prototype, 'transferToFixedLength', trasferisci)
