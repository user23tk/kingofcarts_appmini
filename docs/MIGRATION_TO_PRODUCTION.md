# Migrazione dal Bot Beta al Bot Ufficiale

Questa guida ti aiuterà a trasferire la Mini App da `@kingofcarts_betabot` al bot ufficiale `@kingofcartsbot` (o qualsiasi altro bot).

## Prerequisiti

1. Bot Telegram ufficiale già creato su @BotFather
2. Token del bot ufficiale disponibile
3. Accesso alle environment variables su Vercel

---

## PASSO 1: Creare il Bot Ufficiale su BotFather (se non l'hai già)

Se hai già il bot ufficiale, vai al **PASSO 2**.

1. Apri Telegram e cerca `@BotFather`
2. Invia il comando `/newbot`
3. Segui le istruzioni:
   - Nome del bot: `King of Carts` (o quello che preferisci)
   - Username: `kingofcartsbot` (deve finire con "bot")
4. **Salva il token** che ti viene dato (es: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

---

## PASSO 2: Configurare il Bot su BotFather

Esegui questi comandi su @BotFather per configurare il bot:

### 2.1 Abilita Inline Mode
\`\`\`
/setinline
Seleziona: @kingofcartsbot
Testo placeholder: Condividi King of Carts con i tuoi amici!
\`\`\`

### 2.2 Configura la Descrizione
\`\`\`
/setdescription
Seleziona: @kingofcartsbot
Descrizione:
King of Carts - Un gioco di storytelling interattivo con AI! 🎭

Esplora 7 temi diversi, fai scelte importanti, guadagna PP e scala la classifica globale!

🏰 Fantasia • 🚀 Sci-Fi • 🔍 Mistero • 💕 Romantico
🗺️ Avventura • 👻 Horror • 😂 Commedia
\`\`\`

### 2.3 Configura l'About (breve descrizione)
\`\`\`
/setabouttext
Seleziona: @kingofcartsbot
Testo:
🎭 Storytelling interattivo con AI - 7 temi, scelte infinite, storie generate in tempo reale!
\`\`\`

### 2.4 Configura il Menu Button (opzionale ma consigliato)
\`\`\`
/setmenubutton
Seleziona: @kingofcartsbot
Button type: Web App
Button text: 🎮 Gioca
URL: https://v0-beta-3-mini-app.vercel.app
\`\`\`

### 2.5 Configura l'immagine del profilo (opzionale)
\`\`\`
/setuserpic
Seleziona: @kingofcartsbot
Carica un'immagine 640x640 px con il logo del gioco
\`\`\`

---

## PASSO 3: Aggiornare le Environment Variables su Vercel

### Opzione A: Tramite Dashboard Vercel (Consigliato)

1. Vai su [vercel.com](https://vercel.com) e apri il progetto
2. Vai su **Settings → Environment Variables**
3. Aggiorna queste variabili (o creale se non esistono):

\`\`\`bash
# Bot Configuration
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz  # Il nuovo token
BOT_USERNAME=kingofcartsbot  # Senza @
BOT_DISPLAY_NAME=King of Carts

# Webhook Secret (genera una nuova stringa casuale)
TELEGRAM_WEBHOOK_SECRET=nuova_stringa_casuale_sicura_minimo_32_caratteri

# App Domain (aggiorna se cambi dominio)
APP_DOMAIN=https://v0-beta-3-mini-app.vercel.app
\`\`\`

4. **IMPORTANTE**: Applica a tutti gli environment (Production, Preview, Development)
5. Clicca **Save**

### Opzione B: Tramite CLI Vercel

\`\`\`bash
# Installa Vercel CLI se non l'hai già
npm i -g vercel

# Login
vercel login

# Link al progetto
vercel link

# Aggiungi le variabili
vercel env add TELEGRAM_BOT_TOKEN
# Incolla il nuovo token quando richiesto

vercel env add BOT_USERNAME
# Inserisci: kingofcartsbot

vercel env add BOT_DISPLAY_NAME
# Inserisci: King of Carts

vercel env add TELEGRAM_WEBHOOK_SECRET
# Inserisci una nuova stringa casuale
\`\`\`

---

## PASSO 4: Rideploy dell'applicazione

Dopo aver aggiornato le environment variables, devi fare un redeploy:

### Via Dashboard Vercel
1. Vai su **Deployments**
2. Trova l'ultimo deployment di successo
3. Clicca sui tre puntini (...) → **Redeploy**
4. Seleziona **Use existing build cache** → **Redeploy**

### Via CLI
\`\`\`bash
vercel --prod
\`\`\`

### Via Git
Se hai collegato GitHub/GitLab:
\`\`\`bash
git commit --allow-empty -m "Trigger redeploy for production bot"
git push origin main
\`\`\`

---

## PASSO 5: Configurare il Bot via API

Una volta completato il deploy, configura automaticamente il bot:

### 5.1 Visita l'endpoint di configurazione

Apri nel browser:
\`\`\`
https://v0-beta-3-mini-app.vercel.app/api/debug/configure-bot
\`\`\`

Questo endpoint:
- Configura i comandi del bot
- Imposta descrizioni e metadata
- Verifica che tutto funzioni correttamente

### 5.2 Verifica lo status

Controlla lo status del bot:
\`\`\`
https://v0-beta-3-mini-app.vercel.app/api/debug/bot-status
\`\`\`

Dovresti vedere:
- ✅ Bot username corretto
- ✅ Webhook configurato
- ✅ Inline mode abilitato
- ✅ Comandi configurati

---

## PASSO 6: Testare il Bot

### 6.1 Test del comando /start
1. Cerca `@kingofcartsbot` su Telegram
2. Invia `/start`
3. Dovresti vedere:
   - Un messaggio di benvenuto
   - Un bottone "🎮 Apri King of Carts"
   - Un bottone di condivisione

### 6.2 Test dell'Inline Mode
1. Vai in qualsiasi chat
2. Digita `@kingofcartsbot`
3. Dovresti vedere l'opzione di invito
4. Seleziona e invia il messaggio

### 6.3 Test della Mini App
1. Clicca sul bottone "🎮 Apri King of Carts"
2. La Mini App dovrebbe aprirsi correttamente
3. Verifica che le statistiche si carichino
4. Prova a completare un capitolo

---

## PASSO 7: Aggiornare il Database (se necessario)

Se hai utenti sul bot beta che vuoi trasferire:

### 7.1 Migrazione utenti (opzionale)

\`\`\`sql
-- Questo script NON è necessario se inizi da zero
-- Usa solo se vuoi mantenere i dati del bot beta

-- Verifica gli utenti esistenti
SELECT COUNT(*) FROM users;

-- Se vuoi resettare tutto per il nuovo bot
-- ATTENZIONE: Questo cancella tutti i dati
-- TRUNCATE TABLE user_story_progress CASCADE;
-- TRUNCATE TABLE users CASCADE;
\`\`\`

---

## PASSO 8: Monitoraggio e Troubleshooting

### Endpoint di monitoraggio

- Health check: `https://v0-beta-3-mini-app.vercel.app/api/health`
- Bot status: `https://v0-beta-3-mini-app.vercel.app/api/debug/bot-status`
- Webhook info: Controlla nella risposta del bot-status

### Problemi comuni

#### Il comando /start non funziona
- Verifica che `TELEGRAM_BOT_TOKEN` sia corretto
- Controlla che il webhook sia configurato correttamente
- Esegui `/api/debug/configure-bot` di nuovo

#### L'inline mode non funziona
- Verifica su @BotFather: `/mybots` → seleziona bot → Bot Settings → Inline Mode → deve essere ON
- Controlla che `supports_inline_queries` sia `true` in `/api/debug/bot-status`

#### La Mini App non si apre
- Verifica che `APP_DOMAIN` sia corretto
- Controlla i log su Vercel Dashboard
- Verifica che il dominio sia accessibile pubblicamente

#### Errore 308 Permanent Redirect
- C'è un problema con l'URL del webhook (doppio slash o trailing slash)
- Riesegui `/api/debug/fix-bot` per sistemare

---

## PASSO 9: Disattivare il Bot Beta (opzionale)

Se vuoi disattivare completamente il bot beta:

### Via BotFather
\`\`\`
/mybots
Seleziona: @kingofcarts_betabot
Bot Settings → Transfer Ownership (se vuoi trasferirlo)
OPPURE
/deletebot → @kingofcarts_betabot (per eliminarlo)
\`\`\`

### Mantenere il Beta per test
Puoi anche mantenere il bot beta per test di sviluppo:
1. Crea un nuovo progetto Vercel per il beta
2. Usa environment variables separate
3. Usa un database Supabase separato per il beta

---

## Checklist Finale

Usa questa checklist per verificare che tutto sia configurato:

- [ ] Bot creato su @BotFather
- [ ] Inline mode abilitato su @BotFather
- [ ] Descrizioni configurate su @BotFather
- [ ] Menu button configurato (opzionale)
- [ ] `TELEGRAM_BOT_TOKEN` aggiornato su Vercel
- [ ] `BOT_USERNAME` aggiornato su Vercel
- [ ] `BOT_DISPLAY_NAME` aggiornato su Vercel
- [ ] `TELEGRAM_WEBHOOK_SECRET` generato nuovo
- [ ] Redeploy completato su Vercel
- [ ] `/api/debug/configure-bot` eseguito
- [ ] `/api/debug/bot-status` mostra tutto OK
- [ ] Test `/start` funziona
- [ ] Test inline mode funziona
- [ ] Mini App si apre correttamente
- [ ] Statistiche utente funzionano
- [ ] Completamento capitoli funziona
- [ ] Classifica funziona

---

## Supporto

Se incontri problemi:

1. Controlla i log su Vercel Dashboard → Logs
2. Esegui `/api/debug/bot-status` per diagnostica
3. Consulta `TROUBLESHOOTING.md` per problemi comuni
4. Verifica che tutte le environment variables siano configurate correttamente

---

## Note sulla Produzione

### Rate Limiting
Il bot ha rate limiting configurato. Verifica le impostazioni in:
- `RATE_LIMIT_DAILY_MAX` (default: 100)
- `RATE_LIMIT_HOURLY_MAX` (default: 20)
- `RATE_LIMIT_BURST_MAX` (default: 5)

### Monitoring
Monitora l'applicazione con:
- Vercel Analytics
- Supabase Database logs
- Redis/Upstash monitoring

### Backup
Configura backup regolari del database Supabase prima di andare in produzione.

---

**Congratulazioni! Il tuo bot ufficiale è ora live! 🎉**
