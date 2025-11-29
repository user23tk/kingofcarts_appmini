import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export interface PPValidationResult {
  isValid: boolean
  reason?: string
  auditData?: {
    user_id: string
    theme: string
    chapter_number: number
    scene_index: number
    choice_id: string
    pp_gained: number
    session_total_pp: number
  }
}

export class PPValidator {
  private static readonly VALID_PP_VALUES = [3, 4, 5, 6] // Valori PP consentiti dal schema
  private static readonly MAX_PP_PER_SCENE = 6
  private static readonly MAX_PP_PER_CHAPTER = 8 * 6 // 8 scene max * 6 PP max
  private static readonly MAX_PP_PER_HOUR = 100 // Limite anti-spam
  private static readonly MAX_PP_PER_DAY = 500 // Limite giornaliero

  /**
   * Valida i PP guadagnati da una scelta specifica
   */
  static validateChoice(
    sceneChoices: Array<{ id: string; pp_delta: number }>,
    choiceId: string,
    ppGained: number,
  ): PPValidationResult {
    // Verifica che il valore PP sia nei range consentiti
    if (!this.VALID_PP_VALUES.includes(ppGained)) {
      return {
        isValid: false,
        reason: `PP value ${ppGained} not in allowed range [${this.VALID_PP_VALUES.join(", ")}]`,
      }
    }

    // Verifica che la scelta esista e abbia il PP corretto
    const validChoice = sceneChoices.find((c) => c.id === choiceId && c.pp_delta === ppGained)
    if (!validChoice) {
      return {
        isValid: false,
        reason: `Choice ${choiceId} with PP ${ppGained} not found in scene choices`,
      }
    }

    return { isValid: true }
  }

  /**
   * Valida i PP totali di un capitolo completato
   */
  static validateChapterCompletion(ppGained: number): PPValidationResult {
    if (ppGained < 0) {
      return {
        isValid: false,
        reason: "Negative PP gain not allowed",
      }
    }

    if (ppGained > this.MAX_PP_PER_CHAPTER) {
      return {
        isValid: false,
        reason: `PP gain ${ppGained} exceeds maximum allowed per chapter (${this.MAX_PP_PER_CHAPTER})`,
      }
    }

    return { isValid: true }
  }

  /**
   * Verifica i limiti temporali per prevenire spam
   */
  static async validateRateLimits(userId: string, ppGained: number): Promise<PPValidationResult> {
    const supabase = await createClient()

    try {
      // Verifica PP guadagnati nell'ultima ora
      const { data: hourlyData } = await supabase
        .from("pp_audit")
        .select("pp_gained")
        .eq("user_id", userId)
        .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())

      const hourlyPP = hourlyData?.reduce((sum, record) => sum + record.pp_gained, 0) || 0

      if (hourlyPP + ppGained > this.MAX_PP_PER_HOUR) {
        return {
          isValid: false,
          reason: `Hourly PP limit exceeded: ${hourlyPP + ppGained}/${this.MAX_PP_PER_HOUR}`,
        }
      }

      // Verifica PP guadagnati nelle ultime 24 ore
      const { data: dailyData } = await supabase
        .from("pp_audit")
        .select("pp_gained")
        .eq("user_id", userId)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

      const dailyPP = dailyData?.reduce((sum, record) => sum + record.pp_gained, 0) || 0

      if (dailyPP + ppGained > this.MAX_PP_PER_DAY) {
        return {
          isValid: false,
          reason: `Daily PP limit exceeded: ${dailyPP + ppGained}/${this.MAX_PP_PER_DAY}`,
        }
      }

      return { isValid: true }
    } catch (error) {
      console.error("[SECURITY] Error checking PP rate limits:", error)
      return {
        isValid: false,
        reason: "Rate limit check failed",
      }
    }
  }

  /**
   * Registra l'audit trail per i PP guadagnati
   */
  static async auditPPGain(auditData: {
    user_id: string
    theme: string
    chapter_number: number
    scene_index: number
    choice_id: string
    pp_gained: number
    session_total_pp: number
    user_agent?: string
    ip_address?: string
  }): Promise<void> {
    const supabase = createAdminClient()

    try {
      const { error } = await supabase.from("pp_audit").insert({
        user_id: auditData.user_id,
        theme: auditData.theme,
        chapter_number: auditData.chapter_number,
        scene_index: auditData.scene_index,
        choice_id: auditData.choice_id,
        pp_gained: auditData.pp_gained,
        session_total_pp: auditData.session_total_pp,
        user_agent: auditData.user_agent,
        ip_address: auditData.ip_address,
      })

      if (error) {
        console.error("[AUDIT] Failed to insert PP audit record:", error)
        throw error
      }

      console.log(`[AUDIT] PP gain recorded: User ${auditData.user_id} gained ${auditData.pp_gained} PP`)
    } catch (error) {
      console.error("[AUDIT] Failed to record PP gain:", error)
      throw error
    }
  }

  /**
   * Rileva pattern sospetti nei PP
   */
  static async detectSuspiciousPatterns(): Promise<
    Array<{
      user_id: string
      suspicious_activity: string
      count: number
    }>
  > {
    const supabase = await createClient()

    try {
      const { data } = await supabase.rpc("detect_suspicious_pp_patterns")
      return data || []
    } catch (error) {
      console.error("[SECURITY] Error detecting suspicious patterns:", error)
      return []
    }
  }
}
