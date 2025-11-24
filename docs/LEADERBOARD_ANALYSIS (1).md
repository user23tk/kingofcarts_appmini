# 📊 ANALISI SISTEMA LEADERBOARD - King of Carts
## Report Tecnico Dettagliato - 24 Novembre 2024 (AGGIORNATO CON SCHEMA REALE)

---

## 🗄️ SCHEMA DATI PP/PROGRESSI/LEADERBOARD (REALE DA DB)

### 1. Tabelle Principali

#### **users** (SCHEMA REALE)
```sql
- id: UUID (primary key)
- telegram_id: BIGINT (unique)
- username: TEXT
- first_name: TEXT
- last_name: TEXT
- language_code: TEXT
- is_bot: BOOLEAN
- created_at: TIMESTAMP WITH TIME ZONE
- updated_at: TIMESTAMP WITH TIME ZONE
```

#### **user_progress** (SCHEMA REALE)
```sql
- id: UUID (primary key)
- user_id: UUID (foreign key → users.id)
- current_theme: TEXT (NOT NULL)
- current_chapter: INTEGER (default 1)
- completed_themes: TEXT[] (default '{}')
- total_chapters_completed: INTEGER (default 0)
- last_interaction: TIMESTAMP WITH TIME ZONE
- created_at: TIMESTAMP WITH TIME ZONE
- updated_at: TIMESTAMP WITH TIME ZONE
- theme_progress: JSONB (default '{}')
- total_pp: INTEGER (default 0)
- chapters_completed: INTEGER (default 0)
- themes_completed: INTEGER (default 0)
```

#### **event_leaderboard** (NUOVA TABELLA NON DOCUMENTATA)
```sql
- id: UUID (primary key)
- user_id: TEXT (NOT NULL) -- NOTA: TEXT non UUID!
- theme: TEXT (NOT NULL)
- total_pp: INTEGER (default 0)
- chapters_completed: INTEGER (default 0)
- rank: INTEGER (default 0)
- last_updated: TIMESTAMP WITH TIME ZONE
- created_at: TIMESTAMP WITH TIME ZONE
```

#### **themes** (TABELLA CON EVENTI INTEGRATI)
```sql
- id: UUID
- name: TEXT
- title: TEXT
- description: TEXT
- emoji: TEXT
- is_active: BOOLEAN (default true)
- is_event: BOOLEAN (default false)
- event_emoji: TEXT
- event_start_date: TIMESTAMP WITH TIME ZONE
- event_end_date: TIMESTAMP WITH TIME ZONE
- pp_multiplier: NUMERIC (default 1.0)
- total_chapters: INTEGER (default 10)
- created_at: TIMESTAMP WITH TIME ZONE
- updated_at: TIMESTAMP WITH TIME ZONE
```

### 2. Struttura theme_progress (JSONB)
```json
{
  "fantasy": {
    "current_chapter": 3,
    "completed": false,
    "last_interaction": "2024-11-24T10:00:00Z"
  },
  "horror": {
    "current_chapter": 5,
    "completed": true,
    "last_interaction": "2024-11-23T15:30:00Z"
  }
}
```

---

## 🔢 ALGORITMO DI CLASSIFICA E RANK

### 1. **Algoritmo di Ranking Definitivo (PP-FIRST) ✅ IMPLEMENTATO**

A partire dalla migration `040_leaderboard_pp_first.sql`, il sistema usa **PP come metrica primaria**:

#### **get_user_rank** (NUOVA VERSIONE PP-FIRST)
```sql
CREATE OR REPLACE FUNCTION public.get_user_rank(p_user_id uuid)
RETURNS TABLE(rank bigint, total_players bigint)

-- NUOVO ALGORITMO PP-FIRST:
ORDER BY 
  total_pp DESC,           -- PP sono ora la metrica PRIMARIA
  themes_completed DESC,   -- Temi come tie-breaker secondario
  chapters_completed DESC  -- Capitoli come tie-breaker terziario
WHERE total_pp > 0  -- Include chiunque abbia almeno 1 PP

-- Se utente ha 0 PP → rank = 0
```

