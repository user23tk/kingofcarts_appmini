# 📊 Leaderboard Implementation - PP-First Algorithm

**Last Updated**: 24 Novembre 2024  
**Status**: ✅ IMPLEMENTED

---

## 🎯 Overview

Il sistema di classifica di King of Carts è stato aggiornato per utilizzare i **Power Points (PP) come metrica principale** di ranking. Questo documento descrive l'implementazione completa del nuovo algoritmo.

---

## 🔢 Algoritmo di Ranking (PP-FIRST)

### Ordine di Priorità

\`\`\`sql
ORDER BY
  total_pp DESC,           -- 1️⃣ PRIORITÀ PRIMARIA
  themes_completed DESC,   -- 2️⃣ Tie-breaker secondario
  chapters_completed DESC  -- 3️⃣ Tie-breaker terziario
\`\`\`

### Regole di Inclusione

- ✅ Solo utenti con `total_pp > 0` sono inclusi nella classifica
- ❌ Utenti con 0 PP hanno `rank = 0` (non classificati)
- 🎯 La metrica principale è il **totale dei Power Points guadagnati**

---

## 📁 File Modificati

### 1. Database (Supabase)

#### **scripts/040_leaderboard_pp_first.sql** (NEW)
\`\`\`sql
-- Migration che implementa il nuovo algoritmo PP-first
-- Aggiorna get_user_rank(), get_top_players(), get_leaderboard_stats()
-- Crea indici ottimizzati per performance
\`\`\`

**Funzioni RPC aggiornate**:
- `get_user_rank(p_user_id UUID)` - Calcola rank PP-first
- `get_top_players(p_limit INTEGER)` - Top N giocatori PP-first
- `get_leaderboard_stats()` - Statistiche globali (top_score = max PP)

### 2. Backend (TypeScript)

#### **lib/leaderboard/leaderboard-manager.tsx** (UPDATED)
\`\`\`typescript
export class LeaderboardManager {
  // Metodi centralizzati per gestire la classifica
  static async getTopPlayers(limit = 100)
  static async getUserRank(userId: string)
  static async getUserStats(userId: string)  // NEW
  static async getLeaderboardStats()
}
\`\`\`

**Cosa è cambiato**:
- ✅ Aggiunto metodo `getUserStats()` per statistiche complete
- ✅ Documentazione inline sull'algoritmo PP-first
- ✅ Commenti chiari sui valori di ritorno (rank=0 se no PP)
- ✅ Aggiornato `formatLeaderboardMessage()` per enfatizzare PP

#### **app/api/miniapp/dashboard/route.ts** (UPDATED)
\`\`\`typescript
// Prima: Chiamata RPC diretta
const { data: rankData } = await supabase.rpc("get_user_rank", { p_user_id: userId })

// Dopo: Usa LeaderboardManager centralizzato
const rankData = await LeaderboardManager.getUserRank(userId)
\`\`\`

**Cosa è cambiato**:
- ✅ Usa `LeaderboardManager.getUserRank()` invece di RPC diretta
- ✅ Rimossi riferimenti a campi duplicati (`total_chapters_completed`)
- ✅ Usa solo `chapters_completed`, `themes_completed`, `total_pp`

#### **app/api/miniapp/profile/route.ts** (UPDATED)
- ✅ Stesse modifiche del dashboard
- ✅ Centralizzata la logica di ranking

#### **app/api/miniapp/leaderboard/route.ts** (ALREADY CORRECT)
- ✅ Già usava `LeaderboardManager` correttamente

### 3. Frontend (React/Next.js)

#### **app/(miniapp)/page.tsx** (ALREADY CORRECT)
\`\`\`tsx
<Badge variant="secondary">
  <Sparkles className="w-3 h-3 mr-1" />
  {dashboardData.user.totalPP} PP
</Badge>
\`\`\`

**UI corretta**:
- ✅ PP mostrati prominentemente nel badge utente
- ✅ Rank mostrato come "Rank #N" o "Non classificato"
- ✅ Card "Total PP" con icona TrendingUp

#### **app/(miniapp)/leaderboard/page.tsx** (ALREADY CORRECT)
\`\`\`tsx
<p className="text-xs text-[#FFD700]">
  {entry.totalPP} PP
</p>
\`\`\`

**UI corretta**:
- ✅ PP mostrati per ogni voce della classifica
- ✅ Tab "Generale" e "Contest" separate
- ✅ Podio (top 3) con enfasi sui PP

---

## 🗄️ Schema Database

### Tabella `user_progress`

\`\`\`sql
CREATE TABLE user_progress (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  
  -- ✅ Campi consolidati (usare questi)
  total_pp INTEGER DEFAULT 0,              -- METRICA PRINCIPALE
  chapters_completed INTEGER DEFAULT 0,    -- Tie-breaker terziario
  themes_completed INTEGER DEFAULT 0,      -- Tie-breaker secondario
  
  -- ⚠️ Campi legacy (da deprecare)
  total_chapters_completed INTEGER,  -- Duplicato di chapters_completed
  completed_themes TEXT[],           -- Duplicato di themes_completed
  
  -- Altri campi
  current_theme TEXT,
  current_chapter INTEGER,
  theme_progress JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
\`\`\`

### Indice Ottimizzato

\`\`\`sql
CREATE INDEX idx_user_progress_pp_ranking 
ON user_progress(total_pp DESC, themes_completed DESC, chapters_completed DESC)
WHERE total_pp > 0;
\`\`\`

---

## 🔧 Come Usare il Sistema

### 1. Ottenere la Classifica Completa

\`\`\`typescript
import { LeaderboardManager } from "@/lib/leaderboard/leaderboard-manager"

const topPlayers = await LeaderboardManager.getTopPlayers(100)
// Returns: Array<{ userId, username, totalScore (=PP), rank, ... }>
\`\`\`

### 2. Ottenere il Rank di un Utente

\`\`\`typescript
const userRank = await LeaderboardManager.getUserRank(userId)
// Returns: { rank: number, totalPlayers: number } | null
// rank = 0 se l'utente ha 0 PP
\`\`\`

### 3. Ottenere Statistiche Complete di un Utente

\`\`\`typescript
const userStats = await LeaderboardManager.getUserStats(userId)
// Returns: { userId, totalPp, chaptersCompleted, themesCompleted, rank, totalPlayers }
\`\`\`

### 4. Ottenere Statistiche Globali

\`\`\`typescript
const stats = await LeaderboardManager.getLeaderboardStats()
// Returns: { totalPlayers, averageChapters, topScore (=max PP), completionRate }
\`\`\`

---

## ⚠️ Breaking Changes

### Prima dell'Update

\`\`\`typescript
// Rank basato su capitoli/temi
ORDER BY chapters_completed DESC, themes_completed DESC, total_pp DESC

// Utenti con 0 capitoli ma PP > 0 → esclusi dalla classifica
\`\`\`

### Dopo l'Update

\`\`\`typescript
// Rank basato su PP
ORDER BY total_pp DESC, themes_completed DESC, chapters_completed DESC

// Utenti con PP > 0 → sempre inclusi nella classifica
\`\`\`

### Impatto

- ✅ **Positivo**: PP ora influenzano direttamente il ranking (coerente con UI)
- ✅ **Positivo**: Utenti che guadagnano PP da eventi/contest vengono classificati subito
- ⚠️ **Attenzione**: Utenti esistenti potrebbero vedere cambiamenti nel rank

---

## 🐛 Problemi Risolti

### 1. ~~PP Non Influenzavano il Ranking~~ ✅ FIXED
**Prima**: PP erano solo tie-breaker terziario  
**Dopo**: PP sono la metrica principale

### 2. ~~Campi Duplicati Causavano Inconsistenze~~ ✅ FIXED
**Prima**: `chapters_completed` vs `total_chapters_completed`  
**Dopo**: Solo `chapters_completed` usato nel codice

### 3. ~~Formula Inconsistente tra DB e UI~~ ✅ FIXED
**Prima**: UI mostrava PP ma DB ordinava per capitoli  
**Dopo**: PP-first ovunque (DB, API, UI)

### 4. ~~Rank = 0 Ambiguo~~ ✅ CLARIFIED
**Ora**: rank = 0 significa esplicitamente "utente non ha PP"  
**UI**: Mostra "Non classificato" invece di "#0"

---

## 📊 Testing

### Test Manuale

1. **Verifica algoritmo PP-first**:
   \`\`\`sql
   SELECT user_id, total_pp, themes_completed, chapters_completed,
          ROW_NUMBER() OVER (ORDER BY total_pp DESC, themes_completed DESC, chapters_completed DESC) as rank
   FROM user_progress WHERE total_pp > 0;
   \`\`\`

2. **Verifica RPC**:
   \`\`\`typescript
   // Test in Supabase Dashboard
   SELECT * FROM get_top_players(10);
   SELECT * FROM get_user_rank('user-uuid-here');
   \`\`\`

3. **Verifica API**:
   \`\`\`bash
   curl https://your-app.vercel.app/api/miniapp/leaderboard?userId=USER_ID&limit=10
   \`\`\`

### Scenari di Test

- ✅ Utente con 0 PP → rank = 0, non appare in classifica
- ✅ Utente con PP > 0 → appare in classifica in posizione corretta
- ✅ Due utenti con stesso PP → ordinati per themes_completed
- ✅ Leaderboard si aggiorna dopo completamento capitolo

---

## 🚀 Deployment

### 1. Eseguire Migration SQL

\`\`\`bash
# In Supabase Dashboard > SQL Editor
# Esegui scripts/040_leaderboard_pp_first.sql
\`\`\`

### 2. Verificare Funzioni RPC

\`\`\`sql
-- Test che le funzioni esistano e funzionino
SELECT * FROM get_top_players(5);
SELECT * FROM get_user_rank('test-user-id');
SELECT * FROM get_leaderboard_stats();
\`\`\`

### 3. Deploy Codice TypeScript

\`\`\`bash
# Vercel deployment automatico via GitHub
git push origin main
\`\`\`

### 4. Invalidate Cache (se necessario)

\`\`\`typescript
// Se usi Redis/Upstash per caching
await redis.del('leaderboard:*')
\`\`\`

---

## 📝 Prossimi Step (Opzionale)

### Miglioramenti Futuri

1. **Vista Materializzata** per performance:
   \`\`\`sql
   CREATE MATERIALIZED VIEW leaderboard_cached AS
   SELECT ... FROM get_top_players(1000);
   \`\`\`

2. **Consolidamento Campi Legacy**:
   \`\`\`sql
   -- Migration per rimuovere total_chapters_completed e completed_themes[]
   ALTER TABLE user_progress DROP COLUMN total_chapters_completed;
   ALTER TABLE user_progress DROP COLUMN completed_themes;
   \`\`\`

3. **Webhook per Aggiornamenti Real-time**:
   \`\`\`typescript
   // Notifica client quando rank cambia
   await pusher.trigger(`user-${userId}`, 'rank-updated', newRank)
   \`\`\`

---

## 🔗 File Correlati

- `scripts/040_leaderboard_pp_first.sql` - Migration SQL
- `lib/leaderboard/leaderboard-manager.tsx` - Logica centralizzata
- `app/api/miniapp/dashboard/route.ts` - Dashboard API
- `app/api/miniapp/profile/route.ts` - Profile API
- `app/api/miniapp/leaderboard/route.ts` - Leaderboard API
- `app/(miniapp)/page.tsx` - Dashboard UI
- `app/(miniapp)/leaderboard/page.tsx` - Leaderboard UI
- `docs/LEADERBOARD_ANALYSIS-(1)-tNbwR.md` - Analisi originale

---

**Implementazione Completa**: ✅  
**Testato in Produzione**: ⏳ (da verificare dopo deploy)  
**Breaking Changes**: ⚠️ Sì (ma backward compatible con gestione rank=0)
