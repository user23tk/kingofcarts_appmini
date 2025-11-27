# King of Carts - Logica di Business

## Sistema PP (Power Points)

### Valori PP

| Scelta | PP Delta |
|--------|----------|
| Scelta ottimale | 6 PP |
| Scelta buona | 5 PP |
| Scelta media | 4 PP |
| Scelta base | 3 PP |

**Costanti definite in `lib/constants/game.ts`:**
\`\`\`typescript
PP_MIN: 3
PP_MAX: 6
MAX_PP_PER_CHAPTER: 48 (8 scene x 6 PP)
MAX_PP_PER_HOUR: 100
MAX_PP_PER_DAY: 500
\`\`\`

### Flusso Guadagno PP

\`\`\`
Scelta utente
     │
     ▼
┌────────────────────┐
│  PPValidator       │
│  validateChoice()  │
│  - PP in range?    │
│  - Scelta valida?  │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│  validateRateLimits│
│  - < 100 PP/ora?   │
│  - < 500 PP/giorno?│
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│  EventManager      │
│  getPPMultiplier() │
│  (1x-5x per eventi)│
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│  StoryManager      │
│  completeChapter() │
│  - Update user_progress.total_pp
│  - Update chapters_completed
│  - Update event_leaderboard (if event)
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│  PPValidator       │
│  auditPPGain()     │
│  Log in pp_audit   │
└────────────────────┘
\`\`\`

---

## Gestione Temi e Capitoli

### Struttura Tema

Ogni tema ha:
- **Nome tecnico**: `fantasy`, `sci-fi`, `mystery`, etc.
- **Capitoli multipli**: Ogni capitolo ha 8 scene
- **Ogni scena**: 2 scelte con PP diversi
- **Finale**: Testo conclusivo + link al prossimo capitolo

### Temi Disponibili

| Tema | Emoji | Nome Display |
|------|-------|--------------|
| fantasy | `🏰` | Fantasia |
| sci-fi | `🚀` | Fantascienza |
| mystery | `🔍` | Mistero |
| romance | `💕` | Romantico |
| adventure | `🗺️` | Avventura |
| horror | `👻` | Horror |
| comedy | `😂` | Commedia |

### Progresso Tema

\`\`\`typescript
interface ThemeProgress {
  current_chapter: number    // Prossimo capitolo da giocare
  completed: boolean         // Tema completato?
  last_interaction: string   // Timestamp ultima interazione
}
\`\`\`

**Nota**: `current_chapter` indica il prossimo capitolo, quindi:
- `current_chapter = 1` -> Nessun capitolo completato
- `current_chapter = 2` -> Capitolo 1 completato
- `completed = true` -> Tutti i capitoli disponibili completati

---

## Sistema Leaderboard

### Algoritmo di Ranking (PP-First)

L'ordine di classifica prioritizza i PP:

\`\`\`sql
ORDER BY
  total_pp DESC,           -- 1. PP (metrica primaria)
  themes_completed DESC,   -- 2. Temi completati (tie-breaker)
  chapters_completed DESC  -- 3. Capitoli completati (tie-breaker)
\`\`\`

**Inclusione in classifica**: Solo utenti con `total_pp > 0`

### RPC Functions

\`\`\`sql
-- Rank utente singolo
get_user_rank(user_id UUID) -> { rank, total_players }

-- Top N giocatori
get_top_players(limit INTEGER) -> [{ user_id, username, first_name, chapters_completed, themes_completed, total_pp, rank }]

-- Statistiche globali
get_leaderboard_stats() -> { total_players, avg_chapters, top_score, completion_rate }
\`\`\`

### Formattazione Classifica (Telegram)

\`\`\`
🏆 Classifica King of Carts

🥇 Mario
   ⭐ 450 PP • 🎭 3 temi • 📚 15 cap.

🥈 Luigi
   ⭐ 380 PP • 🎭 2 temi • 📚 12 cap.

🥉 Peach
   ⭐ 320 PP • 🎭 2 temi • 📚 10 cap.

📊 La Tua Posizione: #42 su 1,234
\`\`\`

---

## Sistema Eventi

### Struttura Evento

Eventi sono temi speciali con:
- `is_event = true`
- `pp_multiplier`: Moltiplicatore PP (1x-5x)
- `event_start_date` / `event_end_date`: Durata
- `event_emoji`: Emoji speciale

### Ciclo di Vita Evento

\`\`\`
1. Creazione evento (admin)
   └── is_active = true, is_event = true

2. Giocatori partecipano
   └── PP guadagnati moltiplicati
   └── Aggiornamento event_leaderboard

3. Scadenza automatica
   └── deactivate_expired_events() trigger
   └── is_active = false

4. Visualizzazione classifica finale
   └── get_event_leaderboard()
\`\`\`

### Event Leaderboard

Classifica separata per ogni evento:

\`\`\`sql
-- Aggiornamento atomico
update_event_leaderboard_atomic(
  p_user_id TEXT,
  p_theme TEXT,
  p_pp_gained INTEGER,
  p_chapter_completed BOOLEAN
)

-- Query classifica
get_event_leaderboard_v2(theme, limit) -> [{
  user_id, username, first_name,
  total_pp, chapters_completed,
  rank, last_updated
}]
\`\`\`

---

## Autenticazione Mini App

### Flusso Auth

\`\`\`
1. Telegram apre Mini App
   └── Invia initData con firma HMAC

2. Frontend invia initData a API
   └── POST /api/miniapp/*
   └── Body: { initData: "..." }

3. Backend valida
   └── requireTelegramAuth(request)
   └── validateTelegramWebAppData(initData)
   └── Verifica HMAC-SHA256

4. Estrazione utente
   └── extractUserFromInitData()
   └── bot.getOrCreateUser()

5. Ritorno dati
   └── { authorized: true, userId, telegramId, ... }
\`\`\`

### Validazione initData

\`\`\`typescript
// lib/telegram/webapp-auth.ts
validateTelegramWebAppData(initData: string): {
  valid: boolean
  error?: string
  data?: ParsedInitData
}

// Verifica:
// 1. Parsing query string
// 2. Estrazione hash
// 3. Calcolo HMAC-SHA256 con bot token
// 4. Confronto hash
// 5. Verifica auth_date (non troppo vecchio)
\`\`\`

---

## Rate Limiting

### Configurazione

\`\`\`typescript
RATE_LIMIT_DAILY_MAX: 50     // Richieste/giorno
RATE_LIMIT_HOURLY_MAX: 10    // Richieste/ora
RATE_LIMIT_BURST_MAX: 3      // Burst max
RATE_LIMIT_BURST_WINDOW_SECONDS: 60
\`\`\`

### PP Rate Limits

\`\`\`typescript
MAX_PP_PER_HOUR: 100   // Limite PP orario
MAX_PP_PER_DAY: 500    // Limite PP giornaliero
\`\`\`

### Flusso Rate Limit

\`\`\`
Richiesta utente
     │
     ▼
┌────────────────────┐
│ DISABLE_RATE_LIMITS│
│ == "true"?         │
│ → Bypassa controllo│
└─────────┬──────────┘
          │ no
          ▼
┌────────────────────┐
│ check_rate_limit() │
│ RPC Supabase       │
│ - Crea/aggiorna    │
│   rate_limits      │
│ - Confronta con    │
│   daily_limit      │
└─────────┬──────────┘
          │
     ┌────┴────┐
     │         │
   allowed   denied
     │         │
     ▼         ▼
  Procedi    429 Error
             "Rate limit exceeded"
             + resetTime
\`\`\`

---

## Comandi Bot

### Comandi Principali

| Comando | Descrizione |
|---------|-------------|
| `/start` | Apre Mini App con bottone inline |
| `/help` | Mostra aiuto e comandi |
| `/stats` | Redirect a profilo in Mini App |
| `/continue` | Redirect a storia in Mini App |
| `/leaderboard` | Redirect a classifica |
| `/event` | Info evento attivo |

### Inline Mode

Digitando `@kingofcarts_betabot` in qualsiasi chat:

\`\`\`
1. Bot riceve inline_query
2. Genera risultato "Invita Amici"
3. Utente seleziona -> messaggio con bottoni
4. Bottoni: "Inizia Avventura" + "Apri Mini App"
\`\`\`

---

## Gestione Sessioni

### SessionManager

\`\`\`typescript
class SessionManager {
  // Gestisce lo stato della sessione di gioco
  getSession(userId: string): GameSession
  updateSession(userId: string, data: Partial<GameSession>): void
  clearSession(userId: string): void
}

interface GameSession {
  currentTheme: string
  currentChapter: number
  currentScene: number
  sessionPP: number
  choices: string[]
}
\`\`\`

### Anti-Replay

\`\`\`typescript
class AntiReplayManager {
  // Previene replay di callback query
  static isCallbackProcessed(callbackId: string): boolean
  static markCallbackProcessed(callbackId: string): void
  
  // Storage: Set in-memory con TTL
  // TTL: 5 minuti (CALLBACK_TOKEN_EXPIRY_MINUTES)
}
\`\`\`

---

## Caching

### QueryCache

\`\`\`typescript
class QueryCache {
  // Cache in-memory con TTL
  static async get<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    ttlSeconds: number
  ): Promise<T>
  
  static invalidate(key: string): void
  static invalidatePattern(pattern: string): void
  static clear(): void
}
\`\`\`

### Pattern di Cache

\`\`\`typescript
// Utente - cache breve (dati cambiano spesso)
QueryCache.get(`user_progress:${userId}`, fetcher, 30)

// Capitoli - cache lunga (cambiano raramente)
QueryCache.get(`chapter:${theme}:${num}`, fetcher, 300)

// Utente Telegram - cache media
QueryCache.get(`telegram_user:${telegramId}`, fetcher, 60)
\`\`\`

### Invalidazione

\`\`\`typescript
// Dopo completamento capitolo
QueryCache.invalidate(`user_progress:${userId}`)

// Dopo modifica contenuto
QueryCache.invalidatePattern(`chapter:${theme}`)
\`\`\`

---

## Gestione Errori

### Recovery Pattern

\`\`\`typescript
async function handleMessageWithRecovery(message: any) {
  try {
    await handleMessage(message)
  } catch (error) {
    console.error("[v0] Message handling error:", error)
    // Fallback: invia messaggio errore all'utente
    if (chatId) {
      await bot.sendMessage(chatId, "❌ Si è verificato un errore. Riprova con /start")
    }
  }
}
\`\`\`

### Rate Limit Fail-Open

\`\`\`typescript
// In caso di errore database, permetti la richiesta
// (meglio UX degradata che blocco totale)
if (error) {
  return { allowed: true, currentTime }
}
\`\`\`

---

## API Endpoints

### Mini App APIs

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/api/miniapp/auth` | POST | Valida initData |
| `/api/miniapp/dashboard` | POST | Dati home |
| `/api/miniapp/themes` | POST | Lista temi |
| `/api/miniapp/story/start` | POST | Inizia capitolo |
| `/api/miniapp/story/choice` | POST | Registra scelta |
| `/api/miniapp/story/continue` | POST | Continua storia |
| `/api/miniapp/leaderboard` | POST | Classifica |
| `/api/miniapp/profile` | POST | Profilo utente |

