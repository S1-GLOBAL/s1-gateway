# API contracts

The shape of every request and response, declared once and imported by both
the backend and the frontend ([ADR 0007](../../../docs/decisions/0007-one-definition-of-an-api-shape.md)).

## Rules

1. **Types only.** No runtime code: no constants, functions, enums, classes or
   zod. If it compiles to JavaScript it does not belong here.
2. **No imports**, except a type-only import of a sibling contract
   (`import type { Tool } from './tools.js'`).
3. **No Drizzle or domain types.** A contract describes the wire, not a table
   or an entity.
4. **Used only at the edge.** Backend `presentation` and frontend
   `infrastructure` import contracts; nothing else does. `npm run arch:check`
   enforces it.
