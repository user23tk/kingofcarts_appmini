# 🤖 King of Carts - Telegram Bot Setup

Guida completa per configurare correttamente il bot Telegram per King of Carts.

## 📋 Prerequisiti

- Bot Token da [@BotFather](https://t.me/BotFather)
- App deployata su Vercel (o altro hosting)
- Variabili d'ambiente configurate

## 🚀 Setup Automatico (Consigliato)

### 1. Configura il Bot Automaticamente

Visita questo endpoint per configurare tutto automaticamente:

\`\`\`
POST https://your-domain.vercel.app/api/debug/configure-bot
\`\`\`

Oppure usa il browser:

\`\`\`
GET https://your-domain.vercel.app/api/debug/configure-bot
\`\`\`

Questo configurerà:
- ✅ Comandi del bot (/start, /help, etc.)
- ✅ Descrizione del bot
- ✅ Short description
- ✅ Inline mode enhancement

### 2. Configura il Webhook

Visita:

\`\`\`
POST https://your-domain.vercel.app/api/debug/fix-bot
\`\`\`

Questo configurerà:
- ✅ Webhook URL
- ✅ Webhook secret token
- ✅ Allowed updates

## 🛠️ Setup Manuale su @BotFather

Anche dopo il setup automatico, devi configurare queste cose manualmente su @BotFather:

### 1. Abilita Inline Mode

**OBBLIGATORIO** per la condivisione del gioco!

\`\`\`
1. Apri @BotFather
2. Invia: /setinline
3. Seleziona il tuo bot
4. Inserisci: "Condividi King of Carts con i tuoi amici! 🎭"
\`\`\`

### 2. Configura il Menu Button

Questo crea un bottone sempre visibile per aprire la Mini App:

\`\`\`
1. @BotFather
2. /mybots → Seleziona bot → Bot Settings
3. Menu Button → Configure menu button
4. Button text: 🎮 Gioca
5. URL: https://your-domain.vercel.app
\`\`\`

### 3. (Opzionale) Abilita Inline Feedback

Per analytics migliori:

\`\`\`
1. @BotFather → /mybots → Bot → Bot Settings
2. Inline Feedback
3. Abilita e imposta 100%
\`\`\`

### 4. (Opzionale) Imposta Bot Picture

Carica un'immagine per il profilo del bot:

\`\`\`
1. @BotFather → /mybots → Bot → Edit Bot
2. Edit Botpic
3. Carica immagine (512x512 px consigliato)
\`\`\`

### 5. (Opzionale) Configura About Section

\`\`\`
1. @BotFather → /setabouttext
2. Seleziona bot
3. Inserisci testo (max 120 caratteri)
\`\`\`

## 🎮 Come Funziona il Bot

### Architettura Mini App

Il bot NON gestisce più il gioco tramite messaggi e bottoni. Invece:

1. **Tutti i comandi** (`/start`, `/stats`, etc.) aprono la **Mini App**
2. Il gioco vero e proprio avviene nella **Mini App** (interfaccia web)
3. I **callback** dei vecchi bottoni sono stati **rimossi**
4. L'**inline mode** permette di condividere progressi e inviti

### Flusso Utente

\`\`\`
1. Utente invia /start
   ↓
2. Bot risponde con messaggio + bottone "web_app"
   ↓
3. Utente clicca il bottone
   ↓
4. Si apre la Mini App (full screen)
   ↓
5. Utente gioca nella Mini App
   ↓
6. I dati vengono salvati su Supabase
   ↓
7. Utente può condividere tramite inline mode
\`\`\`

### Inline Mode

Quando l'utente scrive `@your_bot` in una chat:

\`\`\`
Input: @kingofcarts_betabot
         ↓
Output: 5 opzioni di condivisione:
- 🎭 Invito generale
- 📊 Condividi progressi
- ⚔️ Sfida amici
- 🏰 Tema specifico
- 🏆 Classifica
\`\`\`

## 🔧 Comandi Disponibili

| Comando | Descrizione | Azione |
|---------|-------------|--------|
| `/start` | Avvia il bot | Mostra messaggio di benvenuto + bottone Mini App |
| `/help` | Mostra aiuto | Spiega come giocare + bottone Mini App |
| `/stats` | Vedi statistiche | Apre Mini App su pagina statistiche |
| `/leaderboard` | Classifica | Apre Mini App su classifica |
| `/event` | Evento attivo | Apre Mini App su evento corrente |

Tutti i comandi **aprono la Mini App** - non c'è più interazione via messaggi!

## 🧪 Testing

### Test /start

\`\`\`
1. Apri chat con il bot
2. Invia /start
3. Dovresti vedere:
   - Messaggio di benvenuto
   - Bottone "🎮 Apri King of Carts"
4. Clicca il bottone
5. La Mini App si apre
\`\`\`

### Test Inline Mode

\`\`\`
1. Apri qualsiasi chat (anche con te stesso)
2. Scrivi @your_bot
3. Dovresti vedere 5 risultati
4. Selezionane uno
5. Invia il messaggio
6. Il destinatario vede bottoni per giocare
\`\`\`

### Verifica Webhook

Visita:

\`\`\`
GET https://your-domain.vercel.app/api/debug/bot-status
\`\`\`

Dovresti vedere:
- ✅ `webhook.url` impostato correttamente
- ✅ `webhook.pending_update_count` = 0
- ✅ `botInfo.supports_inline_queries` = true
- ❌ NO `webhook.last_error_message`

## 🐛 Troubleshooting

### Problema: /start non funziona

**Causa**: Webhook non configurato correttamente

**Soluzione**:
\`\`\`
POST https://your-domain.vercel.app/api/debug/fix-bot
\`\`\`

### Problema: Inline mode non funziona

**Causa**: Non abilitato su @BotFather

**Soluzione**:
\`\`\`
1. @BotFather → /setinline
2. Abilita inline mode
\`\`\`

### Problema: Mini App non si apre

**Causa**: URL non corretto

**Soluzione**:
1. Verifica `APP_DOMAIN` in env vars
2. Assicurati che sia HTTPS
3. Rimuovi trailing slash dall'URL

### Problema: Webhook error 308

**Causa**: Doppio slash nell'URL

**Soluzione**: Usa `/api/debug/fix-bot` per correggere

### Problema: "Game Mode" abilitato

**Non è un problema!** Telegram supporta sia:
- **Game Mode** (vecchio sistema per giochi HTML5 semplici)
- **Mini Apps** (nuovo sistema, quello che usiamo)

Puoi lasciare Game Mode abilitato, non interferisce con le Mini Apps.

## 📊 Monitoring

### Check Status

\`\`\`bash
curl https://your-domain.vercel.app/api/debug/bot-status
\`\`\`

### Check Configuration

\`\`\`bash
curl https://your-domain.vercel.app/api/debug/configure-bot
\`\`\`

## 🔒 Security

- ✅ Webhook protetto con `secret_token`
- ✅ Rate limiting su tutti gli endpoint
- ✅ Anti-replay protection sui callback
- ✅ PP validation con audit trail
- ✅ CORS configurato correttamente

## 📚 Risorse Utili

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Telegram Mini Apps](https://core.telegram.org/bots/webapps)
- [Inline Mode](https://core.telegram.org/bots/inline)
- [@BotFather](https://t.me/BotFather)

## ✅ Checklist Finale

Prima di andare in produzione:

- [ ] Bot token configurato
- [ ] Webhook configurato e funzionante
- [ ] Inline mode abilitato su @BotFather
- [ ] Menu button configurato
- [ ] Comandi testati (/start, /help, etc.)
- [ ] Inline mode testato
- [ ] Mini App si apre correttamente
- [ ] Database connesso (Supabase)
- [ ] Rate limiting attivo
- [ ] Monitoring configurato

---

**Fatto!** 🎉 Il tuo bot è ora configurato correttamente come Mini App!
