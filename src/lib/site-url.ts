/** Puertos no privilegiados que usa el Caddyfile generado por Lair. */
export const LAIR_HTTP_PORT = 8080
export const LAIR_HTTPS_PORT = 8443

/** URL abrible en el navegador: usa localhost porque `.test` no resuelve sin /etc/hosts. */
export function browserUrl(tlsInternal: boolean): string {
  return `${tlsInternal ? 'https' : 'http'}://localhost:${
    tlsInternal ? LAIR_HTTPS_PORT : LAIR_HTTP_PORT
  }`
}
