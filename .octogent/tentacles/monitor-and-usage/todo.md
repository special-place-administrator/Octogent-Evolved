# Todo

## 1. Add stale-cache edge-case tests for monitor service

- [x] Extend `monitorCore.test.ts` with tests for the stale-cache boundary conditions in `isMonitorCacheStale`.

**Why**: `isMonitorCacheStale` is already tested in `monitorCore.test.ts` but only at a basic level. The monitor feed is a polling surface — off-by-one or timezone edge cases in staleness detection cause silent feed freezes. Grounding more boundary tests here guards against regressions.

**What**:
- Read `apps/api/src/monitor/service.ts` `isMonitorCacheStale` function
- Read `apps/api/tests/monitorCore.test.ts` for existing coverage
- Add tests: exactly-at-staleness-threshold, one-ms-before, one-ms-after, `now` equal to `lastUpdated`
- Run verification

**Verify**:
- `pnpm --filter @octogent/api build`
- `pnpm --filter @octogent/api test`
- `pnpm lint`

---

## 2. Add tests for Claude usage OAuth retry logic

- [x] Add vitest tests for the retry/grace-period behavior in Claude usage polling (`claudeUsage.ts`).

**Why**: `claudeUsage.ts` has constants `CLI_PTY_POST_USAGE_GRACE_MS = 2_500` and `CLI_PTY_USAGE_RETRY_MS = 3_000` that control retry timing. The retry paths (grace period expiry, retry after failure) are the most likely to silently break on upstream API changes.

**What**:
- Read `apps/api/src/claudeUsage.ts` fully to understand the retry flow
- Read `apps/api/tests/claudeUsage.test.ts` to see what's covered
- Add tests for: successful fetch after one retry, fetch that exhausts retries and returns null/error, grace period not yet expired
- Run verification

**Verify**:
- `pnpm --filter @octogent/api build`
- `pnpm --filter @octogent/api test`
- `pnpm lint`

---

## 3. Add tests for claudeSkills discovery

- [ ] Add vitest tests for `claudeSkills.ts` covering skill discovery and resolution.

**Why**: `claudeSkills.ts` is a new file (`a24cb68 feat: add support for suggested skills in tentacles`) with no observed test coverage. Skills are surfaced in the CONTEXT.md of each tentacle — wrong discovery would silently misconfigure worker agents. This is a new, untested surface worth locking down.

**What**:
- Read `apps/api/src/claudeSkills.ts` to understand what it does (skill file scanning, resolution)
- Check `apps/api/tests/` for any existing skill-related tests
- Add tests in a new file `apps/api/tests/claudeSkills.test.ts`: valid skill directory → skills returned, missing directory → empty list, malformed skill file → graceful skip
- Run verification

**Verify**:
- `pnpm --filter @octogent/api build`
- `pnpm --filter @octogent/api test`
- `pnpm lint`

---

## 4. Verify monitor/repository.ts and monitor/types.ts test coverage

- [ ] Check whether `monitor/repository.ts` and `monitor/types.ts` (new files in the expanded monitor module) are exercised by `monitorCore.test.ts` or `monitorApi.test.ts`, and add targeted tests for any gaps.

**Why**: The monitor directory has grown — `repository.ts` and `types.ts` are new files added alongside the existing `service.ts`. The existing tests were written against the old structure. The repository layer (persistent state I/O) is particularly failure-prone and worth explicit coverage.

**What**:
- Read `apps/api/src/monitor/repository.ts` to understand the persistence operations
- Read `apps/api/tests/monitorCore.test.ts` to see if repository functions are currently exercised
- Add tests for: read from missing file → default returned, write then read → round-trip preserved, corrupted file → safe fallback
- Run verification

**Verify**:
- `pnpm --filter @octogent/api build`
- `pnpm --filter @octogent/api test`
- `pnpm lint`
