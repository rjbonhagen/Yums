/** Only complete web links without embedded credentials may reach listings.
 * A source-specific base may resolve a publisher's relative event link. */
export function normalizeSourceUrl(value: unknown, base?: string): string | undefined {
  if (typeof value !== "string" || !value.trim() || value.length > 2048 || /[\u0000-\u001f\u007f]/.test(value)) return undefined
  try {
    const url = new URL(value, base)
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return undefined
    return url.href
  } catch { return undefined }
}
