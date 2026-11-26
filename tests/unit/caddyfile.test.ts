import { describe, expect, it } from 'vitest'
import { generateCaddyfile } from '../../src/lib/caddyfile'

describe('generateCaddyfile', () => {
  it('genera TLS interno y fastcgi para PHP', () => {
    const config = generateCaddyfile({
      id: '1',
      name: 'myapp',
      root: '/srv/myapp',
      kind: 'php',
      domains: ['myapp.test'],
      phpVersion: '8.4',
      tlsInternal: true,
    })
    expect(config).toContain('myapp.test {')
    expect(config).toContain('tls internal')
    expect(config).toContain('root * /srv/myapp')
    expect(config).toContain('php_fastcgi unix//run/php/php8.4-fpm.sock')
  })

  it('genera reverse proxy para Node', () => {
    const config = generateCaddyfile({
      id: '2',
      name: 'api',
      root: '/srv/api',
      kind: 'node',
      domains: ['api.test'],
      tlsInternal: false,
    })
    expect(config).toContain('reverse_proxy 127.0.0.1:3000')
    expect(config).toContain('X-Forwarded-Proto {scheme}')
    expect(config).not.toContain('tls internal')
  })
})