### Webhook

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/api/telegram` | POST | Webhook Telegram |

### Debug (Admin)

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/api/debug/stats` | GET | Statistiche sistema |
| `/api/debug/users` | GET | Lista utenti |
| `/api/debug/events` | GET/POST | Gestione eventi |
| `/api/debug/reset-user-stats` | POST | Reset utente |

---

## Navigazione Mini App

### Bottom Navigation

\`\`\`typescript
const NAV_ITEMS = [
  { path: "/", icon: "🏠", label: "Home" },
  { path: "/themes", icon: "📖", label: "Storia" },
  { path: "/leaderboard", icon: "🏆", label: "Classifica" },
  { path: "/profile", icon: "👤", label: "Profilo" },
]
\`\`\`

### Pagine

| Route | Descrizione |
|-------|-------------|
| `/` | Dashboard con stats e quick actions |
| `/themes` | Selezione tema storia |
| `/story/[theme]` | Gameplay storia (no bottom nav) |
| `/leaderboard` | Classifica globale |
| `/profile` | Profilo e statistiche utente |

---

## Formule e Calcoli

### PP Totali Capitolo

\`\`\`
PP_Capitolo = Σ(PP_Scena[i]) per i = 0..7
Min: 8 * 3 = 24 PP
Max: 8 * 6 = 48 PP
\`\`\`

### PP con Moltiplicatore Evento

\`\`\`
PP_Finale = PP_Base * pp_multiplier
\`\`\`

### Rank Utente

\`\`\`sql
rank = ROW_NUMBER() OVER (
  ORDER BY total_pp DESC, 
           themes_completed DESC, 
           chapters_completed DESC
)
WHERE total_pp > 0
\`\`\`

### Completion Rate

\`\`\`sql
completion_rate = 
  COUNT(themes_completed >= 7) / 
  NULLIF(COUNT(*), 0)
