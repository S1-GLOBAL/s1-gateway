# Turn off the service worker

The kill switch from [ADR 0010](../decisions/0010-the-app-shell-is-cached-api-responses-never-are.md).

## When

A build has shipped that breaks the app, and staff browsers keep loading it
from the service worker's cache even after a fixed build is deployed — or you
need the worker gone for any other reason.

An ordinary bad build does not need this: deploy the fix, and the update
prompt offers it. Use the kill switch when the worker itself is the problem.

## How

1. In `frontend/`, build with the switch on:

   ```bash
   PWA_SELF_DESTROY=true npm run build
   ```

   In PowerShell: `$env:PWA_SELF_DESTROY='true'; npm run build`, then
   `Remove-Item Env:PWA_SELF_DESTROY` so the next build is normal.

   The worker this produces unregisters itself and deletes its caches the next
   time a browser checks for an update.
2. Deploy that build.
3. **Leave it deployed** until staff have opened the Gateway at least once,
   so every installed copy has picked it up. A day of normal use is usually
   enough.
4. Deploy a normal build (`npm run build`) to turn the worker back on.

## Check

In a browser that had the old worker: DevTools → Application → Service
workers shows none registered for the site, and Cache storage is empty.
