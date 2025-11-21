# 🎭 King of Carts - Telegram Storytelling Bot

Un bot Telegram avanzato per storytelling interattivo che utilizza AI per generare storie infinite attraverso 7 temi narrativi diversi con sistema di progressione e punteggio.

## 📋 Panoramica del Progetto

King of Carts è una piattaforma completa di storytelling interattivo che combina:
- **Narrativa AI-powered** con generazione dinamica di contenuti
- **Sistema di gamification** con punteggi e classifiche
- **Sicurezza enterprise-grade** con rate limiting e anti-replay
- **Dashboard amministrativa** per monitoring e gestione
- **Architettura scalabile** su Next.js + Supabase

## 🏗️ Architettura del Sistema

### Core Components

#### 1. **API Telegram Handler** (`/app/api/telegram/route.tsx`)
- **Webhook Management**: Gestione sicura degli aggiornamenti Telegram
- **Command Processing**: Elaborazione comandi (`/start`, `/help`, `/stats`, `/continue`, `/reset`, `/leaderboard`)
- **Interactive Callbacks**: Gestione scelte narrative e navigazione menu
- **Inline Queries**: Sistema condivisione e inviti
- **Error Recovery**: Fallback automatici e gestione errori robusti

#### 2. **Story Management System** (`/lib/story/`)

**StoryManager** (`story-manager.ts`):
- Gestione progressi utente per 7 temi narrativi
- Sistema ibrido: capitoli predefiniti + generazione AI infinita
- Calcolo punteggio PP (Punti Psichedelici) basato su scelte
- Tracking completamento capitoli e avanzamento temi
- Statistiche dettagliate utente e globali

**SessionManager** (`session-manager.ts`):
- Sessioni in-memory per gameplay attivo
- Timeout automatico (30 minuti) con cleanup
- Tracking scena corrente e PP accumulati
- Gestione stato persistente tra interazioni

#### 3. **Security Layer** (`/lib/security/`)

**RateLimiter** (`rate-limiter.ts`):
- Limite giornaliero configurabile (default: 20 richieste/giorno)
- Integrazione nativa Supabase con funzioni RPC
- Timezone Amsterdam per reset giornaliero corretto
- Bypass configurabile per testing e debug

**AntiReplay** (`anti-replay.ts`):
- Prevenzione spam callback query con token unici
- Scadenza automatica token (5 minuti)
- Cleanup periodico per ottimizzazione memoria

#### 4. **Leaderboard System** (`/lib/leaderboard/`)
- **Formula Punteggio**: `(Capitoli × 10) + (Temi × 100) + PP_totali`
- Classifica globale con ranking personalizzato
- Statistiche aggregate sistema
- Aggiornamento real-time con ogni completamento

#### 5. **Debug Dashboard** (`/components/debug/`)
- **Autenticazione**: Protezione admin key (32 caratteri)
- **System Health**: Monitoring real-time performance
- **Database Viewer**: Esplorazione tabelle e dati
- **AI Story Generator**: Generazione capitoli con xAI
- **Webhook Testing**: Simulazione e test endpoint
- **Migration Tools**: Gestione aggiornamenti schema

## 🗄️ Database Schema

### Tabelle Principali

