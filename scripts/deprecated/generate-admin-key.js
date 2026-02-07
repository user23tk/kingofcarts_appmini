// Script per generare una chiave admin sicura
// Esegui con: node scripts/generate-admin-key.js

const crypto = require("crypto")

function generateSecureAdminKey() {
  // Genera una chiave di 32 caratteri alfanumerici
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let result = ""

  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  return result
}

const adminKey = generateSecureAdminKey()

console.log("=".repeat(60))
console.log("🔐 TELEGRAM BOT CONFIGURATION")
console.log("=".repeat(60))
console.log("")
console.log("Aggiungi queste variabili d'ambiente al tuo progetto:")
console.log("")
console.log(`DEBUG_ADMIN_KEY=${adminKey}`)
console.log("DISABLE_RATE_LIMITS=false")
console.log("")
console.log("📋 ISTRUZIONI:")
console.log("")
console.log("1. DEBUG_ADMIN_KEY: Chiave per accedere alla dashboard /debug")
console.log('2. DISABLE_RATE_LIMITS: Imposta su "true" per disattivare i rate limits durante i test')
console.log("")
console.log("⚠️  SICUREZZA:")
console.log("- Mantieni la DEBUG_ADMIN_KEY segreta")
console.log("- Usa DISABLE_RATE_LIMITS=true solo per test")
console.log("- In produzione, mantieni DISABLE_RATE_LIMITS=false")
console.log("")
console.log("=".repeat(60))
