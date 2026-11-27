/** Puertos no privilegiados que usa el Caddyfile generado por Lair. */
export const LAIR_HTTP_PORT = 8080
export const LAIR_HTTPS_PORT = 8443

/**
 * URL abrible en el navegador. Usa el dominio virtual si resuelve; si no,
 * cae al alias `*.localhost`, que el navegador resuelve a 127.0.0.1.
 */
export function browserUrl(host: string, tlsInternal: boolean): string {
  return `${tlsInternal ? 'https' : 'http'}://${host}:${
    tlsInternal ? LAIR_HTTPS_PORT : LAIR_HTTP_PORT
  }`
}
