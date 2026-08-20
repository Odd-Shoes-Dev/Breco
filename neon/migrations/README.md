# Neon Migrations

SQL migrations for the Neon PostgreSQL database. Apply these files in order when setting up a new environment or when deploying schema changes.

## Reference

The `supabase/migrations/` folder at the project root contains the full history of schema changes from the previous Supabase setup. Use those files as a guide when writing new migrations here — they contain the complete table definitions, RPC functions, and seed data.

## Rules

- Apply files in numeric order (001, 002, 003 ...)
- Never edit an already-applied migration — write a new numbered file instead
- Each file should be self-contained and idempotent where possible (`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, etc.)
- RLS policies from Supabase are not carried over — access control is handled at the application layer (middleware + JWT)

## Naming convention

```
001_initial_schema.sql        # Core tables
002_auth_tables.sql           # Users, sessions
003_functions.sql             # Auto-numbering and utility RPC functions
004_seed_data.sql             # Chart of accounts, default settings
...
NNN_description.sql
```

## Applying migrations

```bash
npm run db:migrate
```

Or manually via psql:

```bash
psql $DATABASE_URL -f neon/migrations/001_initial_schema.sql
psql $DATABASE_URL -f neon/migrations/002_auth_tables.sql
# ...
```
