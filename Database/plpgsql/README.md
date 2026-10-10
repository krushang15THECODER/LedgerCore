# LedgerCore PL/pgSQL layer

Build everything:  `psql -U postgres -d ledgercore -f Database/setup_all.sql`
(destroys existing data). Re-run `plpgsql/03_triggers.sql` (or all of `plpgsql/`)
after any manual `schema.sql` reset, because dropping the tables drops the triggers.

| File | Contents |
|------|----------|
| 01_functions.sql | Read-only parameterised functions: statement, reconcile, user summary, history, volume, unbalanced txns, health checks |
| 02_procedures.sql | `fn_post_double_entry` (core), `sp_deposit/withdraw/transfer`, `sp_set_account_status`, `sp_open_account`, cursor demo, health report |
| 03_triggers.sql | Status audit trail, immutable ledger, completion guard |
| 04_tests.sql | 10 self-checking tests, run inside a transaction that is rolled back |
| 05_usage_examples.sql | Calling everything for any/all accounts |

Old hardcoded query -> PL/pgSQL replacement:

| Old | New |
|-----|-----|
| `WHERE account_id = 1` statement queries, `views.sql` demos | `fn_account_statement(any_id, from, to, limit, offset)` |
| Q19 user totals | `fn_user_summary(user_id or NULL)` |
| Q16 volume by type | `fn_volume_by_type(from, to)` |
| Q35 pagination | `fn_transaction_history(status, type, from, to, limit, offset)` |
| H1-H8 health checks, reconciliation | `fn_run_health_checks()`, `fn_reconcile(id or NULL)`, `fn_unbalanced_transactions()` |
| Q06 status UPDATE | `CALL sp_set_account_status(id, status)` |
| Node transfer/deposit/withdraw logic | `CALL sp_transfer / sp_deposit / sp_withdraw` |