#### **get_top_players** (NUOVA VERSIONE PP-FIRST)
```sql
CREATE OR REPLACE FUNCTION public.get_top_players(p_limit integer DEFAULT 100)
RETURNS TABLE(
  user_id uuid, 
  username text, 
  first_name text, 
  chapters_completed integer, 
  themes_completed integer, 
  total_pp integer, 
  rank bigint
)

-- NUOVO ALGORITMO PP-FIRST:
ORDER BY 
  total_pp DESC,           -- PP sono ora la metrica PRIMARIA
  themes_completed DESC,   -- Temi come tie-breaker secondario
  chapters_completed DESC  -- Capitoli come tie-breaker terziario
WHERE total_pp > 0  -- Include chiunque abbia almeno 1 PP
```

**CAMBIAMENTI CHIAVE**:
- ✅ PP (`total_pp`) sono ora il criterio principale di ordinamento
- ✅ Un utente con 1000 PP e 0 capitoli sarà in cima alla classifica
- ✅ Filtro cambiato da `chapters_completed > 0 OR themes_completed > 0` a `total_pp > 0`
- ✅ Aggiunto indice ottimizzato: `idx_user_progress_pp_ranking`

#### **get_event_leaderboard** (PER EVENTI)
```sql
CREATE OR REPLACE FUNCTION public.get_event_leaderboard(p_theme text, p_limit integer DEFAULT 100)
RETURNS TABLE(user_id text, total_pp integer, chapters_completed integer, rank integer)

-- Legge da tabella event_leaderboard pre-calcolata
ORDER BY rank ASC
```

### 2. **Altre Funzioni Rilevanti**

- **get_dashboard_stats**: Chiama get_user_rank internamente
- **get_leaderboard_stats**: Calcola statistiche globali con formula mista
- **update_event_leaderboard_atomic**: Aggiorna classifica eventi in tempo reale
- **complete_chapter_atomic**: Aggiorna PP e progressi atomicamente

### 3. **Calcolo Rank nel Dashboard API**

```typescript
// app/api/miniapp/dashboard/route.ts
const { data: rankData } = await supabase.rpc("get_user_rank", {
  p_user_id: userId,
})

// Se errore o nessun dato → rank = 0
// Altrimenti → rank = rankData[0].rank
```

---

## 🐛 INCONGRUENZE IDENTIFICATE (AGGIORNATE CON SCHEMA REALE)

### 1. **PP Non Influenzano il Ranking Principale**

**PROBLEMA CONFERMATO**: L'algoritmo reale ordina per:
1. `chapters_completed DESC` (priorità massima)
2. `themes_completed DESC` (seconda priorità)
3. `total_pp DESC` (solo come tie-breaker)

**IMPATTO**: Un utente con 1000 PP ma 0 capitoli avrà rank 0, mentre uno con 10 PP e 1 capitolo sarà in classifica.

### 2. **Campi Duplicati Confermati nel DB**

La tabella `user_progress` contiene EFFETTIVAMENTE campi ridondanti:
- ✅ `chapters_completed` vs `total_chapters_completed` (ENTRAMBI ESISTONO)
- ✅ `themes_completed` vs `completed_themes[]` (ENTRAMBI ESISTONO)
- ✅ `theme_progress` JSONB vs campi singoli `current_theme`, `current_chapter` (TUTTI PRESENTI)

**Codice che gestisce la duplicazione** (dashboard/route.ts):
```typescript
const chaptersCompleted = progress?.chapters_completed || progress?.total_chapters_completed || 0
const themesCompleted = progress?.themes_completed || progress?.completed_themes?.length || 0
```

### 3. **Incoerenza Tipo Dati event_leaderboard**

**NUOVO PROBLEMA SCOPERTO**:
- `event_leaderboard.user_id` è TEXT
- `user_progress.user_id` è UUID
- Richiede conversioni continue e può causare errori di join

