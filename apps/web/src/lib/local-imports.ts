export function localImportsEnabled(env: { YUMS_ENABLE_LOCAL_IMPORTS?: string; APP_ORIGIN?: string } = {
  YUMS_ENABLE_LOCAL_IMPORTS: process.env.YUMS_ENABLE_LOCAL_IMPORTS,
  APP_ORIGIN: process.env.APP_ORIGIN,
}): boolean {
  if (env.YUMS_ENABLE_LOCAL_IMPORTS !== "true" || !env.APP_ORIGIN) return false
  try {
    const origin = new URL(env.APP_ORIGIN)
    return origin.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
      && !origin.username && !origin.password && !origin.search && !origin.hash && origin.pathname === "/"
  } catch { return false }
}
