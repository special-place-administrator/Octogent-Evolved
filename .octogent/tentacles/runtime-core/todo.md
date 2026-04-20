# Todo

## 1. Add test coverage for worktree cleanup on delete failure

- [ ] Add a vitest test that verifies best-effort worktree cleanup runs even when the git command fails during tentacle deletion.

**Why**: Commit `3509c80 fix(delete): best-effort worktree cleanup so git hiccups don't leave ghosts` fixed a real bug but only the fix is in code — no regression test was added. Without a test, a future refactor could silently reintroduce the ghost-worktree bug.

**What**:
- Read `apps/api/src/terminalRuntime/worktreeManager.ts` to find the deletion path
- Read `apps/api/tests/sessionRuntime.test.ts` for the existing `FakePty`/`FakeGitClient` patterns
- Add a test: configure `FakeGitClient` to throw on `worktree remove`, assert cleanup still runs and no error surfaces to the caller
- Run verification

**Verify**:
- `pnpm --filter @octogent/api build`
- `pnpm --filter @octogent/api test`
- `pnpm lint`

---

## 2. Add test for hook URL refresh on server restart

- [ ] Add a vitest test verifying that stale hook URLs are refreshed when the server restarts.

**Why**: Commit `937c2ac fix(hooks): refresh stale hook URLs on server restart` fixed a real bug. There is no regression test in `hookDrivenBootstrap.test.ts` that exercises the "existing hooks with stale URL → refresh" path. The existing tests cover fresh install but not re-install over stale state.

**What**:
- Read `apps/api/src/terminalRuntime/hookProcessor.ts` `installHooksInDirectory` function
- Read `apps/api/tests/hookDrivenBootstrap.test.ts` for existing patterns
- Add a test: write a settings.json with an old `apiBaseUrl` hook entry, call install, assert the URL is updated
- Run verification

**Verify**:
- `pnpm --filter @octogent/api build`
- `pnpm --filter @octogent/api test`
- `pnpm lint`

---

## 3. Add test for Stop-hook back-to-idle signal

- [ ] Add or extend a vitest test verifying that `AgentStateTracker` transitions to idle on the Stop hook signal, not on `idle_prompt`.

**Why**: Commit `132c1b8 fix(state): use Stop hook, not idle_prompt, as the back-to-idle signal` was a correctness fix for a mis-wired state transition. The fix is untested — `agentStateDetection.test.ts` may not have a test covering the Stop-hook idle path specifically.

**What**:
- Read `apps/api/tests/agentStateDetection.test.ts` to see what's already covered
- Read `apps/api/src/agentStateDetection.ts` to understand the Stop-hook path
- Add a test: simulate a Stop hook event, assert `AgentStateTracker` moves to idle; also assert that an `idle_prompt` event alone does NOT trigger idle transition
- Run verification

**Verify**:
- `pnpm --filter @octogent/api build`
- `pnpm --filter @octogent/api test`
- `pnpm lint`

---

## 4. Add tests for ptyEnvironment OCTOGENT_* injection

- [ ] Add a vitest test verifying that `ptyEnvironment.ts` injects the expected `OCTOGENT_*` identity env vars into each PTY session.

**Why**: Commit `a8cc2cd feat(runtime): inject OCTOGENT_* identity env vars into every pty` added identity injection but has no dedicated test. These vars are how agents know their own tentacle ID and workspace — a regression here would silently break agent self-identification.

**What**:
- Read `apps/api/src/terminalRuntime/ptyEnvironment.ts` to understand what vars are injected and how
- Read `apps/api/tests/sessionRuntime.test.ts` for the existing PTY mock patterns
- Add a test: spawn a session, assert the PTY process received the expected `OCTOGENT_*` vars
- Run verification

**Verify**:
- `pnpm --filter @octogent/api build`
- `pnpm --filter @octogent/api test`
- `pnpm lint`
