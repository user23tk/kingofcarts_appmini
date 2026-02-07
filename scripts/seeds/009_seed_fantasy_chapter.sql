-- Seed first fantasy chapter
DO $$
DECLARE
  fantasy_theme_id UUID;
BEGIN
  -- Get fantasy theme ID
  SELECT id INTO fantasy_theme_id FROM themes WHERE name = 'fantasy';
  
  -- Insert chapter 1
  INSERT INTO story_chapters (theme_id, chapter_number, title, content)
  VALUES (
    fantasy_theme_id,
    1,
    'L''Inizio dell''Avventura',
    '{
      "scenes": [
        {
          "index": 0,
          "text": "Ti svegli in una foresta nebbiosa. Gli alberi antichi si ergono come giganti silenziosi, e una luce dorata filtra attraverso le foglie. Non ricordi come sei arrivato qui.",
          "choices": []
        },
        {
          "index": 1,
          "text": "Davanti a te si aprono tre sentieri. Quale scegli?",
          "choices": [
            {
              "id": "path_left",
              "text": "Il sentiero a sinistra, coperto di muschio",
              "emoji": "🌿",
              "ppDelta": 10
            },
            {
              "id": "path_center",
              "text": "Il sentiero centrale, illuminato dal sole",
              "emoji": "☀️",
              "ppDelta": 15
            },
            {
              "id": "path_right",
              "text": "Il sentiero a destra, avvolto nell''ombra",
              "emoji": "🌙",
              "ppDelta": 5
            }
          ]
        },
        {
          "index": 2,
          "text": "Mentre cammini, senti un rumore tra i cespugli. Un piccolo folletto appare davanti a te, con occhi curiosi e un sorriso malizioso.",
          "choices": []
        },
        {
          "index": 3,
          "text": "Il folletto ti parla: ''Viaggiatore, cosa cerchi in questa foresta?''",
          "choices": [
            {
              "id": "seek_treasure",
              "text": "Cerco un tesoro leggendario",
              "emoji": "💎",
              "ppDelta": 10
            },
            {
              "id": "seek_home",
              "text": "Cerco la via di casa",
              "emoji": "🏠",
              "ppDelta": 15
            },
            {
              "id": "seek_adventure",
              "text": "Cerco l''avventura",
              "emoji": "⚔️",
              "ppDelta": 20
            }
          ]
        },
        {
          "index": 4,
          "text": "Il folletto annuisce saggiamente e ti indica una direzione. ''Segui il canto degli uccelli,'' dice prima di svanire in una nuvola di polvere dorata.",
          "choices": []
        },
        {
          "index": 5,
          "text": "Arrivi a un bivio. Da una parte senti il canto melodioso degli uccelli, dall''altra il rumore di un ruscello.",
          "choices": [
            {
              "id": "follow_birds",
              "text": "Segui il canto degli uccelli",
              "emoji": "🐦",
              "ppDelta": 15
            },
            {
              "id": "follow_stream",
              "text": "Segui il rumore del ruscello",
              "emoji": "💧",
              "ppDelta": 10
            },
            {
              "id": "rest",
              "text": "Ti fermi a riposare",
              "emoji": "🛑",
              "ppDelta": 5
            }
          ]
        },
        {
          "index": 6,
          "text": "Il sole inizia a tramontare, tingendo il cielo di arancione e viola. La foresta si fa più silenziosa, quasi in attesa.",
          "choices": []
        },
        {
          "index": 7,
          "text": "Improvvisamente, vedi una luce brillante tra gli alberi. Cosa fai?",
          "choices": [
            {
              "id": "approach_light",
              "text": "Ti avvicini alla luce",
              "emoji": "✨",
              "ppDelta": 20
            },
            {
              "id": "hide",
              "text": "Ti nascondi dietro un albero",
              "emoji": "🌳",
              "ppDelta": 10
            },
            {
              "id": "call_out",
              "text": "Chiami ad alta voce",
              "emoji": "📢",
              "ppDelta": 15
            }
          ]
        },
        {
          "index": 8,
          "text": "La luce si rivela essere un portale magico. Attraverso di esso, intravedi un regno fantastico pieno di meraviglie.",
          "choices": []
        },
        {
          "index": 9,
          "text": "Fai un respiro profondo e ti prepari. La tua avventura è appena iniziata...",
          "choices": [
            {
              "id": "enter_portal",
              "text": "Attraversa il portale",
              "emoji": "🚪",
              "ppDelta": 25
            },
            {
              "id": "turn_back",
              "text": "Torna indietro",
              "emoji": "↩️",
              "ppDelta": 5
            },
            {
              "id": "study_portal",
              "text": "Studia il portale prima",
              "emoji": "🔮",
              "ppDelta": 15
            }
          ]
        }
      ]
    }'::jsonb
  )
  ON CONFLICT (theme_id, chapter_number) DO NOTHING;
END $$;
