# Refactoring Log

## Code Smells Risolti

### 1. Supabase Client Creation Duplicata ✅
**Problema**: `createClient()` chiamato in 30+ file diversi
**Soluzione**: 
- Creato hook `useSupabaseBrowser()` per client-side
- Creato utility `getSupabaseServer()` per server-side
- Centralizzata la logica in `lib/hooks/use-supabase.ts`

**Benefici**:
- Memoization automatica per evitare ricreazioni
- Punto unico di configurazione
- Più facile da testare e mockare

### 2. Error Messages Hardcoded ✅
**Problema**: 200+ messaggi di errore sparsi nel codice
**Soluzione**: 
- Creato `lib/constants/errors.ts` con tutti i messaggi
- Tipizzazione TypeScript per autocomplete
- Preparato per i18n futuro

**Benefici**:
- Consistenza nei messaggi
- Facile traduzione
- Manutenzione centralizzata

### 3. Magic Numbers ✅
**Problema**: Numeri hardcoded (3, 6, 7, 8, etc.) senza contesto
**Soluzione**: 
- Creato `lib/constants/game.ts` con tutte le costanti
- Nomi descrittivi (PP_MIN, SCENE_FINAL_INDEX, etc.)
- Valori da environment variables dove appropriato

**Benefici**:
- Codice auto-documentante
- Facile modificare valori di gioco
- Riduce errori di battitura

### 4. Fetch Patterns Ripetuti ✅
**Problema**: 40+ chiamate fetch con stessa struttura
**Soluzione**: 
- Creato `ApiClient` class in `lib/utils/api-client.ts`
- Gestione timeout automatica
- Gestione errori centralizzata
- Supporto query params

**Benefici**:
- Codice DRY
- Timeout configurabile
- Error handling consistente
- Più facile aggiungere interceptors/middleware

### 5. Console.log in Production ✅
**Problema**: 100+ `console.log("[v0] ...")` in produzione
**Soluzione**: 
- Creato sistema `Logger` in `lib/utils/logger.ts`
- Livelli di log (DEBUG, INFO, WARN, ERROR)
- Disabilitato automaticamente in production
- Logger specifici per moduli

**Benefici**:
- Controllo granulare dei log
- Performance migliorate in production
- Formattazione consistente
- Facile debugging

## Prossimi Passi

### Migrazione Graduale
1. **Fase 1**: Nuovi file usano le utilities
2. **Fase 2**: Migrare file critici (API routes)
3. **Fase 3**: Migrare componenti UI
4. **Fase 4**: Cleanup completo

### Breaking Changes
Nessuno - le vecchie implementazioni continuano a funzionare

### Testing
- Testare `ApiClient` con timeout e errori
- Testare `Logger` con diversi livelli
- Verificare che le costanti siano corrette

## Esempi di Utilizzo

### Prima
\`\`\`typescript
const supabase = await createClient()
console.log("[v0] Fetching data...")
const response = await fetch("/api/data")
if (pp < 3 || pp > 6) throw new Error("Invalid PP")
\`\`\`

### Dopo
\`\`\`typescript
import { getSupabaseServer } from "@/lib/hooks/use-supabase"
import { logger } from "@/lib/utils/logger"
import { apiClient } from "@/lib/utils/api-client"
import { GAME_CONSTANTS } from "@/lib/constants/game"

const supabase = await getSupabaseServer()
logger.info("Fetching data...")
const { data, error } = await apiClient.get("/api/data")
if (pp < GAME_CONSTANTS.PP_MIN || pp > GAME_CONSTANTS.PP_MAX) {
  throw new Error(ERROR_MESSAGES.VALIDATION_INVALID_PP)
}
