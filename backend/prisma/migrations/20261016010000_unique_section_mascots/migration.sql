-- Unique mascots per section: every learner displayed together (one
-- section's profiles + roster rows) gets a distinct sprite character.
-- Keeps the first occurrence of each mascot (profiles by LRN, then roster
-- rows by LRN) and reassigns collisions by probing forward from the
-- canonical hash pick — the same rule services/mascot.ts applies to new
-- rows. Sections holding more than the 55-character pool keep unavoidable
-- repeats of the canonical pick. Safe to re-run (only colliding rows
-- are touched).

DO $$
DECLARE
  chars TEXT[] := ARRAY[
    'afro','astronaut','bald','ballerina','bear','beard','builder','bunny',
    'cap','cat','chef','clockwork','crt','cube','deer','dino','droid','drone',
    'fox','frog','gearbot','glasses','grandpa','granny','hamster','hedgehog',
    'hijabi','kamran','knight','koala','lantern','mouse','nurse','otter','owl',
    'panda','penguin','pirate','postbot','pug','raccoon','radio','redpanda',
    'robot','rocket','scientist','scout','sheep','sikh','skater','sloth',
    'tiger','toaster','tv','wizard'
  ];
  sec RECORD;
  r RECORD;
  seed TEXT;
  h BIGINT;
  i INT;
  idx INT;
  step INT;
  pick TEXT;
  used TEXT[];
BEGIN
  FOR sec IN
    SELECT DISTINCT "sectionId" AS sid FROM "StudentProfile" WHERE "sectionId" IS NOT NULL
    UNION
    SELECT DISTINCT "sectionId" AS sid FROM "StudentRoster"
  LOOP
    used := ARRAY[]::TEXT[];

    -- Registered profiles first, deterministic by LRN.
    FOR r IN
      SELECT sp."userId" AS id, sp."lrn" AS lrn, u."fullName" AS name, sp."mascot" AS cur
      FROM "StudentProfile" sp
      JOIN "User" u ON u."id" = sp."userId"
      WHERE sp."sectionId" = sec.sid
      ORDER BY sp."lrn", sp."userId"
    LOOP
      IF r.cur IS NOT NULL AND NOT (r.cur = ANY (used)) THEN
        used := used || r.cur;
      ELSE
        seed := r.name || ':' || r.lrn;
        h := 0;
        FOR i IN 1..char_length(seed) LOOP
          h := (h * 31 + ascii(substring(seed FROM i FOR 1))) % 4294967296;
        END LOOP;
        idx := (h % 55);
        pick := chars[idx + 1];
        step := 0;
        WHILE pick = ANY (used) AND step < 55 LOOP
          step := step + 1;
          pick := chars[((idx + step) % 55) + 1];
        END LOOP;
        UPDATE "StudentProfile" SET "mascot" = pick WHERE "userId" = r.id;
        used := used || pick;
      END IF;
    END LOOP;

    -- Roster rows next, deterministic by LRN.
    FOR r IN
      SELECT "id" AS id, "lrn" AS lrn, "fullName" AS name, "mascot" AS cur
      FROM "StudentRoster"
      WHERE "sectionId" = sec.sid
      ORDER BY "lrn", "id"
    LOOP
      IF r.cur IS NOT NULL AND NOT (r.cur = ANY (used)) THEN
        used := used || r.cur;
      ELSE
        seed := r.name || ':' || r.lrn;
        h := 0;
        FOR i IN 1..char_length(seed) LOOP
          h := (h * 31 + ascii(substring(seed FROM i FOR 1))) % 4294967296;
        END LOOP;
        idx := (h % 55);
        pick := chars[idx + 1];
        step := 0;
        WHILE pick = ANY (used) AND step < 55 LOOP
          step := step + 1;
          pick := chars[((idx + step) % 55) + 1];
        END LOOP;
        UPDATE "StudentRoster" SET "mascot" = pick WHERE "id" = r.id;
        used := used || pick;
      END IF;
    END LOOP;
  END LOOP;
END $$;
