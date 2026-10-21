# 0007. Search Atlas with raw product text

- **Status:** Complete
- **Owner:** Rey Denzo
- **Related:** [#41](https://github.com/S1-GLOBAL/s1-gateway/issues/41) ·
  [plan 0006](./0006-s2-spec-ids-and-verified-list-import.md) ·
  [ADR 0019](../decisions/0019-the-s1-spec-id-format.md) ·
  [ADR 0025](../decisions/0025-spec-ids-are-written-short.md)

## Goal

At the end of this plan the Atlas library reads raw product text. Someone
types or pastes "14oz Bagasse Bowl for Cava", presses **Search**, and sees
what Atlas read (bowl, bagasse, 14 oz), what it ignored ("for Cava") and the
code those facts make. **Yes, proceed** lists the saved Spec IDs that fit
those facts, then those that might; **No, edit it** opens New Spec ID with
the facts filled in. Nothing is saved. The reader is rules and a word list in
the repository, no AI model, and plan 0006's import reuses it for item names.

## Scope

**In scope**
- A decision record for reading raw text by rules and a public word list
- The word list, the keyword table and the size rulings, under `backend/src/modules/atlas/domain/reading/`
- `POST /api/v1/atlas/spec-ids/read`
- The library's Search button, its confirmation card and its results
- `api.md`, and notes in plan 0006 and #28

**Out of scope** — and where it is handled instead
- Saving a Spec ID from search — never: New Spec ID, as now
- Learning new spellings from what people type — no issue yet
- Ranking results by closeness — no issue yet
- The verified-list import — plan 0006, phase 3, after this plan

## Prerequisites

- `main` has #37 and #40: codes are short (`git grep -n "SLOT_COUNT = 25" -- backend/src/modules/atlas/domain/slots.ts` prints one line).
- The word list's entries are supplied in full by the plan's author in the handoff: plan 0006's spelling table without its `skip` entries. The table itself never enters the repository; its entries do, as reyxdz decided on #41.

## Progress

| Phase | Steps | Status |
|---|---|---|
| 1. The reader and its route | 5 / 5 | Done |
| 2. The library's Search | 4 / 4 | Done — step 2.4's staging check waived by reyxdz on 2026-10-22 |

---

## Design

### The reader — `backend/src/modules/atlas/domain/reading/`

| Name | File | Shape |
|---|---|---|
| `WORD_LIST` | `word-list.ts` | `Readonly<Record<string, { productType: string } \| { material: string }>>`: each phrase as written in the spelling table, with its code |
| `KEYWORDS` | `keywords.ts` | plan 0006's item-name keyword table ("Item-name keywords"), each row a pattern and the slot values it sets |
| `readSize` | `size-rulings.ts` | `(text: string, productType: string) => { facts: Partial<SpecIdFactsInput>; ruling: Ruling; words: string } \| null`, #28's rulings R1, R1b, R2, R3, R5 and R6 |
| `readText` | `read-text.ts` | `(text: string, dictionary: Dictionary, productType?: string) => TextReading` |

```ts
type Ruling = 'R1' | 'R1b' | 'R2' | 'R3' | 'R5' | 'R6';
interface ReadFact { key: SlotKey; words: string; ruling: Ruling | null }
interface TextReading {
  facts: Partial<SpecIdFactsInput>; // productType set when found or given
  read: ReadFact[];                 // in code order
  ignored: string[];                // the words no rule used, as the text wrote them, in text order
  conflicts: { key: SlotKey; found: string[] }[]; // the words as the text wrote them
}
```

Rules, in this order:

1. Text is compared in lower case; a phrase matches only as whole words (no letter or digit on either side).
2. Product type and material come from `WORD_LIST` and from the dictionary's own product-type names. Where two phrases overlap, the longer wins ("bowl lid" over "bowl" and "lid").
3. The other facts come from `KEYWORDS`; a capacity or count with its unit (`14oz`, `500 ml`, `2 ply`) is read there.
4. Once a product type is known, a size #28's rulings cover — a bare number, `90mm`, `93 Dia`, `200 x 300 x 80` — is read by `readSize` for that product type.
5. Two different values for one slot leave it out of `facts` and put both in `conflicts`.
6. Every word no rule used goes in `ignored`.
7. A `productType` argument wins over any found in the text.

### The route — `POST /api/v1/atlas/spec-ids/read`

Behind the same sign-in as every Atlas route. Request `{ text: string; productType?: string }`. The use case `ReadSpecIdText` (`application/read-spec-id-text.ts`):

- trims `text`; refuses empty or over 500 characters with 400 `VALIDATION_FAILED` (copy below);
- reads it with `readText`;
- when it has a product type, builds the code with `SpecId.build`. A fact the product type cannot have ("14oz" on a bowl lid) is dropped: the build is retried without it, and its words move to `ignored`;
- saves nothing.

Response `SpecIdTextReading`:

```ts
{
  read: { key: SlotKey; name: string; meaning: string; words: string; ruling: Ruling | null }[]; // meaning as a decoded slot writes it
  ignored: string[];
  conflicts: { key: SlotKey; name: string; found: string[] }[];
  decoded: DecodedSpecId | null; // null when no product type was found or given
}
```

`AtlasController` takes `ReadSpecIdText` as a ninth constructor argument; `atlas.routes.ts` adds `router.post('/spec-ids/read', controller.readText)`.

### The library — `frontend/src/features/atlas/`

| Name | File | Phase |
|---|---|---|
| `readText(input: { text: string; productType?: string }): Promise<SpecIdTextReading>` | `application/atlas-gateway.ts`, `infrastructure/http-atlas-gateway.ts` | 2 |
| `useReadText()` | `application/use-read-text.ts` (a mutation) | 2 |
| `TextSearch` | `presentation/library/TextSearch.tsx`: the card, then the results | 2 |
| `TextSearchResults` | `presentation/library/TextSearchResults.tsx`: fits, then might fit, with `useSimilarSpecIds(knownCriteria(decoded))` and the library's cards | 2 |

- `AtlasLibrary` shows **Search** at the right of the box whenever the trimmed text is not empty and `asPastedCode` reads no code. Pressing it shows `TextSearch` in the list's place; changing the text goes back to the name list.
- Name filtering as you type is unchanged, but for its message when nothing matches (copy below).
- "Read from your text" is `summarise(decoded)` when there is a code, else the `meaning` of each read fact joined with " · ".
- **No, edit it** and **Start a Spec ID from it** link to `/atlas/new?code=<decoded.code>`.
- With no product type, the card shows a Product type select listing the dictionary's product types in code order (as New Spec ID does); choosing one asks the route again with `productType`.
- Decided by reyxdz on 2026-10-21:
  - Text over 120 characters is not asked of the name search; the list shows the no-match sentence, and Search reads it (up to 500).
  - When nothing fits but something might, "No saved Spec ID fits these facts." and Start a Spec ID from it come first, then Might fit.
  - A fact found three or more times lists every value, and says "both" only for two.
  - Search ignores the product-type filter, which is hidden while the card shows.

### Copy

| When | Users see |
|---|---|
| The button | "Search" |
| No saved name matches while typing | "No names match. Press Search to read the facts from your text." |
| The card's question | "Does this code look right?" |
| What was read | "Read from your text: {facts}" |
| What was left out | "Ignored: {words joined with ", "}" — only when something was |
| A fact found twice | "{Slot}: found both {A} and {B}, so it's left as not known." — three or more: "{Slot}: found {A}, {B} and {C}, so it's left as not known." |
| The buttons | "Yes, proceed" · "No, edit it" |
| No product type | "Couldn't tell what product this is. Choose a product type:" |
| No facts at all | "No facts found in your text. Check the wording, or start a Spec ID by hand." with "New Spec ID" |
| Results | "Fits — every fact you gave matches" · "Might fit — nothing contradicts, but some facts aren't recorded" |
| Nothing fits | "No saved Spec ID fits these facts." with "Start a Spec ID from it" |
| Text over 500 characters | "Search text must be at most 500 characters." |
| Empty text (API only; the page never sends it) | "Type some text to read." |

### Review Focus

Inputs #41 implies but does not spell out. Each has its test in the step that owns the code.

1. Text glued with punctuation or in capitals — "14OZ,Bagasse-Bowl" — reads like "14oz bagasse bowl" (Step 1.4).
2. A product type inside a longer name — "bowl lid" — is a bowl lid, not a bowl with a lid (Step 1.4).
3. A fact the product type cannot have — "14oz bowl lid" — is dropped and listed as ignored, and the code still builds (Step 1.5).
4. A number with no unit and no product type — "Cava order 12" — reads nothing (Step 1.4).
5. Pasting a real code still opens that Spec ID, with no Search button (Step 2.3).

---

## Phase 1 — The reader and its route

One pull request, "Part of #41".

### Step 1.1 — Record the decision

- [x] **Action.** `docs/decisions/0026-raw-text-is-read-by-rules-and-a-public-word-list.md` (Accepted, 2026-10-20): the reader is rules, a word list in the repository and #28's rulings, no AI model; why (predictable, testable, no cost, one reader for search and import); what it costs (a phrase missing from the list is not read). Add its row to `docs/decisions/README.md`.
- [x] **Verify.** `npm run docs:check` ends with "The README index agrees with every plan."

### Step 1.2 — The word list and the keywords

- [x] **Action.** `word-list.ts` with the entries the handoff supplies, and `keywords.ts` with plan 0006's keyword table. Tests: every code in `WORD_LIST` is a value of S2 0.1.0 for its slot; "Bowl Lid" is `BLD`; no key is empty.
- [x] **Verify.** From `backend/`: `npx vitest run --config vitest.unit.config.ts src/modules/atlas/domain/reading` passes.

### Step 1.3 — The size rulings

- [x] **Action.** `size-rulings.ts`, with #28's table: one test per ruling reading its pattern, and one near miss per ruling reading nothing ("90" on a bag; "A x B" with two numbers on a takeout box).
- [x] **Verify.** The same command passes.

### Step 1.4 — Reading text

- [x] **Action.** `read-text.ts`. Tests:
  - "14oz Bagasse Bowl for Cava" reads productType `BWL`, material `CBG`, capacity `Z` 14, and ignores "for", "Cava";
  - "Cup 90mm" reads topDiameter 90 mm under `R1`, and shape `RD`;
  - "clear PET and PP lid" leaves material out and reports `found: ['PET', 'PP']`;
  - Review Focus 1, 2 and 4;
  - a given `productType` wins over the text's.
- [x] **Verify.** The same command passes.

### Step 1.5 — The route, its contract and the docs

- [x] **Action.**
  - Add `ReadSpecIdTextRequest` and `SpecIdTextReading` to `backend/src/contracts/atlas.ts`.
  - Add `ReadSpecIdText`, its schema, the controller argument and the route; wire them in `backend/src/modules/atlas/index.ts` and the tests that build the controller.
  - Document the route in `docs/reference/api.md`.
  - Note in plan 0006's phase 3 that the import uses `readText` for item names, `readSize` for sizes and `WORD_LIST` for its spelling table instead of building its own, and in #28 that the spelling table's entries, without its `skip` entries, now live in the repository as `WORD_LIST`.
  - Use-case and route tests:
    - the example builds `BWL.CBG.Y.Y.Y.X.Z0014.Y.Y.Y.Y.Y.X.Y.X.Y.Y.Y.Y.X.X.X.X.X.X`;
    - Review Focus 3;
    - 500 characters are read, and 501 get the 400 sentence;
    - a `productType` not in the dictionary gets 400 `INVALID_SPEC_ID` beside `productType`;
    - text with no product type answers `decoded: null`;
    - no route saves (the in-memory repository holds nothing afterwards).
- [x] **Verify.** `npm run typecheck`, `npm run lint`, `npm run arch:check`, `npm --prefix backend test` and `npm run docs:check` pass; CI and `pr-audit` pass on the pull request.

---

## Phase 2 — The library's Search

One pull request, "Closes #41".

### Step 2.1 — The gateway and the hook

- [x] **Action.** `readText` on the gateway port and the HTTP adapter (`POST /atlas/spec-ids/read`, `decoded` mapped as `decode` maps it), and `useReadText`. Test: the adapter sends `{ text, productType }` and answers the reading; a 400 becomes an `AppError` with its fields.
- [x] **Verify.** From `frontend/`: `npx vitest run --no-file-parallelism src/features/atlas` passes.

### Step 2.2 — The card

- [x] **Action.** `TextSearch.tsx` with the copy above. Tests:
  - a reading with a code shows what was read, what was ignored, the code and both buttons, and No, edit it links to `/atlas/new?code=…`;
  - a reading with no product type shows the select, and choosing `BWL` asks again with `productType: 'BWL'`;
  - a reading with nothing read shows the no-facts sentence and New Spec ID;
  - a conflict shows its sentence.
- [x] **Verify.** The same command passes; `npm run design:check` prints "Design tokens only."

### Step 2.3 — The results and the library

- [x] **Action.**
  - Add `TextSearchResults.tsx`.
  - In `AtlasLibrary.tsx`, add the Search button and the switch between the name list and `TextSearch`.
  - In `LibraryList.tsx`, change the no-match sentence to the copy above.
  - Tests:
    - Yes, proceed shows "Fits" before "Might fit", with the cards the lookup answers;
    - nothing fitting shows its sentence and Start a Spec ID from it;
    - no gateway save is called;
    - typing after a search returns to the name list;
    - Review Focus 5;
    - the no-match sentence.
- [x] **Verify.** The same command passes.

### Step 2.4 — Browser check, screenshots, pull request

- [x] **Action.**
  - Locally, search "14oz Bagasse Bowl for Cava", "Cava order 12" and "clear PET 12oz", in light, dark and at 390 px.
  - Save the screenshots `atlas-text-search-light.png`, `atlas-text-search-dark.png` and `atlas-text-search-phone-light.png` into `.github/readme/`.
  - Open the pull request, "Closes #41".
- [x] **Verify.**
  - CI and `pr-audit` pass.
  - After merge, on staging: "14oz Bagasse Bowl for Cava" reads bowl, bagasse and 14 oz; Yes, proceed lists the saved "14oz Bagasse Bowl" if its facts fit; and the library holds no new Spec ID.
  - Done in #46, merged as a271851; CI and `pr-audit` passed. The staging check was waived by reyxdz on 2026-10-22: it was skipped, so this step records no staging result. Staging deployed a271851 the same day.

---

## Acceptance

- [x] Every step above is ticked.
- [x] Every Verify item of #41 holds, but for its staging item, waived by reyxdz on 2026-10-22 (step 2.4).

## Follow-ups

- The verified-list import reuses `readText`, `readSize` and `WORD_LIST` — plan 0006, phase 3.
- Learning spellings from searches, and ranking by closeness — no issue yet.
