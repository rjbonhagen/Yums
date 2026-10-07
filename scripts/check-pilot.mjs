import { checkPilotConfig } from "./pilot-config.mjs"

const { errors, warnings } = checkPilotConfig(process.env)
for (const error of errors) console.error(`ERROR: ${error}`)
for (const warning of warnings) console.warn(`NOTICE: ${warning}`)
if (errors.length) {
  console.error("Pilot configuration check failed. No environment values were printed.")
  process.exitCode = 1
} else {
  console.log("Local pilot configuration checks passed.")
  console.log("This does not verify remote migrations, Auth settings, account isolation, email delivery, hosting, or live credentials.")
}
