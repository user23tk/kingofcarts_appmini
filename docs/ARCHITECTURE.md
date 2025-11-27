# King of Carts - Architettura del Sistema

## Panoramica

King of Carts e un bot Telegram con Mini App integrata per storytelling interattivo. Gli utenti possono leggere storie a scelta multipla, guadagnare PP (Power Points) e competere in classifiche globali.

---

## Stack Tecnologico

| Layer | Tecnologia |
|-------|------------|
| Frontend | Next.js 15 (App Router), React 19, TailwindCSS |
| Backend | Next.js API Routes, Supabase (PostgreSQL) |
| Cache | Upstash Redis (KV), In-Memory QueryCache |
| Bot | Telegram Bot API, Telegram Mini App SDK |
| Auth | Telegram WebApp initData validation (HMAC-SHA256) |
| Deploy | Vercel |

---

## Struttura Directory

\`\`\`
/
├── app/
│   ├── (miniapp)/              # Mini App pages (layout con bottom nav)
│   │   ├── page.tsx            # Home/Dashboard
│   │   ├── themes/page.tsx     # Selezione tema
│   │   ├── story/[theme]/      # Gameplay storia
│   │   ├── leaderboard/        # Classifica globale
│   │   └── profile/            # Profilo utente
│   ├── api/
│   │   ├── telegram/route.ts   # Webhook Telegram (main entry)
│   │   ├── miniapp/            # API endpoints per Mini App
│   │   │   ├── auth/           # Autenticazione
│   │   │   ├── story/          # Start, choice, continue
│   │   │   ├── leaderboard/    # Classifica
│   │   │   ├── profile/        # Profilo utente
│   │   │   └── themes/         # Lista temi
│   │   ├── debug/              # Debug endpoints (admin only)
│   │   └── health/             # Health check
│   └── debug/page.tsx          # Admin dashboard
├── lib/
│   ├── telegram/               # Bot e WebApp utilities
│   ├── story/                  # Story e Session managers
│   ├── leaderboard/            # Leaderboard managers
│   ├── security/               # Rate limiting, anti-replay, PP validation
│   ├── cache/                  # Query cache
│   ├── supabase/               # Client configurations
│   └── miniapp/                # Auth middleware
├── components/
│   ├── miniapp/                # UI components per Mini App
│   ├── debug/                  # Admin components
│   └── ui/                     # shadcn/ui components
└── scripts/                    # SQL migrations e utilities
\`\`\`

---

## Database Schema (Supabase PostgreSQL)

### Tabelle Principali

#### `users`
Utenti Telegram registrati.

| Colonna | Tipo | Descrizione |
|---------|------|-------------|
| id | UUID | Primary key |
| telegram_id | BIGINT | Telegram user ID (unique) |
| username | TEXT | Username Telegram |
| first_name | TEXT | Nome |
| last_name | TEXT | Cognome |
| language_code | TEXT | Lingua preferita |
| is_bot | BOOLEAN | Flag bot |
| created_at | TIMESTAMPTZ | Data creazione |
| updated_at | TIMESTAMPTZ | Ultimo aggiornamento |

#### `themes`
Temi disponibili per le storie.

| Colonna | Tipo | Descrizione |
|---------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Nome tecnico (es. "fantasy") |
| title | TEXT | Titolo display |
| description | TEXT | Descrizione |
| emoji | TEXT | Emoji tema |
| total_chapters | INTEGER | Capitoli totali |
| is_active | BOOLEAN | Tema attivo |
| is_event | BOOLEAN | E un evento speciale |
| pp_multiplier | NUMERIC | Moltiplicatore PP (eventi) |
| event_start_date | TIMESTAMPTZ | Inizio evento |
| event_end_date | TIMESTAMPTZ | Fine evento |
| event_emoji | TEXT | Emoji evento |

#### `story_chapters`
Capitoli delle storie con contenuto JSONB.

| Colonna | Tipo | Descrizione |
|---------|------|-------------|
| id | UUID | Primary key |
| theme_id | UUID | FK -> themes.id |
| chapter_number | INTEGER | Numero capitolo |
| title | TEXT | Titolo capitolo |
| content | JSONB | Contenuto (scenes, choices, finale) |
| is_active | BOOLEAN | Capitolo attivo |
| version | INTEGER | Versione contenuto |

**Struttura `content` JSONB:**
\`\`\`json
{
  "scenes": [
    {
      "index": 0,
      "text": "Testo scena...",
      "choices": [
        { "id": "choice_1", "label": "Scelta A", "pp_delta": 5 },
        { "id": "choice_2", "label": "Scelta B", "pp_delta": 3 }
      ]
    }
  ],
  "finale": {
    "text": "Finale capitolo...",
    "nextChapter": "2"
  }
}
\`\`\`

#### `user_progress`
Progresso utente attraverso le storie.

| Colonna | Tipo | Descrizione |
|---------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | FK -> users.id |
| current_theme | TEXT | Tema corrente |
| current_chapter | INTEGER | Prossimo capitolo da giocare |
| total_pp | INTEGER | PP totali accumulati |
| chapters_completed | INTEGER | Capitoli completati |
| themes_completed | INTEGER | Temi completati |
| completed_themes | TEXT[] | Array temi completati |
| theme_progress | JSONB | Progresso per tema |
| last_interaction | TIMESTAMPTZ | Ultima interazione |

**Struttura `theme_progress` JSONB:**
\`\`\`json
{
  "fantasy": {
    "current_chapter": 3,
    "completed": false,
    "last_interaction": "2024-11-24T12:00:00Z"
  }
}
\`\`\`

#### `event_leaderboard`
Classifica per eventi speciali.

| Colonna | Tipo | Descrizione |
|---------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | FK -> users.id |
| theme | TEXT | Nome tema/evento |
| total_pp | INTEGER | PP nell'evento |
| chapters_completed | INTEGER | Capitoli completati |
| rank | INTEGER | Posizione classifica |
| last_updated | TIMESTAMPTZ | Ultimo aggiornamento |

#### `pp_audit`
Audit trail per PP guadagnati (anti-cheat).

| Colonna | Tipo | Descrizione |
|---------|------|-------------|
| id | BIGINT | Primary key |
| user_id | TEXT | User ID |
| theme | TEXT | Tema |
| chapter_number | INTEGER | Capitolo |
| scene_index | INTEGER | Scena |
| choice_id | TEXT | ID scelta |
| pp_gained | INTEGER | PP guadagnati |
| session_total_pp | INTEGER | PP totali sessione |
| ip_address | INET | IP address |
| user_agent | TEXT | User agent |
| created_at | TIMESTAMPTZ | Timestamp |

#### `rate_limits`
Tracking rate limit per utente.

| Colonna | Tipo | Descrizione |
|---------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | FK -> users.id |
| date | DATE | Data |
| request_count | INTEGER | Richieste giornaliere |
| ip_address | INET | IP address |

#### `global_stats`
Statistiche globali del gioco.

| Colonna | Tipo | Descrizione |
|---------|------|-------------|
| id | UUID | Primary key |
| stat_name | TEXT | Nome statistica (unique) |
| stat_value | BIGINT | Valore |
| updated_at | TIMESTAMPTZ | Ultimo aggiornamento |

**Statistiche tracciate:**
- `total_users`
- `total_interactions`
- `total_chapters_completed`
- `total_themes_completed`

#### `security_events`
Log eventi di sicurezza.

| Colonna | Tipo | Descrizione |
|---------|------|-------------|
| id | UUID | Primary key |
| event_type | TEXT | Tipo evento |
| user_id | UUID | Utente coinvolto |
| telegram_id | BIGINT | Telegram ID |
| ip_address | INET | IP |
| details | JSONB | Dettagli |

#### `audit_logs`
Log audit generale.

| Colonna | Tipo | Descrizione |
|---------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Utente |
| action | TEXT | Azione |
| resource | TEXT | Risorsa |
| details | JSONB | Dettagli |

---

## RPC Functions (Supabase)

### Core Functions

| Funzione | Descrizione |
|----------|-------------|
| `update_updated_at_column()` | Trigger per auto-update timestamp |
| `increment_global_stat(stat_name, increment)` | Incrementa statistica globale |
| `check_rate_limit(user_id, daily_limit, should_count)` | Verifica e aggiorna rate limit |

### Leaderboard Functions (PP-First)

| Funzione | Descrizione |
|----------|-------------|
| `get_user_rank(user_id UUID)` | Rank utente (PP-first: PP > themes > chapters) |
| `get_top_players(limit INTEGER)` | Top N giocatori ordinati per PP |
| `get_leaderboard_stats()` | Statistiche globali classifica |

### Theme Progress Functions

| Funzione | Descrizione |
|----------|-------------|
| `get_theme_progress(user_id, theme_name)` | Progresso utente per tema |
| `get_all_theme_progress(user_id)` | Progresso tutti i temi |
| `update_theme_progress(user_id, theme, chapter, completed)` | Aggiorna progresso tema |

### Event Functions

| Funzione | Descrizione |
|----------|-------------|
| `deactivate_expired_events()` | Disattiva eventi scaduti |
| `get_active_event()` | Ottieni evento attivo |
| `get_event_leaderboard(theme, limit)` | Classifica evento |
| `get_user_event_rank(user_id, theme)` | Rank utente nell'evento |
| `update_event_leaderboard_atomic(user_id, theme, pp, completed)` | Update atomico leaderboard evento |
| `get_event_leaderboard_v2(theme, limit)` | Classifica evento con JOIN users |
| `get_user_event_stats(user_id, theme)` | Statistiche utente evento |
| `update_event_progress_v2(user_id, theme, pp, chapters)` | Aggiorna progresso evento |

### Security Functions

| Funzione | Descrizione |
|----------|-------------|
| `detect_suspicious_pp_patterns()` | Rileva pattern PP sospetti |
| `complete_chapter_atomic(user_id, theme, chapter, pp, is_event)` | Completa capitolo atomicamente |

---

## Row Level Security (RLS)

Tutte le tabelle hanno RLS abilitato. Policies principali:

| Tabella | Policy | Tipo |
|---------|--------|------|
| users | `users_select_all` | SELECT per tutti |
| users | `users_update_own` | UPDATE solo proprio record |
| user_progress | `user_progress_select_own` | SELECT solo proprio |
| user_progress | `user_progress_update_own` | UPDATE solo proprio |
| pp_audit | `Allow server inserts` | INSERT solo server |
| pp_audit | `Allow admin reads` | SELECT solo admin |
| rate_limits | `rate_limits_*_own` | CRUD solo proprio |

---

## Flusso Dati

\`\`\`
┌──────────────────┐
│  Telegram User   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│  Telegram Bot    │────▶│  Webhook API     │
│  (@kingofcarts)  │     │  /api/telegram   │
└──────────────────┘     └────────┬─────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                        │                        │
         ▼                        ▼                        ▼
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│  /start Command  │   │  Inline Query    │   │  Callback Query  │
└────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘
         │                      │                      │
         ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Mini App (WebApp)                          │
├─────────────────────────────────────────────────────────────────┤
│  Home  │  Themes  │  Story  │  Leaderboard  │  Profile          │
└────────┬────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│  MiniApp APIs    │────▶│  Auth Middleware │
│  /api/miniapp/*  │     │  initData valid  │
└────────┬─────────┘     └──────────────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│  Business Logic  │────▶│  QueryCache      │
│  StoryManager    │     │  (In-Memory)     │
│  EventManager    │     └──────────────────┘
│  LeaderboardMgr  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│  Supabase        │────▶│  Upstash Redis   │
│  (PostgreSQL)    │     │  (Rate Limits)   │
└──────────────────┘     └──────────────────┘
\`\`\`

---

## Caching Strategy

### Layer 1: In-Memory (QueryCache)

| Key Pattern | TTL | Descrizione |
|-------------|-----|-------------|
| `user_progress:{userId}` | 30s | Progresso utente |
| `chapter:{theme}:{num}` | 300s | Contenuto capitolo |
| `chapters_count:{theme}` | 300s | Conteggio capitoli |
| `telegram_user:{telegramId}` | 60s | Dati utente Telegram |

### Layer 2: Upstash Redis (KV)

Usato per:
- Rate limiting distribuito
- Session state
- Anti-replay tokens

---

## Environment Variables

### Required

| Variable | Descrizione |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Token bot Telegram |
| `TELEGRAM_WEBHOOK_SECRET` | Secret per validazione webhook |
| `SUPABASE_URL` | URL Supabase |
| `SUPABASE_ANON_KEY` | Chiave anonima |
| `SUPABASE_SERVICE_ROLE_KEY` | Chiave service role |
| `APP_DOMAIN` | Dominio app (per Mini App URL) |
| `BOT_USERNAME` | Username bot (senza @) |
| `KV_REST_API_URL` | URL Upstash Redis |
| `KV_REST_API_TOKEN` | Token Upstash Redis |

### Optional

| Variable | Default | Descrizione |
|----------|---------|-------------|
| `RATE_LIMIT_DAILY_MAX` | 50 | Limite richieste giornaliere |
| `RATE_LIMIT_HOURLY_MAX` | 10 | Limite richieste orarie |
| `RATE_LIMIT_BURST_MAX` | 3 | Burst limit |
| `DISABLE_RATE_LIMITS` | false | Disabilita rate limiting |
| `INLINE_CACHE_TIME` | 300 | Cache inline query (sec) |
| `DEBUG_ADMIN_KEY` | - | Chiave admin debug |
| `ENABLE_DEBUG_ROUTES` | false | Abilita route debug |
| `LOG_LEVEL` | info | Livello log |

---

## Sicurezza

### Autenticazione

1. **Webhook**: Validazione `x-telegram-bot-api-secret-token`
2. **Mini App**: Validazione `initData` con HMAC-SHA256
3. **Admin**: `DEBUG_ADMIN_KEY` per endpoint debug

### Anti-Cheat

1. **PP Validation**: Valori PP ammessi solo [3, 4, 5, 6]
2. **PP Rate Limits**: Max 100 PP/ora, 500 PP/giorno
3. **PP Audit Trail**: Ogni PP guadagnato viene loggato
4. **Anti-Replay**: Callback query IDs non riutilizzabili

### Rate Limiting

- Rate limit giornaliero per utente
- Burst protection
- Fail-open su errori database (per UX)