### 4. **Rank 0 vs Non Classificato**

```typescript
// Dashboard mostra:
{dashboardData.user.rank === 0 ? "Non classificato" : `Rank #${dashboardData.user.rank}`}
```

Ma rank 0 può significare:
- Utente senza progressi (corretto)
- Errore nel calcolo (mascherato)
- Utente non trovato nella query (mascherato)

### 5. **Event Leaderboard Completamente Separata**

**CONFERMATO**: Sistema dual-leaderboard:
- **Classifica Generale**: Basata su capitoli/temi (PP secondari)
- **Classifica Eventi**: Tabella separata, rank pre-calcolato
- **Nessuna sincronizzazione** tra le due classifiche

### 6. **Funzioni Mancanti o Non Utilizzate**

**Funzioni nel DB ma NON usate dal codice**:
- `get_players_with_better_score` (calcola con formula diversa)
- `get_theme_progress` (3 versioni overloaded!)
- `migrate_user_progress` (migrazione mai completata?)

**Funzioni usate dal codice ma con parametri errati**:
- Il codice passa sempre `p_user_id` come UUID
- Ma `event_leaderboard` si aspetta TEXT

### 7. **Formula Leaderboard Stats Incoerente**

La funzione `get_leaderboard_stats` usa una formula DIVERSA:
```sql
MAX((chapters_completed * 10) + (themes_completed * 100) + COALESCE(total_pp, 0))
```

Mentre il ranking usa solo ordinamento senza pesi!

---

## 💡 PROPOSTA: FONTE DI VERITÀ UNICA

### 1. **Centralizzare Logica in LeaderboardManager**

```typescript
// lib/leaderboard/leaderboard-manager.tsx
export class LeaderboardManager {
  // Unico punto per calcolare rank
  static async calculateUserRank(userId: string): Promise<UserRank> {
    // Logica unificata qui
  }
  
  // Unico punto per ottenere classifica
  static async getLeaderboard(options: LeaderboardOptions): Promise<LeaderboardData> {
    // Logica unificata qui
  }
}
```

### 2. **Standardizzare Algoritmo di Ranking**

Proposta di algoritmo unificato:
```sql
ORDER BY
  (chapters_completed * 100) +    -- Peso maggiore ai capitoli
  (themes_completed * 500) +       -- Peso ancora maggiore ai temi
  (total_pp)                       -- PP come tie-breaker
DESC
```

### 3. **Migrare Campi Legacy**

1. Consolidare `chapters_completed` e `total_chapters_completed`
2. Rimuovere `completed_themes[]` in favore di `themes_completed`
3. Usare solo `theme_progress` JSONB per stato corrente

### 4. **Sincronizzare PP con Ranking**

- Opzione A: PP influenzano direttamente il rank (formula pesata)
- Opzione B: Mantenere rank basato su progressi, PP solo display
- **Raccomandazione**: Opzione A per coerenza con UI

### 5. **Validazione e Monitoring**

```typescript
// Aggiungere endpoint di validazione
/api/debug/validate-rankings
- Confronta RPC vs API
- Verifica coerenza dati
- Alert su discrepanze
```

### 6. **Cache Unificata**

```typescript
// lib/cache/leaderboard-cache.ts
export class LeaderboardCache {
  private static cache = new Map<string, CachedRank>()
  
