# Add a use case

One new operation on an existing module — say, renaming a tool. If you are
adding a new business noun, [add a module](./add-a-module.md) instead.

## Backend

1. **Test first.** `modules/<name>/application/<verb>-<noun>.test.ts`, using
   the module's in-memory repository and the shared fakes. Cover the success
   path and every way it can fail.
2. **The domain change**, if the operation has a rule of its own: a method on
   the entity that returns a `Result`, with its own domain tests.
3. **A port method**, if the repository needs one: add it to the interface in
   `domain/`, to the in-memory fake, and to the Drizzle adapter (with a
   `.db.test.ts` case).
4. **The use case** — a class implementing `UseCase<I, Result<O, E>>`.
5. **A new error**, if there is one: a `DomainError` subclass with a stable
   `code`, and its HTTP status in the controller's `STATUS_BY_CODE`. The
   compiler refuses to build until every code has a status.
6. **The contract** for any new request or response shape, in
   `backend/src/contracts/`.
7. **The route**: a handler on the controller, a line in the router, and an
   HTTP test in `presentation/`.
8. **Wire it** in the module's `index.ts`.

## Frontend

1. Add the method to the gateway port and to the HTTP gateway, with a gateway
   test.
2. Add a hook in `application/` that calls it and invalidates the right query
   keys.
3. Use the hook from a component. Show `error.fields[name]` beside the input it
   is about, and `error.message` otherwise.

## Check

```bash
npm run typecheck && npm run lint && npm run arch:check && npm run test:unit
```

Then add the endpoint to the [API reference](../reference/api.md).
