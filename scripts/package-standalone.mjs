import { cp, mkdir } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"

const root = fileURLToPath(new URL("../", import.meta.url))
const app = path.join(root, "apps/web")
const destination = path.join(app, ".next/standalone/apps/web")
await mkdir(path.join(destination, ".next"), { recursive: true })
await cp(path.join(app, ".next/static"), path.join(destination, ".next/static"), { recursive: true })
await cp(path.join(app, "public"), path.join(destination, "public"), { recursive: true })
console.log("Standalone static and public assets packaged.")
