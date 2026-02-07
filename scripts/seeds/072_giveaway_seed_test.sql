-- =====================================================
-- GIVEAWAY MVP - TEST SEED DATA
-- =====================================================
-- Run this to create a test giveaway for development
-- REMOVE or modify for production

-- Reset sequence for clean testing (optional)
-- ALTER SEQUENCE giveaway_ticket_numbers RESTART WITH 1;

-- Insert a test Christmas giveaway
INSERT INTO giveaways (
  name,
  description,
  pp_per_ticket,
  starts_at,
  ends_at,
  is_active,
  prize_title,
  prize_type,
  prize_description,
  prize_image_url,
  prize_link
) VALUES (
  'Contest Natale 2024',
  'Partecipa al contest natalizio e vinci un regalo esclusivo! Ogni 100 PP guadagnati ti danno diritto a 1 ticket per l''estrazione.',
  100,
  NOW(),
  NOW() + INTERVAL '30 days',
  true,
  'Telegram Premium Gift',
  'telegram_gift',
  'Vinci 1 mese di Telegram Premium! Il fortunato vincitore riceverà un Gift Premium direttamente su Telegram.',
  '/placeholder.svg?height=400&width=400',
  'https://t.me/premium'
)
ON CONFLICT DO NOTHING;

-- Verify insertion
SELECT 
  id,
  name,
  is_active,
  pp_per_ticket,
  starts_at,
  ends_at,
  prize_title
FROM giveaways
ORDER BY created_at DESC
LIMIT 1;
