# Todo

## 1. Add request-parsing tests for deck todo routes

- [x] Add targeted vitest tests covering the request parsers for todo-add, todo-edit, todo-delete, and todo-toggle routes in `deckRoutes.ts`.

**Why**: `apps/api/AGENTS.md#Testing` requires targeted tests for request parsing when touching those surfaces. The deck todo routes (L241–391 in `deckRoutes.ts`) have no dedicated parser tests in `createApiServer.test.ts` — only integration-level coverage. Parsing edge cases (malformed body, missing fields, oversized payload) are untested.

**What**:
- Read `apps/api/src/createApiServer/deckRoutes.ts` L241–391 and `apps/api/src/createApiServer/requestParsers.ts`
- Add unit tests in `apps/api/tests/createApiServer.test.ts` for each todo mutation route: valid input, missing required fields, body-too-large
- Run `pnpm --filter @octogent/api test` to confirm passing

**Verify**:
- `pnpm --filter @octogent/api build`
- `pnpm --filter @octogent/api test`
- `pnpm lint`

---

## 2. Add request-parsing tests for git routes

- [x] Add targeted vitest tests for the git route parsers in `gitParsers.ts` and `gitRoutes.ts`.

**Why**: `gitParsers.ts` (`parseTentaclePullRequestCreateInput`) and `gitRoutes.ts` (`handleTentacleGitRoute`, `handleTentacleGitPullRequestRoute`) have no dedicated parser unit tests. The git flow (commit → PR create → PR merge) is a high-value path with no parser-level coverage observed in the test suite.

**What**:
- Read `apps/api/src/createApiServer/gitParsers.ts` and `apps/api/src/createApiServer/gitRoutes.ts`
- Add tests in `apps/api/tests/gitParsers.test.ts`: valid PR create payload, missing fields, invalid action type
- Run verification

**Verify**:
- `pnpm --filter @octogent/api build`
- `pnpm --filter @octogent/api test`
- `pnpm lint`

---

## 3. Audit swarm route for missing error-path tests

- [x] Review `handleDeckTentacleSwarmRoute` in `deckRoutes.ts` and add tests for the key error paths not yet covered.

**Why**: `handleDeckTentacleSwarmRoute` is the longest route handler and the most complex orchestration surface. Error paths (already-active agent, invalid tentacle id, missing todo) are untested.

**What**:
- Read `apps/api/src/createApiServer/deckRoutes.ts` swarm handler section
- Identify the 3–4 most important error paths (already-active check, invalid payload, missing worktree)
- Add tests in `apps/api/tests/createApiServer.test.ts` using the existing `FakeGitClient` / fake runtime pattern
- Do not test the happy-path spawn flow if it requires real PTY — focus on the synchronous validation paths

**Verify**:
- `pnpm --filter @octogent/api build`
- `pnpm --filter @octogent/api test`
- `pnpm lint`

---

## 4. Add tests for terminalRoutes and terminalParsers

- [ ] Add targeted vitest tests for the new `terminalRoutes.ts` and `terminalParsers.ts` modules.

**Why**: `terminalRoutes.ts` and `terminalParsers.ts` are new files added during the workspace-setup and initial-input-draft work (`972db6c`, `b5e5664`). They have no dedicated test coverage visible in `createApiServer.test.ts`. Terminal create/delete/rename are high-impact routes — missing coverage means regressions go undetected.

**What**:
- Read `apps/api/src/createApiServer/terminalRoutes.ts` and `apps/api/src/createApiServer/terminalParsers.ts`
- Add tests in `apps/api/tests/createApiServer.test.ts`: valid terminal create, missing required fields, invalid workspace mode
- Run verification

**Verify**:
- `pnpm --filter @octogent/api build`
- `pnpm --filter @octogent/api test`
- `pnpm lint`

---

## 5. Add tests for conversationRoutes

- [ ] Add targeted vitest tests for `conversationRoutes.ts`.

**Why**: `conversationRoutes.ts` is a new route file with no observed test coverage. Conversation/transcript routes are read by the ActivityPrimaryView and ConversationsPrimaryView — errors here silently break the conversation tab for users.

**What**:
- Read `apps/api/src/createApiServer/conversationRoutes.ts` to understand the routes exposed
- Add tests in `apps/api/tests/createApiServer.test.ts`: valid request, missing terminal id, unknown session
- Run verification

**Verify**:
- `pnpm --filter @octogent/api build`
- `pnpm --filter @octogent/api test`
- `pnpm lint`
