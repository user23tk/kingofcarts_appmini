const fs = require("fs")
const path = require("path")

// List of files identified as unused or legacy in the audit
const filesToDelete = [
  "scripts/generate-admin-key.js",
  "scripts/migrate-progress.js",
  "lib/theme-colors.ts", // Moved to DB themes table
  "app/api/health/route.ts", // Will be replaced by robust health check
]

console.log("Cleaning up unused files...")

filesToDelete.forEach((file) => {
  try {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file)
      console.log(`Deleted: ${file}`)
    }
  } catch (e) {
    console.error(`Error deleting ${file}:`, e)
  }
})

console.log("Cleanup complete.")
