# 🤖 King of Carts Bot - Configurazione

## Variabili d'Ambiente Richieste

### Autenticazione Debug
\`\`\`env
DEBUG_ADMIN_KEY=<chiave-generata-32-caratteri>
\`\`\`
- **Scopo**: Proteggere l'accesso alla dashboard `/debug` e tutti gli endpoint `/api/debug/*`
- **Formato**: 32 caratteri alfanumerici
- **Generazione**: Usa `node scripts/generate-admin-key.js`
- **Sicurezza**: ⚠️ Mai esporre pubblicamente, rigenera ogni 90 giorni

### JWT Secret (NUOVO)
\`\`\`env
JWT_SECRET=<your-jwt-secret-32-chars>
\`\`\`
- **Scopo**: Firma dei token JWT per autenticazione Mini App
- **Formato**: 32+ caratteri random
- **Generazione**: `openssl rand -base64 32`
- **Fallback**: Usa `TELEGRAM_WEBHOOK_SECRET` se non impostato (non raccomandato)

### Rate Limiting
\`\`\`env
DISABLE_RATE_LIMITS=false
\`\`\`
- **Scopo**: Controllo globale del rate limiting
- **Valori**: 
  - `false` (default): Rate limiting attivo
  - `true`: Rate limiting disattivato (solo per test)
- **⚠️ ATTENZIONE**: Mai impostare a `true` in produzione

### Rate Limiting Configurabile
\`\`\`env
RATE_LIMIT_DAILY_MAX=20
RATE_LIMIT_HOURLY_MAX=10
RATE_LIMIT_BURST_MAX=3
RATE_LIMIT_BURST_WINDOW_SECONDS=60
CALLBACK_TOKEN_EXPIRY_MINUTES=5
\`\`\`

## ✅ Verifica Configurazione

1. **Dashboard Debug**: Accedi a `/debug` con la tua admin key
2. **Rate Limiting**: Controlla lo stato nel tab "Rate Limiting"
3. **Bot Commands**: Configura i comandi del menu Telegram
4. **Webhook**: Verifica che il webhook sia configurato correttamente

## 🔒 Sicurezza

### Protezione Endpoint Debug
Tutti gli endpoint `/api/debug/*` ora richiedono autenticazione:

**Metodi di autenticazione**:
1. Header `x-admin-key: <your-admin-key>`
2. Bearer token `Authorization: Bearer <your-admin-key>`

**Rate limiting**:
- 5 tentativi falliti per IP ogni 5 minuti
- Logging automatico di tutti i tentativi falliti

### Security Headers
Il progetto ora include security headers completi:
- `Strict-Transport-Security`: Forza HTTPS
- `X-Frame-Options`: Protezione clickjacking
- `X-Content-Type-Options`: Previene MIME sniffing
- `X-XSS-Protection`: Protezione XSS
- `Content-Security-Policy`: Policy restrittive per API

### Best Practices
- ⚠️ **Mai** esporre `DEBUG_ADMIN_KEY` pubblicamente
- 🧪 Usa `DISABLE_RATE_LIMITS=true` solo per test locali
- 📊 Monitora i log di sicurezza nella dashboard debug
- 🔄 Rigenera `DEBUG_ADMIN_KEY` ogni 90 giorni
- 🔐 Usa `JWT_SECRET` dedicato invece del webhook secret
- 📝 Rivedi regolarmente gli audit logs

### Audit Logging
Tutte le operazioni sensibili sono ora registrate:
- Accessi alla dashboard debug
- Tentativi di autenticazione falliti
- Operazioni di modifica dati
- Accessi agli endpoint protetti

Vedi `SECURITY.md` per la documentazione completa sulla sicurezza.

## 🚀 Setup Iniziale

1. Genera le chiavi di sicurezza:
\`\`\`bash
# Admin key per debug dashboard
node scripts/generate-admin-key.js

# JWT secret
openssl rand -base64 32
\`\`\`

2. Aggiungi le variabili d'ambiente al tuo progetto Vercel

3. Verifica la configurazione accedendo a `/debug`

4. Configura il webhook Telegram dalla dashboard debug

## 📚 Documentazione Aggiuntiva

- `SECURITY.md` - Documentazione completa sulla sicurezza
- `README.md` - Guida generale del progetto
- `BETA_LAUNCH_CHECKLIST.md` - Checklist pre-lancio

## 📊 Database Schema Notes

### User Progress Fields

**Primary Fields (Use These):**
- `chapters_completed` - Total chapters completed across all themes
- `themes_completed` - Number of themes fully completed
- `theme_progress` - JSONB with per-theme progress details

**Deprecated Fields (Do Not Use):**
- `total_chapters_completed` - DEPRECATED, use `chapters_completed` instead
- Kept for backward compatibility only
- Automatically synced via database trigger

**Important:**
- Always use `chapters_completed` in new code
- Database trigger automatically syncs `theme_progress` with aggregate columns
- No manual synchronization needed

### Foreign Key Behavior

**CASCADE DELETE** (data removed with user):
- User progress, sessions, leaderboard entries

**SET NULL** (audit trail preserved):
- Audit logs, security events

### Performance Considerations

The database includes optimized indexes for:
- Leaderboard queries (composite index)
- JSONB theme_progress queries (GIN index)
- Foreign key lookups (standard indexes)

See `scripts/026_fix_database_inconsistencies.sql` for implementation details.
