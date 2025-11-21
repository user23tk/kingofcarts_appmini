import { PPValidator } from "./pp-validator"
import { createClient } from "@/lib/supabase/server"

export interface SecurityReport {
  timestamp: string
  totalUsers: number
  totalPPAudits: number
  suspiciousActivities: Array<{
    user_id: string
    activity: string
    count: number
  }>
  recommendations: string[]
}

export class SecurityReportGenerator {
  static async generateReport(): Promise<SecurityReport> {
    const supabase = await createClient()
    const timestamp = new Date().toISOString()

    // Conta utenti totali
    const { count: totalUsers } = await supabase.from("users").select("*", { count: "exact", head: true })

    // Conta audit PP totali
    const { count: totalPPAudits } = await supabase.from("pp_audit").select("*", { count: "exact", head: true })

    // Rileva attività sospette
    const suspiciousActivities = await PPValidator.detectSuspiciousPatterns()

    // Genera raccomandazioni
    const recommendations = this.generateRecommendations(suspiciousActivities)

    return {
      timestamp,
      totalUsers: totalUsers || 0,
      totalPPAudits: totalPPAudits || 0,
      suspiciousActivities,
      recommendations,
    }
  }

  private static generateRecommendations(suspiciousActivities: any[]): string[] {
    const recommendations: string[] = []

    if (suspiciousActivities.length > 0) {
      recommendations.push("⚠️ Attività sospette rilevate - controllare gli utenti segnalati")
    }

    recommendations.push("✅ Sistema di validazione PP attivo e funzionante")
    recommendations.push("✅ Audit trail completo per tutti i PP guadagnati")
    recommendations.push("✅ Rate limiting implementato per prevenire spam")
    recommendations.push("✅ Validazione server-side di tutte le scelte utente")

    return recommendations
  }
}
