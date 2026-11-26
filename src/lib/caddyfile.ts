import type { Site } from './types'

/** Renderer-side mirror of `caddy::generate_caddyfile` for preview/reload. */
export function generateCaddyfile(site: Site): string {
  const domain = site.domains[0] ?? `${site.name}.test`
  // `http://` evita la redirección automática HTTP→HTTPS en sitios sin certificado.
  const address = site.tlsInternal ? domain : `http://${domain}`
  let config = `${address} {\n`
  if (site.tlsInternal) config += '    tls internal\n'
  config += `    root * ${site.root}\n`
  config += '    encode gzip zstd\n'
  config += '    @dotfiles path /.*\n    respond @dotfiles 404\n'

  if (site.kind === 'php') {
    const version = site.phpVersion ?? '8.3'
    config += `    php_fastcgi unix//run/php/php${version}-fpm.sock\n    file_server\n`
  } else if (site.kind === 'node') {
    config += '    reverse_proxy 127.0.0.1:3000 {\n'
    config += '        header_up X-Forwarded-Proto {scheme}\n    }\n'
  } else {
    config += '    try_files {path} {path}/ /index.html\n    file_server\n'
  }

  return `${config}}\n`
}
