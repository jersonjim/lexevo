# Testing

## Running tests

```bash
npm test
```

---

## What we test and why

We only test **pure functions** — functions that take inputs and return outputs with no external dependencies. These are the most valuable tests: fast, deterministic, and don't require mocks.

We do **not** test functions that call Supabase. Mocking the database client gives false confidence — a mocked test can pass while the real query fails due to a schema change, RLS policy, or API difference. Service-layer tests would require a dedicated Supabase test project to be meaningful.

---

## Test files

### `__tests__/utils/csv.test.ts`

Tests `parseCSV()` from `utils/csv.ts`.

| Scenario | What it checks |
|---|---|
| Comma separator | Parses `word,meaning` correctly |
| Semicolon separator | Parses `word;meaning` correctly |
| Quoted fields | Handles `"to go, to walk",ir` (comma inside quotes) |
| Header order | Works with `meaning,word` (reversed columns) |
| Case-insensitive headers | `Word,Meaning` matches same as `word,meaning` |
| Whitespace trimming | `  hello  ,  hola  ` → `hello`, `hola` |
| CRLF line endings | Windows-style line endings don't break parsing |
| Empty rows filtered | Rows with missing word or meaning are silently dropped |
| Error: empty file | Throws `'empty'` if file has no data rows |
| Error: missing columns | Throws `'columns'` if `word` or `meaning` column not found |
| Word too long | Rows where `word > 100 chars` are skipped, counted in `skippedLength` |
| Meaning too long | Rows where `meaning > 500 chars` are skipped, counted in `skippedLength` |
| Exact limit accepted | Rows at exactly 100/500 chars are valid |
| Multiple invalid rows | `skippedLength` counts all of them |
| Row cap | Import is capped at 1,000 rows regardless of file size |

### `__tests__/services/leitner.test.ts`

Tests `computeStreak()` from `services/leitner.ts`.

Time is frozen to `2026-07-08` using `jest.useFakeTimers()` so results are deterministic.

| Scenario | What it checks |
|---|---|
| Empty data | Returns `streak: 0, studiedToday: false` |
| Entry today | `studiedToday: true` |
| Entry yesterday | `studiedToday: false`, streak still active |
| Entry older than yesterday | `streak: 0` (chain broken) |
| Consecutive days (today) | Counts all consecutive days up to today |
| Consecutive days (yesterday) | Counts all consecutive days ending yesterday |
| Gap in days | Streak stops at the first missing day |
| Multiple entries same day | Deduplicates — same day counts as 1 |
| `startDate` filter | Ignores entries before `startDate` |
| `startDate` = today | Only today counts, history before it is excluded |
| `startDate` = yesterday | Yesterday + today both count |
| All entries before `startDate` | Returns `streak: 0` |
| `null` startDate | All entries included |

---

## Adding new tests

Create a `.test.ts` file anywhere inside `__tests__/`. Jest picks it up automatically.

```
__tests__/
  utils/
    csv.test.ts        ← parseCSV
  services/
    leitner.test.ts    ← computeStreak
  your-new-file.test.ts
```

If you add a new pure function to the codebase, export it and add a test file here. The rule of thumb: if a function takes inputs and returns outputs with no network calls or device APIs, it belongs in a test.

---

## Freezing time in tests

`computeStreak` calls `new Date()` internally. To make the tests deterministic we freeze the clock:

```typescript
beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-07-08T15:00:00.000Z'));
});

afterAll(() => {
  jest.useRealTimers();
});
```

When writing tests for any function that uses `new Date()`, do the same.

---

## Limits enforced in CSV validation

These constants are defined in `utils/csv.ts` and imported in tests:

| Constant | Value | Purpose |
|---|---|---|
| `MAX_CSV_SIZE_BYTES` | 2 MB | Checked before reading the file (in `HomeScreen`) |
| `MAX_WORD_LENGTH` | 100 chars | Per-row validation inside `parseCSV` |
| `MAX_MEANING_LENGTH` | 500 chars | Per-row validation inside `parseCSV` |
| `MAX_CSV_ROWS` | 1,000 rows | Slice applied before processing rows |
