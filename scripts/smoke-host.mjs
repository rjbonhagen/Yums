const target = new URL(process.argv[2] || "http://localhost:3000")
if (!["http:", "https:"].includes(target.protocol) || target.username || target.password || target.pathname !== "/" || target.search || target.hash) {
  throw new Error("Provide an http/https host origin without credentials, path, or query.")
}
async function request(path) {
  const response = await fetch(new URL(path, target), { redirect: "error", signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
  return response
}
const health = await request("/api/health")
if ((await health.json()).status !== "ok" || health.headers.get("cache-control") !== "no-store") {
  throw new Error("Health response or cache headers are incorrect.")
}
const login = await request("/login")
const html = await login.text()
if (!html.includes("<html")) throw new Error("Login did not return HTML.")
const asset = html.match(/(?:src|href)="(\/_next\/static\/[^"?]+)(?:\?[^\"]*)?"/)
if (!asset) throw new Error("Login has no packaged static asset.")
const staticResponse = await request(asset[1])
if (!(await staticResponse.text()).length) throw new Error("Static asset is empty.")
console.log("Health, login HTML, and a referenced static asset passed.")
console.log("This does not verify signed-in flows, account isolation, live sources, or remote configuration.")
