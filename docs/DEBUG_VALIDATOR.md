# 🔍 Debug Validator - Guida all'Uso

## Panoramica

Il Debug Validator è uno strumento integrato nella pagina di debug (`/debug`) che permette di verificare e validare il sistema di ranking PP-first e le statistiche utente.

## Accesso

1. Naviga a `/debug`
2. Effettua l'autenticazione con le credenziali di debug
3. Seleziona la tab "Validator" o trova la sezione "Rank Calculation Debugger"

## Funzionalità Principali

### 1. Rank Calculation Debugger (PP-First)

Questo strumento permette di testare il calcolo del rank per qualsiasi utente usando il nuovo algoritmo PP-first.

#### Input
- **User ID (UUID)**: L'ID univoco dell'utente nel database
- **Telegram ID**: In alternativa, puoi inserire il Telegram ID dell'utente

#### Output
Il debugger mostra:

1. **User Stats Summary** (da LeaderboardManager):
   - Total PP (metrica primaria)
   - Rank attuale
   - Themes completati
   - Chapters completati

2. **Confronto tra sistemi**:
   - **RPC Result**: Risultato diretto dalla funzione `get_user_rank`
   - **API Result**: Risultato dall'endpoint `/api/miniapp/dashboard`
   - **LeaderboardManager Result**: Risultato dal metodo centralizzato

3. **Validazione**:
   - Badge verde "All Match" se tutti i valori coincidono
   - Badge rosso "Mismatch" se ci sono discrepanze
   - Avviso giallo se l'utente ha 0 PP (non classificato)

### 2. Come Usare il Validator

#### Test con User ID:
```
1. Inserisci l'UUID dell'utente (es: 123e4567-e89b-12d3-a456-426614174000)
2. Clicca "Test Rank & Stats"
3. Analizza i risultati
```

#### Test con Telegram ID:
```
1. Inserisci il Telegram ID numerico (es: 123456789)
2. Il sistema convertirà automaticamente in User ID
3. Clicca "Test Rank & Stats"
4. Analizza i risultati
```

### 3. Interpretazione dei Risultati

#### Caso 1: Utente con PP > 0
```json
{
  "totalPP": 150,
  "rank": 5,
  "themesCompleted": 2,
  "chaptersCompleted": 15
}
```
✅ L'utente è classificato in base ai suoi PP

#### Caso 2: Utente con PP = 0
```json
{
  "totalPP": 0,
  "rank": 0,
  "themesCompleted": 1,
  "chaptersCompleted": 5
}
```
⚠️ L'utente non è in classifica perché ha 0 PP (anche se ha progressi)

#### Caso 3: Mismatch tra sistemi
Se vedi discrepanze tra RPC, API e LeaderboardManager:
- 🔴 Potrebbe esserci un problema di cache
- 🔴 La migration potrebbe non essere stata applicata
- 🔴 Ci potrebbe essere un bug nel codice

### 4. Troubleshooting

#### "User not found"
- Verifica che l'ID sia corretto
- Controlla che l'utente esista nel database

#### Rank = 0 con PP > 0
- La migration `040_leaderboard_pp_first.sql` potrebbe non essere stata eseguita
- Verifica che le funzioni RPC siano aggiornate

#### Valori non corrispondenti
- Pulisci la cache con il pulsante "Clear Cache" (se disponibile)
- Ricarica la pagina e riprova
- Verifica i log del server per errori

## API Endpoints Utilizzati

Il validator utilizza questi endpoint:

1. `/api/debug/test-rank-rpc` - Test diretto della funzione RPC
2. `/api/miniapp/dashboard` - API principale della dashboard
3. `/api/debug/user-stats` - Stats da LeaderboardManager
4. `/api/debug/get-user-by-telegram` - Conversione Telegram ID → User ID

## Note Importanti

- Il ranking è ora basato su **PP come metrica primaria**
- Utenti con 0 PP non appaiono in classifica
- Themes e chapters sono solo tie-breaker
- La cache può influenzare i risultati per 5 minuti

---

Per assistenza tecnica, consultare il file `LEADERBOARD_ANALYSIS (1).md` nella cartella docs.