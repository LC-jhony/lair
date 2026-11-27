import { describe, expect, it } from 'vitest'
import { browserUrl } from '../../src/lib/site-url'

describe('browserUrl', () => {
  it('usa el host virtual con el puerto HTTP', () => {
    expect(browserUrl('acme.test', false)).toBe('http://acme.test:8080')
  })

  it('usa el alias localhost con el puerto HTTPS', () => {
    expect(browserUrl('acme.localhost', true)).toBe('https://acme.localhost:8443')
  })

  it('omite el puerto cuando Caddy usa 80/443', () => {
    expect(browserUrl('acme.test', false, true)).toBe('http://acme.test')
    expect(browserUrl('acme.test', true, true)).toBe('https://acme.test')
  })
})