\`\`\`sql
-- Utenti Telegram registrati
users (id, telegram_id, username, first_name, created_at, last_active)

-- Progressi per tema con statistiche dettagliate  
user_progress (user_id, theme, current_chapter, completed_chapters, total_pp, created_at, updated_at)

-- Statistiche aggregate sistema
global_stats (stat_name, stat_value, updated_at)

-- Rate limiting giornaliero
rate_limits (user_id, request_count, last_request, reset_date)

-- Capitoli generati da AI
generated_chapters (id, theme, chapter_number, title, content, choices, created_at)

-- Nuova struttura capitoli con supporto temi
story_chapters (id, theme, chapter_number, title, content, choices, pp_values)

-- Definizione temi disponibili
themes (id, name, emoji, description, total_chapters)
\`\`\`

### Funzioni Database (RPC)

\`\`\`sql
-- Controllo e aggiornamento rate limiting
check_rate_limit(user_id_param, daily_limit) → boolean

-- Incremento statistiche globali
increment_global_stat(stat_name, increment_value) → void

-- Gestione progressi tema
get_theme_progress(user_id, theme_name) → progress_record
update_theme_progress(user_id, theme_name, chapter, pp) → void

-- Statistiche leaderboard
get_leaderboard_stats(limit_count) → leaderboard_records
\`\`\`

## 🎮 Funzionalità Principali

### Storytelling Interattivo

#### **7 Temi Narrativi**:
- 🏰 **Fantasy**: Avventure magiche e creature leggendarie
- 🚀 **Sci-Fi**: Esplorazione spaziale e tecnologie futuristiche  
- 🔍 **Mystery**: Investigazioni e misteri da risolvere
- 💕 **Romance**: Storie d'amore e relazioni emotive
- ⚔️ **Adventure**: Azione e avventure mozzafiato
- 👻 **Horror**: Suspense e atmosfere inquietanti
- 😄 **Comedy**: Situazioni divertenti e umoristiche

#### **Sistema di Progressione**:
- **Capitoli Predefiniti**: Storie curate manualmente per qualità
- **Generazione AI Infinita**: Continuazione automatica con xAI quando finiscono i capitoli
- **Scelte Multiple**: Ogni scena offre 2-4 opzioni che influenzano la narrativa
- **Punti Psichedelici (PP)**: Sistema punteggio basato su creatività delle scelte
- **Avanzamento Automatico**: Progressione fluida tra capitoli e temi

### Sistema Utente e Gamification

#### **Profilo Utente**:
- Registrazione automatica al primo utilizzo
- Statistiche personali: capitoli completati, temi esplorati, PP totali
- Progressi indipendenti per ogni tema
- Sessioni persistenti con ripresa automatica

#### **Leaderboard e Achievements**:
- Classifica globale pubblica con punteggi
- Sistema ranking basato su completamento e creatività
- Condivisione risultati tramite inline query
- Inviti amici per crescita organica community

### Sicurezza e Performance

#### **Protezione Anti-Abuse**:
- Rate limiting giornaliero per prevenire spam
- Sistema anti-replay per callback query duplicate
- Validazione rigorosa input utente
- Monitoring automatico tentativi abuso

#### **Monitoring e Observability**:
- Dashboard amministrativa completa
- Metriche real-time: utenti attivi, performance, errori
- Logging strutturato per debugging
- Alerting automatico per problemi critici

## 🛠️ Stack Tecnologico

### Backend
- **Framework**: Next.js 14 con App Router
- **Database**: Supabase (PostgreSQL) con Row Level Security
- **AI**: xAI (Grok) per generazione storie
- **Authentication**: Supabase Auth per dashboard admin

### Frontend  
- **UI Framework**: React 18 con TypeScript
- **Styling**: Tailwind CSS v4 con design system custom
- **Components**: Radix UI per accessibilità
- **Charts**: Recharts per visualizzazioni dati

### Infrastructure
- **Deployment**: Vercel con edge functions
- **Monitoring**: Dashboard integrata + Vercel Analytics
- **Security**: Environment variables + webhook validation
- **Performance**: Caching intelligente + ottimizzazioni bundle

## 🚀 Setup e Configurazione

### Prerequisiti
- Node.js 18+
- Account Telegram Bot (BotFather)
- Progetto Supabase
- Account xAI per generazione storie
- Account Vercel per deployment

### Variabili Ambiente

\`\`\`env
# Telegram Configuration
TELEGRAM_BOT_TOKEN=<your-bot-token>
TELEGRAM_WEBHOOK_SECRET=<webhook-secret-32-chars>

# Bot Configuration
BOT_USERNAME=<your-bot-username>  # es: kingofcarts_betabot
BOT_DISPLAY_NAME=<bot-display-name>  # es: King of Carts
APP_DOMAIN=<your-app-domain>  # es: https://your-app.vercel.app
INLINE_CACHE_TIME=10  # Cache time for inline queries in seconds

# Supabase Configuration  
SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_URL=<same-as-above>
SUPABASE_ANON_KEY=<your-anon-key>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<same-as-above>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# Security Configuration
DEBUG_ADMIN_KEY=<32-character-admin-key>
RATE_LIMIT_DAILY_MAX=20
DISABLE_RATE_LIMITS=false

# AI Configuration
XAI_API_KEY=<your-xai-api-key>
\`\`\`

### Installazione

1. **Clone e Setup**:
\`\`\`bash
git clone <repository>
cd telegram-storytelling-bot
npm install
\`\`\`

2. **Database Setup**:
\`\`\`bash
# Eseguire script SQL in ordine numerico
# 001_create_users_table.sql → 017_final_cleanup.sql
\`\`\`

3. **Configurazione Bot**:
\`\`\`bash
# Accedere alla dashboard debug: /debug
# Configurare webhook Telegram
# Impostare comandi menu bot
# Importare storie iniziali
\`\`\`

4. **Deploy**:
\`\`\`bash
vercel --prod
# Configurare webhook URL in Telegram
\`\`\`

### Configurazione Avanzata

#### **Webhook Telegram**:
- URL: `https://your-domain.vercel.app/api/telegram`
- Secret Token: Valore di `TELEGRAM_WEBHOOK_SECRET`
- Allowed Updates: `["message", "callback_query", "inline_query"]`