  static async getRank(userId: string): Promise<UserRank> {
    // Cache con TTL 5 minuti
    // Invalida su update progress
  }
}
```

---

## 📋 PUNTI CRITICI DA RISOLVERE (BASATI SU SCHEMA REALE)

1. **CRITICO: Algoritmo di Ranking Incoerente**
   - UI enfatizza PP ma algoritmo li ignora quasi completamente
   - Formula in `get_leaderboard_stats` diversa da `get_user_rank`
   - Decidere: ordinamento semplice o formula pesata?

2. **CRITICO: Campi Duplicati in user_progress**
   - `chapters_completed` vs `total_chapters_completed`
   - `themes_completed` vs `completed_themes[]`
   - Rischio: aggiornamenti parziali causano inconsistenze

3. **ALTO: Type Mismatch event_leaderboard**
   - `user_id` è TEXT invece di UUID
   - Richiede cast continui e può causare errori

4. **ALTO: Funzioni Overloaded get_theme_progress**
   - 3 versioni con parametri diversi
   - Confusione su quale viene chiamata

5. **MEDIO: Tabelle Non Documentate**
   - `user_progress_backup`
   - `user_sessions`
   - `pp_audit`
   - Verificare se sono ancora necessarie

---

## 🎯 RACCOMANDAZIONI IMMEDIATE (AGGIORNATE)

1. **CRITICO**: Implementare formula di ranking coerente
   ```sql
   -- Proposta: Peso bilanciato
   (chapters_completed * 50) + 
   (themes_completed * 200) + 
   (total_pp * 1)
   ```

2. **CRITICO**: Creare vista materializzata per leaderboard
   ```sql
   CREATE MATERIALIZED VIEW leaderboard_unified AS
   SELECT ... ORDER BY formula_score DESC;
   ```

3. **ALTO**: Migration per consolidare campi duplicati
   - Usare SOLO `chapters_completed` (non `total_chapters_completed`)
   - Usare SOLO `themes_completed` (non `completed_themes[]`)
   - Trigger per mantenere sincronizzati durante transizione

4. **ALTO**: Fix type mismatch in event_leaderboard
   ```sql
   ALTER TABLE event_leaderboard 
   ALTER COLUMN user_id TYPE UUID USING user_id::UUID;
   ```

5. **MEDIO**: Rimuovere funzioni duplicate/non utilizzate
   - Mantenere solo una versione di `get_theme_progress`
   - Rimuovere `get_players_with_better_score`
   - Documentare quali funzioni sono deprecate

---

## 🔍 DIFFERENZE TRA SCHEMA REALE E MIGRATIONS

1. **Funzioni nel DB ma non nei migration files**:
   - `get_dashboard_stats`
   - `get_event_leaderboard`
   - `update_event_leaderboard_atomic` (2 versioni)

2. **Migration files con funzioni non presenti nel DB**:
   - Vecchia versione di `get_user_rank` con `telegram_id`
   - Varie funzioni in `scripts/deprecated/`

3. **Tabelle create ma non documentate**:
   - `user_progress_backup` (creata in migration 010)
   - `generated_chapters` (per AI generation)

---

## 📊 ANALISI UTILIZZO FUNZIONI NEL CODICE

### Funzioni RPC Effettivamente Utilizzate:

1. **get_user_rank** ✅
   - `app/api/miniapp/profile/route.ts`
   - `app/api/miniapp/dashboard/route.ts`
   - `app/api/debug/test-rank-rpc/route.ts`
   - `lib/leaderboard/leaderboard-manager.tsx`

2. **get_top_players** ✅
   - `lib/leaderboard/leaderboard-manager.tsx`

3. **get_theme_progress** ✅ (ma quale versione?)
   - `app/api/miniapp/profile/route.ts`
   - `lib/story/story-manager.ts`

4. **get_leaderboard_stats** ✅
   - `lib/leaderboard/leaderboard-manager.tsx`

### Funzioni RPC MAI Utilizzate:

1. **get_players_with_better_score** ❌
2. **get_dashboard_stats** ❌
3. **get_event_leaderboard** ❌ (usa API diretta)
4. **get_all_theme_progress** ❌
5. **get_user_event_rank** ❌

---

## 🚨 RIEPILOGO PROBLEMI CRITICI

1. **UI vs Backend Mismatch**: L'interfaccia mostra PP come metrica principale ma il ranking li ignora
2. **Dati Ridondanti**: Stesso dato salvato in 2-3 campi diversi
3. **Type Safety**: Mix di TEXT e UUID per user_id
4. **Dead Code**: ~40% delle funzioni RPC non sono utilizzate
5. **Formula Inconsistente**: Ogni parte del sistema calcola il "punteggio" diversamente

---

---

## 🚀 STATO IMPLEMENTAZIONE: REFACTOR PP-FIRST COMPLETATO

### ✅ Modifiche Implementate (24 Nov 2024):

1. **Database - Migration 040_leaderboard_pp_first.sql**
   - ✅ Creata nuova migration che implementa ordinamento PP-first
   - ✅ `get_user_rank`: Ora ordina per `total_pp DESC, themes_completed DESC, chapters_completed DESC`
   - ✅ `get_top_players`: Stesso ordinamento PP-first
   - ✅ Filtro cambiato da `chapters_completed > 0 OR themes_completed > 0` a `total_pp > 0`
   - ✅ Aggiunto indice ottimizzato `idx_user_progress_pp_ranking`

2. **LeaderboardManager - API Centralizzate**
   - ✅ Aggiunto metodo `getLeaderboard(limit)` - alias per consistenza
   - ✅ Aggiunto metodo `getUserStats(userId)` - ritorna PP, temi, capitoli, rank
   - ✅ Aggiunto helper `getUserIdFromTelegramId(telegramId)`
   - ✅ Tutti i metodi usano le RPC PP-first aggiornate

3. **API Endpoints Aggiornati**
   - ✅ `dashboard/route.ts`: Usa `LeaderboardManager.getUserStats()` invece di RPC diretta
   - ✅ `leaderboard/route.ts`: Già utilizzava LeaderboardManager (nessuna modifica necessaria)

4. **UI/UX Miglioramenti**
   - ✅ Home MiniApp: PP mostrati prima del rank, messaggio "Inizia a giocare per entrare in classifica"
   - ✅ Leaderboard Page: Aggiunto "🎯 Classifica basata sui PP (Power Points)"
   - ✅ Stats Card: "Top Score" rinominato in "Top PP"
   - ✅ Formato messaggio Telegram aggiornato per enfatizzare PP

5. **Debug Tools Aggiornati**
   - ✅ RankDebugger: Supporta sia User ID che Telegram ID
   - ✅ Mostra PP, rank, temi e capitoli in formato visuale
   - ✅ Confronta RPC vs API vs LeaderboardManager per validazione
   - ✅ Nuovi endpoint: `/api/debug/user-stats` e `/api/debug/get-user-by-telegram`

### 📋 LeaderboardManager - API Disponibili:

```typescript
class LeaderboardManager {
  // Ottieni classifica top N giocatori
  static async getLeaderboard(limit: number): Promise<LeaderboardPlayer[]>
  
  // Ottieni rank di un utente specifico
  static async getUserRank(userId: string): Promise<UserRank | null>
  
  // Ottieni statistiche complete utente (PP, rank, progressi)
  static async getUserStats(userId: string): Promise<UserStats | null>
  
  // Helper per conversione Telegram ID → User ID
  static async getUserIdFromTelegramId(telegramId: number): Promise<string | null>
  
  // Ottieni statistiche globali leaderboard
  static async getLeaderboardStats(): Promise<LeaderboardStats>
}
```

### 🔄 Prossimi Passi Consigliati:

1. **Eseguire migration in produzione**: `scripts/040_leaderboard_pp_first.sql`
2. **Monitorare performance**: L'indice `idx_user_progress_pp_ranking` dovrebbe ottimizzare le query
3. **Validare con dati reali**: Usare RankDebugger per verificare ranking utenti esistenti
4. **Considerare cache**: LeaderboardManager potrebbe beneficiare di cache con TTL 5 minuti

---

**Report generato da**: OpenHands AI Agent  
**Focus**: Sistema Leaderboard, PP e Ranking  
**Versione**: 3.0 (PP-First Implementation)  
**Status**: IMPLEMENTAZIONE COMPLETATA ✅