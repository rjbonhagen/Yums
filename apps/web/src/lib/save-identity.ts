export function savedKey(item: { kind: string; title: string; sourceUrl?: string; startTime?: string; latitude?: number; longitude?: number; isSample?: boolean }): string {
  const source = item.sourceUrl || `${item.title}::${item.latitude ?? ""},${item.longitude ?? ""}`
  const time = !item.isSample && item.startTime ? new Date(item.startTime).toISOString() : ""
  return `${item.kind}::${source}::${time}`
}
