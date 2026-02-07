-- ============================================
-- CREA TABELLA PP_AUDIT PER SECURITY
-- ============================================

CREATE TABLE IF NOT EXISTS pp_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL,
  chapter_number INTEGER NOT NULL,
  scene_index INTEGER NOT NULL,
  choice_id TEXT NOT NULL,
  pp_gained INTEGER NOT NULL CHECK (pp_gained >= 0 AND pp_gained <= 10),
  session_total_pp INTEGER NOT NULL DEFAULT 0,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_pp_audit_user_id ON pp_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_pp_audit_created_at ON pp_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pp_audit_user_time ON pp_audit(user_id, created_at DESC);

-- Commento
COMMENT ON TABLE pp_audit IS 'Audit trail per tutti i PP guadagnati dagli utenti';

-- Verifica
DO $$
BEGIN
  RAISE NOTICE 'Tabella pp_audit creata con successo!';
  RAISE NOTICE 'Indici creati per performance ottimale';
END $$;
