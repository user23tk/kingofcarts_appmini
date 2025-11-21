# 🔧 Piano di Refactoring Completo

## Problemi Identificati

### 1. DUPLICAZIONE SUPABASE CLIENTS ❌
**File coinvolti:**
- `lib/supabase/client.ts` (vecchio, duplicato)
- `lib/supabase/server.ts` (nuovo, corretto)
- `lib/supabase/admin.ts` (corretto per Mini App)

**Problema:**
- `client.ts` ha funzioni duplicate con `server.ts`
- Alcuni file importano da `client.ts`, altri da `server.ts`
- Inconsistenza totale nel codebase

**Soluzione:**
1. ✅ MANTENERE: `lib/supabase/admin.ts` (per Mini App APIs)
2. ✅ MANTENERE: `lib/supabase/server.ts` (per Server Components/Actions)
3. ❌ ELIMINARE: `lib/supabase/client.ts` (duplicato, sostituire con server.ts)
4. ✅ CREARE: `lib/supabase/browser.ts` (per client components)

---

### 2. AUTENTICAZIONE CONFUSA ❌
**File coinvolti:**
- `lib/miniapp/auth-context.tsx` (AuthProvider + useAuth)
- `lib/telegram/webapp-client.ts` (useTelegramWebApp)
- `lib/supabase/miniapp-auth.ts` (NON USATO!)

**Problema:**
- `useAuth()` e `useTelegramWebApp()` hanno overlap
- `initData` viene da Telegram ma `isAuthenticated` da AuthContext
- `miniapp-auth.ts` esiste ma non è mai usato
- Story page usa entrambi i hook in modo confuso

**Soluzione:**
1. ✅ SEMPLIFICARE: `useAuth()` deve essere l'UNICA fonte di verità
2. ✅ INTEGRARE: `useTelegramWebApp()` dentro `AuthProvider`
3. ❌ ELIMINARE: `lib/supabase/miniapp-auth.ts` (non usato)
4. ✅ UNIFICARE: Un solo hook per autenticazione

---

### 3. SECURITY LAYER INCOMPLETO ❌
**File coinvolti:**
- `lib/security/miniapp-security.ts` (esiste ma non usato correttamente)
- API routes (non usano il security layer)

**Problema:**
- Security layer esiste ma le API non lo chiamano
- Validazione inconsistente tra API diverse
- Audit logging non funziona

**Soluzione:**
1. ✅ CREARE: Middleware unificato per tutte le Mini App APIs
2. ✅ APPLICARE: Security layer a tutte le API routes
3. ✅ TESTARE: Audit logging funziona

---

### 4. STORY PAGE NON FUNZIONA ❌
**File coinvolti:**
- `app/(miniapp)/story/[theme]/page.tsx`

**Problema:**
- Usa sia `useAuth()` che `useTelegramWebApp()`
- Logica di loading confusa
- Non mostra mai il contenuto (rimane su loading)

**Soluzione:**
1. ✅ SEMPLIFICARE: Usare solo `useAuth()`
2. ✅ RIMUOVERE: Dipendenza da `useTelegramWebApp()`
3. ✅ FIXARE: Logica di loading
4. ✅ TESTARE: Story page funziona

---

## Piano di Implementazione

### FASE 1: Pulizia Supabase Clients
1. Creare `lib/supabase/browser.ts` per client-side
2. Aggiornare tutti gli import da `client.ts` a `browser.ts` o `server.ts`
3. Eliminare `lib/supabase/client.ts`
4. Verificare che tutto compila

### FASE 2: Unificare Autenticazione
1. Integrare `useTelegramWebApp()` dentro `AuthProvider`
2. Rimuovere `lib/supabase/miniapp-auth.ts`
3. Aggiornare `useAuth()` per esporre anche `initData`
4. Aggiornare story page per usare solo `useAuth()`

### FASE 3: Applicare Security Layer
1. Creare middleware per Mini App APIs
2. Applicare a tutte le API routes
3. Testare audit logging

### FASE 4: Fixare Story Page
1. Semplificare logica di loading
2. Rimuovere console.log di debug
3. Testare che funziona

---

## File da Eliminare
- ❌ `lib/supabase/client.ts` (duplicato)
- ❌ `lib/supabase/miniapp-auth.ts` (non usato)

## File da Creare
- ✅ `lib/supabase/browser.ts` (client-side)
- ✅ `lib/middleware/miniapp-security.ts` (middleware unificato)

## File da Modificare
- 🔧 `lib/miniapp/auth-context.tsx` (integrare Telegram)
- 🔧 `app/(miniapp)/story/[theme]/page.tsx` (semplificare)
- 🔧 Tutte le Mini App API routes (applicare security)

---

## Priorità
1. 🔴 CRITICO: Fixare story page (utente bloccato)
2. 🟡 IMPORTANTE: Unificare autenticazione (confusione)
3. 🟢 MIGLIORAMENTO: Pulizia Supabase clients (manutenibilità)
