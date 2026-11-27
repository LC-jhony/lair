import type { Site } from './types'

/**
 * Espejo del generador del proceso principal, para previsualización.
 * El archivo que se carga en Caddy lo genera el backend con detección real
 * de `public/index.php` y de la ruta del socket PHP-FPM.
 */
export function generateCaddyfile(site: Site): string {
  const domain = site.domains[0] ?? `${site.name}.test`
  const httpAddresses = [`http://${domain}`, 'http://localhost']
  const httpsAddresses = site.tlsInternal ? [domain, 'localhost'] : []
  return [
    ...httpAddresses.map((address) => block(site, address, false)),
    ...httpsAddresses.map((address) => block(site, address, true)),
  ].join('\n')
}

function block(site: Site, address: string, tls: boolean): string {
  const root = site.kind === 'php' ? `${site.root.replace(/\/$/, '')}/public` : site.root
  let config = `${address} {\n`
  if (tls) config += '    tls internal\n'
  config += `    root * ${root}\n`
  config += '    encode gzip zstd\n'
  config += '    @dotfiles path /.*\n    respond @dotfiles 404\n'

  if (site.kind === 'php') {
    config += '    php_fastcgi unix//home/jhony/.local/share/lair/run/php-fpm.sock\n'
    config += '    file_server\n'
  } else if (site.kind === 'node') {
    config += '    reverse_proxy 127.0.0.1:3000 {\n'
    config += '        header_up X-Forwarded-Proto {scheme}\n    }\n'
  } else {
    config += '    try_files {path} {path}/ /index.html\n    file_server\n'
  }

  return `${config}}\n`
}
