function isLoopback(hostname: string) {
  return ["localhost", "127.0.0.1", "[::1]"].includes(hostname)
}

export function authRedirectOrigin(request: Request): string {
  if (process.env.APP_ORIGIN) {
    const configured = new URL(process.env.APP_ORIGIN)
    if (configured.username || configured.password || configured.search || configured.hash || configured.pathname !== "/"
      || !(configured.protocol === "https:" || (configured.protocol === "http:" && isLoopback(configured.hostname)))
      || configured.hostname === "0.0.0.0") throw new Error("Invalid APP_ORIGIN")
    return configured.origin
  }
  const url = new URL(request.url)
  if (isLoopback(url.hostname)) return url.origin
  const host = request.headers.get("host")
  if (host && !/[\s/@?#\\]/.test(host)) {
    const local = new URL(`${url.protocol}//${host}`)
    if (isLoopback(local.hostname) && local.port === url.port) return local.origin
  }
  throw new Error("Configure APP_ORIGIN for hosted sign-in")
}
