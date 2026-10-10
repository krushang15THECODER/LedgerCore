-- =====================================================================
-- LedgerCore | one-command database build   (psql only: uses \ir)
--   psql -U postgres -d ledgercore -f Database/setup_all.sql
-- Rebuilds EVERYTHING from scratch. Existing data is destroyed.
-- =====================================================================
\set ON_ERROR_STOP on
\ir schema.sql
\ir seed.sql
\ir views.sql
\ir indexes.sql
\ir plpgsql/01_functions.sql
\ir plpgsql/02_procedures.sql
\ir plpgsql/03_triggers.sql
\echo 'LedgerCore database ready. Run plpgsql/04_tests.sql to self-test.'
