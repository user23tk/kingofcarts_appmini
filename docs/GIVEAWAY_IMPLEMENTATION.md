# Giveaway System - Implementation Guide

## Overview

Il sistema Giveaway MVP consente agli utenti di convertire i loro PP (Power Points) in ticket per partecipare a estrazioni premio.

**Formula base**: `100 PP = 1 Ticket`

## Database Schema

### Tabelle Aggiunte

#### `giveaways`
| Colonna | Tipo | Descrizione |
|---------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Nome del giveaway |
| description | TEXT | Descrizione opzionale |
| pp_per_ticket | INTEGER | PP necessari per 1 ticket (default: 100) |
| prize_title | TEXT | Titolo del premio |
| prize_type | TEXT | Tipo: 'telegram_gift', 'custom', etc. |
| prize_description | TEXT | Descrizione premio |
| prize_image_url | TEXT | URL immagine premio |
| prize_link | TEXT | Link al premio |
| starts_at | TIMESTAMP | Data inizio |
| ends_at | TIMESTAMP | Data fine |
| is_active | BOOLEAN | Stato attivo |
| theme_id | UUID | (Opzionale) Tema collegato |

#### `giveaway_entries`
| Colonna | Tipo | Descrizione |
|---------|------|-------------|
| id | UUID | Primary key |
| giveaway_id | UUID | FK -> giveaways |
| user_id | UUID | FK -> users |
| ticket_number | BIGINT | Numero ticket univoco (da sequence) |
| created_at | TIMESTAMP | Data creazione |

#### `giveaway_results`
| Colonna | Tipo | Descrizione |
|---------|------|-------------|
| id | UUID | Primary key |
| giveaway_id | UUID | FK -> giveaways |
| winner_user_id | UUID | FK -> users |
| winning_ticket_number | BIGINT | Ticket vincente |
| drawn_by_admin_id | UUID | Admin che ha estratto |
| notified | BOOLEAN | Notifica inviata |
| drawn_at | TIMESTAMP | Data estrazione |

### Modifica a `user_progress`
Aggiunto campo `onboarding_bonus_claimed BOOLEAN DEFAULT false` per tracciare il bonus +200 PP.

### Sequence
`giveaway_ticket_numbers` - Sequenza atomica per generare ticket univoci progressivi.

## RPC Functions

### `calculate_user_tickets(p_user_id, p_giveaway_id)`
Calcola i ticket disponibili per un utente.

**Returns**:
\`\`\`json
{
  "success": true,
  "total_pp": 350,
  "pp_per_ticket": 100,
  "tickets_total": 3,
  "tickets_used": 1,
  "tickets_available": 2,
  "pp_for_next_ticket": 50
}
\`\`\`

### `allocate_giveaway_ticket(p_giveaway_id, p_user_id)`
Alloca un singolo ticket a un utente (atomico, thread-safe).

### `grant_onboarding_bonus(p_user_id)`
Concede il bonus +200 PP (idempotente, una sola volta per utente).

### `draw_giveaway_winner(p_giveaway_id, p_admin_user_id)`
Estrae un vincitore casuale tra tutti i ticket del giveaway.

### `get_active_giveaway_for_user(p_user_id)`
Ottiene il giveaway attivo con tutti i dati utente (ticket, vincitore, ecc.).

### `get_giveaway_stats(p_giveaway_id)`
Statistiche admin: partecipanti, ticket totali, media ticket/utente.

### `check_onboarding_bonus_status(p_user_id)`
Verifica se l'utente può richiedere il bonus onboarding.

## API Routes

### Public (Mini App)

| Route | Method | Descrizione |
|-------|--------|-------------|
| `/api/miniapp/giveaway/active` | GET | Giveaway attivo + dati utente |
| `/api/miniapp/giveaway/enter` | POST | Partecipa (alloca 1 ticket) |
| `/api/miniapp/onboarding/bonus` | POST | Richiedi bonus +200 PP |

### Admin (Debug Panel)

| Route | Method | Descrizione |
|-------|--------|-------------|
| `/api/debug/giveaway/list` | GET | Lista tutti i giveaway |
| `/api/debug/giveaway/stats` | GET | Statistiche giveaway |
| `/api/debug/giveaway/draw` | POST | Estrai vincitore |
| `/api/debug/giveaway/create` | POST | Crea nuovo giveaway |

## Componenti UI

### Mini App (`/giveaway`)
- `GiveawayHeader` - Header con countdown timer
- `PrizeCard` - Card premio con immagine
- `TicketBalance` - Bilancio ticket disponibili/usati
- `UserEntries` - Lista ticket dell'utente
- `WinnerBanner` - Banner vincitore (se estratto)
- `OnboardingBonusBanner` - CTA per bonus +200 PP

### Debug Panel
- `GiveawayManager` - Gestione completa giveaway
  - Lista giveaway attivi/chiusi
  - Form creazione nuovo giveaway
  - Statistiche partecipazione
  - Pulsante estrazione vincitore
  - Risultato estrazione con dettagli vincitore

## Flow Utente

1. Utente apre tab "Premi" nella Mini App
2. Vede il giveaway attivo con countdown
3. Vede i suoi ticket disponibili (PP/100)
4. Click "Usa Ticket" -> alloca 1 ticket
5. Può usare il bonus onboarding (+200 PP = +2 ticket)
6. Alla scadenza, admin estrae vincitore
7. Vincitore vede banner congratulazioni

## Flow Admin

1. Apre Debug Dashboard -> Tab "Giveaway"
2. Può creare nuovo giveaway con form
3. Vede statistiche in tempo reale
4. Quando pronto, click "Estrai Vincitore"
5. Sistema estrae 1 ticket random
6. Risultato mostrato con tutti i dettagli

## Scripts da Eseguire

1. `scripts/070_giveaway_schema.sql` - Schema tabelle
2. `scripts/071_giveaway_rpc_functions.sql` - RPC functions
3. `scripts/072_giveaway_seed_test.sql` - (Opzionale) Giveaway test

## Sicurezza

- RLS policies per proteggere i dati
- Trigger per prevenire modifiche ai ticket allocati
- Sequence atomica per unicità ticket
- Validazione PP lato server prima di allocare ticket
- Admin auth richiesta per estrazione

## Note Tecniche

- I PP NON vengono consumati quando si usa un ticket (solo "usati" nel calcolo)
- Un utente può avere più ticket nello stesso giveaway
- Ogni ticket ha probabilità uguale di vincita (1 ticket = 1 entry)
- L'estrazione usa `ORDER BY random() LIMIT 1` per fairness