#### **Inline Mode Setup**:
Per abilitare la condivisione tramite inline mode:
1. Contatta @BotFather su Telegram
2. Usa il comando `/setinline`
3. Seleziona il tuo bot
4. Imposta il placeholder: "Condividi King of Carts..."
5. Il bot ora supporta `@yourbotname` nelle chat

#### **Comandi Bot**:
\`\`\`
start - Inizia una nuova avventura
help - Mostra aiuto e istruzioni  
stats - Visualizza le tue statistiche
continue - Continua la storia corrente
reset - Ricomincia tema corrente
leaderboard - Classifica globale giocatori
\`\`\`

#### **Menu Inline**:
- Temi disponibili con emoji e descrizioni
- Statistiche utente in tempo reale
- Accesso rapido a leaderboard e aiuto

## 📊 Monitoring e Metriche

### Dashboard Amministrativa (`/debug`)

#### **System Health**:
- Uptime e performance API
- Statistiche database (connessioni, query time)
- Rate limiting status e violazioni
- Error rate e log recenti

#### **User Analytics**:
- Utenti registrati e attivi
- Distribuzione per tema preferito
- Engagement metrics (sessioni, completamenti)
- Retention rate e churn analysis

#### **Content Metrics**:
- Capitoli più popolari per tema
- Scelte utente più frequenti
- Performance generazione AI
- Qualità contenuti generati

### Alerting e Notifiche

#### **Soglie Critiche**:
- Error rate > 5%
- Response time > 2s
- Rate limit violations > 100/ora
- Database connections > 80%

#### **Notifiche Automatiche**:
- Webhook failures
- Database migration needs
- Security incidents
- Performance degradation

## 🔒 Sicurezza e Privacy

### Data Protection
- **Minimizzazione Dati**: Solo dati essenziali per funzionalità
- **Encryption**: Tutti i dati sensibili crittografati at-rest
- **Access Control**: RLS policies per isolamento utenti
- **Audit Trail**: Logging completo per compliance

### Security Measures
- **Input Validation**: Sanitizzazione rigorosa input utente
- **Rate Limiting**: Protezione da abuse e DoS
- **Webhook Validation**: Verifica autenticità richieste Telegram
- **Admin Authentication**: Accesso dashboard protetto da chiave

### Privacy Compliance
- **Data Retention**: Cleanup automatico dati obsoleti
- **User Rights**: Possibilità reset/cancellazione dati
- **Transparency**: Logging chiaro utilizzo dati
- **Consent**: Informativa privacy integrata

## 🚀 Roadmap e Sviluppi Futuri

### Versione Beta (Attuale)
- ✅ Core storytelling con 7 temi
- ✅ Sistema punteggio e leaderboard  
- ✅ Sicurezza e rate limiting
- ✅ Dashboard amministrativa
- ✅ Generazione AI infinita

### Versione 1.0 (Q1 2025)
- 🔄 Multiplayer stories (storie collaborative)
- 🔄 Custom themes (temi personalizzati utenti)
- 🔄 Achievement system avanzato
- 🔄 Social features (follow, share, comments)
- 🔄 Mobile app companion

### Versione 2.0 (Q2 2025)
- 🔄 Voice narration (sintesi vocale)
- 🔄 Image generation (illustrazioni AI)
- 🔄 Advanced AI (GPT-4, Claude integration)
- 🔄 Monetization (premium themes, features)
- 🔄 Analytics dashboard pubblico

## 🤝 Contributi e Supporto

### Development
- **Issues**: Segnalazione bug e feature request
- **Pull Requests**: Contributi codice con review process
- **Documentation**: Miglioramenti documentazione
- **Testing**: Test coverage e quality assurance

### Community
- **Discord**: Community sviluppatori e utenti
- **Telegram**: Canale aggiornamenti e supporto
- **Blog**: Tutorial e case studies
- **Newsletter**: Aggiornamenti mensili progetto

---

## 📄 Licenza

MIT License - Vedi file `LICENSE` per dettagli completi.

## 🙏 Ringraziamenti

- **Telegram Bot API** per la piattaforma robusta
- **Supabase** per database e auth seamless  
- **xAI** per capacità generazione storie
- **Vercel** per deployment e performance
- **Community Open Source** per librerie e supporto

---

**King of Carts** - Dove ogni storia è un'avventura infinita 🎭✨
