# Change the database schema

Schema changes go through generated migrations, never `drizzle-kit push`
([ADR 0005](../decisions/0005-migrations-over-db-push.md)).

1. **Edit the table** in the module's `infrastructure/<name>.table.ts`. A new
   table also needs exporting from `backend/src/database-schema.ts` and adding
   to the truncate in `backend/src/test/database.ts`.
2. **Generate the migration**, naming what changed:

   ```bash
   npm run db:generate -- --name add_tool_owner
   ```

   This needs no database. It writes `backend/drizzle/NNNN_add_tool_owner.sql`
   and updates `backend/drizzle/meta/`.
3. **Read the SQL.** Drizzle sometimes renders a rename as a drop and an add,
   which loses data. If it did, edit the generated SQL before anyone applies it.
4. **Apply it locally:**

   ```bash
   npm run db:migrate
   ```

5. **Update the mapper** and anything else that reads the changed columns,
   then run the database tests with `npm test` (needs `npm run db:up`).
6. **Update the [data model reference](../reference/data-model.md).**

## Never

- **Never `drizzle-kit push`**, against any database.
- **Never edit a migration that has shipped.** Write a new one that corrects it.
- **Never let a database type cross into the domain.** The mapper is where
  rows become entities.
