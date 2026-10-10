-- =====================================================================
-- LedgerCore | PL/pgSQL | 03_triggers.sql
-- Database-level guarantees that hold no matter which application (or
-- manual SQL) touches the data.
--   1. Account status changes are audited.
--   2. Ledger entries are immutable (no UPDATE / DELETE).
--   3. A transaction can only become COMPLETED if its ledger is balanced,
--      and a COMPLETED transaction can never change status/type/reference.
-- Requires 01_functions.sql (fn_txn_is_balanced).  Safe to re-run.
-- NOTE: schema.sql drops the tables (and with them these triggers), so run
-- this file again after every schema.sql reset.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Audit table for account status changes
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS account_status_audit (
    audit_id    BIGSERIAL PRIMARY KEY,
    account_id  BIGINT      NOT NULL REFERENCES accounts(account_id) ON DELETE RESTRICT,
    old_status  VARCHAR(20) NOT NULL,
    new_status  VARCHAR(20) NOT NULL,
    changed_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    changed_by  TEXT        NOT NULL DEFAULT current_user
);

-- If a previous schema.sql reset dropped the foreign key, put it back.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'account_status_audit'::regclass AND contype = 'f') THEN
        ALTER TABLE account_status_audit
            ADD CONSTRAINT fk_audit_account FOREIGN KEY (account_id)
            REFERENCES accounts(account_id) ON DELETE RESTRICT;
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_account_status_audit_account ON account_status_audit(account_id);

-- ---------------------------------------------------------------------
-- 1. Audit trigger
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trg_account_status_audit()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO account_status_audit (account_id, old_status, new_status)
    VALUES (NEW.account_id, OLD.status, NEW.status);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_account_status_audit ON accounts;
CREATE TRIGGER trg_account_status_audit
    AFTER UPDATE OF status ON accounts
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION fn_trg_account_status_audit();

-- ---------------------------------------------------------------------
-- 2. Immutable ledger
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trg_ledger_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Ledger entries are immutable: % on ledger_entries (entry_id %) is not allowed. Post a compensating transaction instead.',
                    TG_OP, OLD.entry_id
          USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_ledger_immutable ON ledger_entries;
CREATE TRIGGER trg_ledger_immutable
    BEFORE UPDATE OR DELETE ON ledger_entries
    FOR EACH ROW
    EXECUTE FUNCTION fn_trg_ledger_immutable();

-- ---------------------------------------------------------------------
-- 3. Transaction completion guard
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trg_txn_guard()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    -- a completed transaction is final
    IF OLD.status = 'COMPLETED'
       AND (NEW.status       IS DISTINCT FROM OLD.status
         OR NEW.txn_type     IS DISTINCT FROM OLD.txn_type
         OR NEW.reference_no IS DISTINCT FROM OLD.reference_no) THEN
        RAISE EXCEPTION 'Transaction % is COMPLETED and can no longer be changed', OLD.txn_id
              USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    -- becoming COMPLETED requires a non-empty, balanced ledger
    IF NEW.status = 'COMPLETED' AND OLD.status <> 'COMPLETED' THEN
        IF NOT fn_txn_is_balanced(NEW.txn_id) THEN
            RAISE EXCEPTION 'Transaction % cannot be COMPLETED: ledger is empty or DEBIT <> CREDIT', NEW.txn_id
                  USING ERRCODE = 'integrity_constraint_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_txn_guard ON transactions;
CREATE TRIGGER trg_txn_guard
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION fn_trg_txn_guard();
