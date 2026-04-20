# API Server

HTTP/WebSocket routing, request parsing, route handlers, and static file serving.

## Scope
- `apps/api/src/createApiServer.ts` — server factory, wires runtime into request handler
- `apps/api/src/createApiServer/requestHandler.ts` — **hot-spot owner**: central route dispatch map (`API_ROUTE_MAP`), static file serving, MIME types
- `apps/api/src/createApiServer/deckRoutes.ts` — tentacle CRUD, todo management (toggle/edit/add/delete/solve), swarm spawn, skill discovery
- `apps/api/src/createApiServer/terminalRoutes.ts` — terminal create/delete/rename routes
- `apps/api/src/createApiServer/conversationRoutes.ts` — conversation/transcript routes
- `apps/api/src/createApiServer/gitRoutes.ts` — worktree git actions, PR creation and merge
- `apps/api/src/createApiServer/gitParsers.ts` — input parsers for git route payloads
- `apps/api/src/createApiServer/miscRoutes.ts` — hook install route, workspace setup step verification
- `apps/api/src/createApiServer/monitorRoutes.ts` — monitor feed HTTP route (service impl lives in `monitor-and-usage`)
- `apps/api/src/createApiServer/usageRoutes.ts` — Claude/Codex usage HTTP routes (service impl lives in `monitor-and-usage`)
- `apps/api/src/createApiServer/codeIntelRoutes.ts` — CodeIntel SSE event route
- `apps/api/src/createApiServer/uiStateParsers.ts` — UI state patch input parsers
- `apps/api/src/createApiServer/terminalParsers.ts` — terminal route input parsers
- `apps/api/src/createApiServer/monitorParsers.ts` — monitor route input parsers
- `apps/api/src/createApiServer/requestParsers.ts` — shared request body parsers, `RequestBodyTooLargeError`
- `apps/api/src/createApiServer/routeHelpers.ts` — shared route utilities
- `apps/api/src/createApiServer/security.ts` — path traversal prevention, XSS sanitizer
- `apps/api/src/createApiServer/types.ts` — route-layer types
- `apps/api/src/deck/readDeckTentacles.ts` — deck tentacle read logic (called from routes)
- `apps/api/src/codeIntelStore.ts` — CodeIntel state store (consumed by codeIntelRoutes)
- `apps/api/tests/createApiServer.test.ts` — integration + unit tests for route behavior
- `apps/api/tests/gitParsers.test.ts` — dedicated unit tests for git parsers

## Out-of-scope
- `apps/api/src/terminalRuntime.ts` — do NOT touch; owned by `runtime-core`
- `apps/api/src/terminalRuntime/**` — do NOT touch; owned by `runtime-core`
- `apps/api/src/monitor/**` — do NOT touch; owned by `monitor-and-usage`
- `apps/api/src/claudeUsage.ts`, `codexUsage.ts`, `githubRepoSummary.ts` — do NOT touch; owned by `monitor-and-usage`
- `apps/api/src/prompts/**` — do NOT touch; owned by `monitor-and-usage`
- `apps/api/src/claudeSkills.ts` — do NOT touch; owned by `monitor-and-usage`
- `packages/core/**` — do NOT touch; owned by `core-contracts`

## Project rules
- Treat `packages/core` as the source of framework-agnostic types; adapt input into core shapes in route handlers but avoid embedding large business rules directly there. — source: `apps/api/AGENTS.md#Boundaries`
- Keep request parsing, route wiring, runtime orchestration, and persistence concerns in separate modules when structure already supports it. — source: `apps/api/AGENTS.md#Boundaries`
- Do not make the web app depend on server-only implementation details; expose stable API/runtime contracts instead. — source: `apps/api/AGENTS.md#Boundaries`
- Runtime state under `.octogent/` is a contract surface — be careful with compatibility when changing file formats or paths. — source: `apps/api/AGENTS.md#State And Persistence`
- Add targeted tests for request parsing and route behavior when touching those surfaces; reproduce bugs with a test before changing logic. — source: `apps/api/AGENTS.md#Testing`
- Security: path traversal prevention and XSS sanitization are in `security.ts` — any new route that accepts user-supplied paths or HTML must run them through this module. — source: `git log c61a1e0`

## Inherited operator rules
- Use SymForge **read** tools freely (`get_symbol`, `search_symbols`, `get_file_context`, `search_text`, `explore`, etc.). — source: `~/.claude/CLAUDE.md §1`
- **SymForge edit tools are DISABLED inside worktrees.** You are in `.octogent/worktrees/api-server/`. SymForge edit tools (`edit_within_symbol`, `replace_symbol_body`, `batch_edit`, `insert_symbol`, `batch_insert`, `batch_rename`, `delete_symbol`) resolve paths against the indexed main repo — any edit silently writes there, not your worktree. Use built-in `Edit`/`Write` with absolute paths inside your worktree. — source: `~/.claude/CLAUDE.md §1`; observed incident 2026-04-16
- Surgical changes only: touch only what the task requires; do not improve adjacent code, comments, or formatting. — source: `~/.claude/CLAUDE.md §Surgical changes`
- No features beyond what was asked; no abstractions for single-use code. — source: `~/.claude/CLAUDE.md §Simplicity first`
- Before any destructive action, write `.octogent/tentacles/api-server/proposed-destructive.md` and stop until user acknowledges. — source: tentacle-planner prompt §No-surprise rule

## Verification
- Typecheck: `pnpm --filter @octogent/api build` (runs `tsc --noEmit`)
- Test: `pnpm --filter @octogent/api test` (vitest run)
- Lint: `pnpm lint` (biome check from repo root)

## Commit discipline
- Format: `type(scope): description` — examples from repo: `fix(hooks): always regenerate octogent hooks fresh on install`, `feat(swarm): direct worker spawning, claim-based idempotent spawn`
- Scope: area changed — e.g. `fix(routes)`, `feat(deck)`, `test(api)`, `fix(git)`, `fix(security)`
- One commit per completed todo item. Commit inside your worktree. Do not push.

## No-surprise rule
Before any destructive action (delete files, remove branches, change public API contracts), write the proposed change to `.octogent/tentacles/api-server/proposed-destructive.md` and stop until the user acknowledges.

## How to trigger me

    octogent terminal create \
      --tentacle-id api-server \
      --workspace-mode worktree \
      --initial-prompt "Read your CONTEXT.md and todo.md in full. You are in a git worktree — do NOT use SymForge edit tools (edit_within_symbol / replace_symbol_body / batch_edit / insert_symbol / batch_insert / batch_rename / delete_symbol); they write to the indexed main repo, not your worktree. Use built-in Edit/Write. SymForge reads are fine. Pick the highest-priority incomplete todo item. Complete it end-to-end: implement, run verification, commit. Report DONE and exit."

## When to run
On-demand — when adding routes, fixing request parsing bugs, or extending the deck/git/terminal/conversation route surfaces.
