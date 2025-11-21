# 🔗 Configurazione Inline Mode per King of Carts

L'inline mode permette agli utenti di condividere il gioco e i loro progressi direttamente in qualsiasi chat di Telegram.

## 🚀 Setup Automatico

1. **Configura i comandi del bot:**
   \`\`\`
   POST /api/debug/configure-inline-mode
   \`\`\`
   Questo endpoint configura automaticamente i comandi del menu del bot.

## 🔧 Setup Manuale Inline Mode

L'inline mode deve essere abilitato manualmente tramite @BotFather:

### Passaggi:

1. **Apri @BotFather su Telegram**
2. **Invia il comando:** `/setinline`
3. **Seleziona il tuo bot** dalla lista
4. **Invia un testo placeholder** come:
   \`\`\`
   Cerca storie e condividi King of Carts...
   \`\`\`
5. **Conferma** - L'inline mode sarà abilitato!

## 🎯 Come Funziona l'Inline Mode

### Per gli Utenti:
- Scrivi `@your_bot_username` in qualsiasi chat
- Digita parole chiave come:
  - `fantasia` - per condividere il tema Fantasia
  - `progressi` - per condividere i propri progressi
  - `sfida` - per sfidare gli amici
  - `invita` - per invitare nuovi giocatori

### Contenuti Condivisibili:

#### 🎭 **Invito Generale**
- Invita amici a giocare a King of Carts
- Include descrizione del gioco e link di avvio
- Mostra il logo del gioco

#### 📊 **Progressi Personali**
- Condivide capitoli completati
- Mostra temi esplorati
- Include PP totali accumulati
- Tema attuale in corso

#### 🏰 **Temi Specifici**
- Condivide inviti per temi specifici (Fantasia, Fantascienza, etc.)
- Include descrizione del tema
- Mostra progressi dell'utente in quel tema

#### ⚔️ **Sfide tra Amici**
- Sfida gli amici a superare i tuoi progressi
- Mostra obiettivi da battere
- Link alla classifica web

## 🛠️ Implementazione Tecnica

### Inline Query Handler
Il bot gestisce le inline query in `app/api/telegram/route.tsx`:

\`\`\`typescript
async function handleInlineQuery(inlineQuery: any) {
  // Processa query dell'utente
  // Genera risultati personalizzati
  // Include thumbnail del logo
  // Aggiunge bottoni di azione
}
\`\`\`

### Tipi di Risultati:
- **article** - Contenuto testuale con markup
- **thumbnail_url** - Logo King of Carts
- **reply_markup** - Bottoni inline per azioni

### Personalizzazione:
- Risultati basati sui progressi dell'utente
- Cache di 5 minuti per performance
- Risultati personali (is_personal: true)

## 🎨 Bottoni di Condivisione

### Nel Menu Principale:
\`\`\`typescript
{ text: "🔗 Condividi Gioco", switch_inline_query: "invita amici" }
\`\`\`

### Nelle Statistiche:
\`\`\`typescript
{ text: "🔗 Condividi Progressi", switch_inline_query: `progressi ${userStats.chaptersCompleted} capitoli` }
\`\`\`

### Nei Temi:
\`\`\`typescript
{ text: "🔗 Condividi", switch_inline_query: "condividi progressi" }
\`\`\`

## 📱 Esperienza Utente

1. **L'utente clicca "Condividi"** → Si apre l'inline mode
2. **Digita parole chiave** → Vede risultati personalizzati
3. **Seleziona contenuto** → Lo condivide nella chat
4. **Gli amici vedono l'invito** → Possono unirsi al gioco

## 🔍 Debug e Test

### Verifica Configurazione:
\`\`\`bash
curl -X POST https://your-domain.com/api/debug/configure-inline-mode
\`\`\`

### Test Inline Mode:
1. Scrivi `@your_bot_username test` in una chat
2. Verifica che appaiano i risultati
3. Testa la condivisione in diverse chat

## 🚨 Troubleshooting

### Inline Mode Non Funziona:
- ✅ Verifica che sia abilitato in @BotFather
- ✅ Controlla che il bot risponda alle inline query
- ✅ Verifica i log del webhook

### Risultati Non Appaiono:
- ✅ Controlla la funzione `handleInlineQuery`
- ✅ Verifica che `answerInlineQuery` sia chiamata
- ✅ Controlla i parametri dei risultati

### Bottoni Non Funzionano:
- ✅ Verifica gli URL dei bottoni
- ✅ Controlla il formato del `reply_markup`
- ✅ Testa i link manualmente

## 🎯 Best Practices

1. **Risultati Veloci** - Cache appropriata (5 min)
2. **Contenuto Rilevante** - Basato sui progressi utente
3. **Thumbnail Consistenti** - Usa sempre il logo
4. **Testi Chiari** - Descrizioni comprensibili
5. **Call-to-Action** - Bottoni che invitano all'azione

## 🔮 Funzionalità Future

- [ ] Condivisione di scene specifiche
- [ ] Inviti a temi completati
- [ ] Statistiche comparative tra amici
- [ ] Condivisione di achievement speciali
- [ ] Modalità torneo tra gruppi
