# Add a page

A page is a place in the sidebar. It composes features; it holds no rules of
its own. The Tools page is the worked example —
`frontend/src/pages/tools/`.

1. **Create the folder** `frontend/src/pages/<name>/`.
2. **Write the page**, `<Name>Page.tsx`. Start it with `PageHeader` (a title,
   one sentence, at most one primary action). Read data with the feature's
   suspense hook (`useSuspenseQuery` inside, as `useTools` does) — never check
   `isPending` in the page.
3. **Write its skeleton**, `<Name>PageSkeleton.tsx`, from `SkeletonRegion`,
   `SkeletonBlock` and `SkeletonText`. Lay it out exactly like the page: same
   header, same grid, same card sizes, so nothing jumps when the page arrives.
   Give blocks an increasing `order` from top to bottom.
4. **Register the route** in `frontend/src/app/routes.tsx`: a `lazy()` import
   of the page, wrapped in `RouteBoundary` with the skeleton as `skeleton`.
5. **Add it to the sidebar** in `frontend/src/app/nav.ts`: path, label, and an
   animated icon from `shared/ui/icons` (write one if none fits — see
   [`DESIGN.md`](../../frontend/DESIGN.md#icons)).
6. **Test it** beside the page: the skeleton while data is pending, the page
   when it arrives, the empty state, and the error with Try again —
   `pages/tools/ToolsPage.test.tsx` shows all four.

## Check

```bash
npm run typecheck && npm run lint && npm run arch:check && npm run test:unit
```

Then open it in the app in both themes and at phone width.
