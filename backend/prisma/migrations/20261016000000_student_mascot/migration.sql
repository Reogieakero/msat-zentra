-- Student profile mascots: persisted per-learner sprite character shown
-- beside student names on advisory list / attendance / students (same
-- StudentMascot pool as the referrals page). New rows get a mascot at
-- creation time (see services/mascot.ts); this backfills existing rows
-- with the exact same derivation (hash of "fullName:lrn") so stored
-- values and the client-side NULL fallback always agree.
-- Uses IF NOT EXISTS-safe statements so the migration is safe to re-run.

ALTER TABLE "StudentProfile"
  ADD COLUMN IF NOT EXISTS "mascot" TEXT;

ALTER TABLE "StudentRoster"
  ADD COLUMN IF NOT EXISTS "mascot" TEXT;

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
  r RECORD;
  seed TEXT;
  h BIGINT;
  i INT;
BEGIN
  -- Registered learners: name lives on "User".
  FOR r IN
    SELECT sp."userId" AS id, sp."lrn" AS lrn, u."fullName" AS name
    FROM "StudentProfile" sp
    JOIN "User" u ON u."id" = sp."userId"
    WHERE sp."mascot" IS NULL
  LOOP
    seed := r.name || ':' || r.lrn;
    h := 0;
    FOR i IN 1..char_length(seed) LOOP
      h := (h * 31 + ascii(substring(seed FROM i FOR 1))) % 4294967296;
    END LOOP;
    UPDATE "StudentProfile" SET "mascot" = chars[(h % 55) + 1] WHERE "userId" = r.id;
  END LOOP;

  -- Roster-only learners: name lives on the roster row.
  FOR r IN
    SELECT "id" AS id, "lrn" AS lrn, "fullName" AS name
    FROM "StudentRoster"
    WHERE "mascot" IS NULL
  LOOP
    seed := r.name || ':' || r.lrn;
    h := 0;
    FOR i IN 1..char_length(seed) LOOP
      h := (h * 31 + ascii(substring(seed FROM i FOR 1))) % 4294967296;
    END LOOP;
    UPDATE "StudentRoster" SET "mascot" = chars[(h % 55) + 1] WHERE "id" = r.id;
  END LOOP;
END $$;
