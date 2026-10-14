# Add a module

A module is a business noun with its own rules — what `tools` is today. Add
one when the thing has its own invariants and its own table. If it is only
another operation on an existing noun, [add a use case](./add-a-use-case.md)
instead.

The `tools` module is the worked example for every step below. Open the
matching file and copy its shape.

Read [ADR 0003](../decisions/0003-clean-architecture-with-layers-inside-modules.md)
first if you have not: the order below follows the dependency rule, inside
out.

## Backend — `backend/src/modules/<name>/`

1. **Domain.** The entity with a `create` factory that returns a `Result` and
   reports every broken rule at once, plus `restore` for persistence. Its
   errors extend `DomainError` with a stable `code`. The repository port is an
   interface here. No imports from outside the domain.
   *Copy:* `tools/domain/`.
2. **Domain tests**, written first: every rule, accepted at its limit and
   rejected just past it.
3. **Application.** One class per use case, implementing `UseCase<I, O>`,
   taking its ports by constructor. A DTO type and a `to…Dto` function. Write
   an in-memory fake of the repository in `application/testing/`.
   *Copy:* `tools/application/`.
4. **Use-case tests**, with the fake and `FixedClock` / `SequentialIdGenerator`
   from `shared/application/testing/fakes.ts`.
5. **Contract.** Request and response types in `backend/src/contracts/<name>.ts`.
   Types only — see the [contracts README](../../backend/src/contracts/README.md).
6. **Presentation.** A zod schema `satisfies z.ZodType<Contract>`, a
   controller that maps error codes to statuses, and a router.
   *Copy:* `tools/presentation/`.
7. **HTTP tests** with supertest, using real use cases over the fake.
8. **Infrastructure.** The Drizzle table, a mapper both ways, and the
   repository adapter. Then [change the database schema](./change-the-database-schema.md)
   to generate the migration. *Copy:* `tools/infrastructure/`.
9. **Repository tests** in `*.db.test.ts`, against Postgres.
10. **Wire it.** `modules/<name>/index.ts` builds the adapter, use cases and
    controller and returns an `HttpModule`. Mount it in `backend/src/compose.ts`.
    Export its table from `backend/src/database-schema.ts` and add it to the
    truncate in `backend/src/test/database.ts`.

## Frontend — `frontend/src/features/<name>/`

1. **Domain.** The feature's own types (dates as `Date`, not strings) and pure
   rules, with tests.
2. **Application.** The gateway port, a context provider and
   `use…Gateway()`, a query-key factory, and the hooks.
3. **Infrastructure.** The HTTP gateway: the only file that imports the
   contracts, mapping them into domain types and every failure into `AppError`.
   Test it with an axios adapter, not a mocked module.
4. **Presentation.** Components that take domain types and use `shared/ui`.
   Test them with a fake gateway.
5. **`index.ts`** — the feature's public surface.
6. **Wire it.** Add the gateway to `src/app/dependencies.ts`, its provider to
   `src/app/providers.tsx`, a page in `src/pages/` and a route in
   `src/app/router.tsx`.

## Check

```bash
npm run typecheck && npm run lint && npm run arch:check && npm run test:unit
```

`arch:check` failing means an import crosses a layer the wrong way. Move the
code; do not loosen the rule.
