# Monitor & Usage

Monitor service (agent activity feed), Claude/Codex usage polling, GitHub repo summary, and prompt resolver.

## Scope
- `apps/api/src/monitor/` — entire directory: `service.ts` (`createMonitorService`, `toFeedSnapshot`, `isMonitorCacheStale`, `sanitizeConfig`), `repository.ts`, `types.ts`, `index.ts`, `defaults.ts`, `xProvider.ts`
- `apps/api/src/claudeUsage.ts` — OAuth usage polling, `readClaudeCliUsageSnapshot`, `CLAUDE_OAUTH_USAGE_URL`
- `apps/api/src/claudeSessionScanner.ts` — Claude session file scanner
- `apps/api/src/claudeSkills.ts` — Claude skills discovery and resolution
- `apps/api/src/codexUsage.ts` — Codex usage API, `resolveCodexHome`, credential parsing
- `apps/api/src/githubRepoSummary.ts` — GitHub repo stats, commit diff stats
- `apps/api/src/usageUtils.ts` — shared usage utilities
- `apps/api/src/prompts/promptResolver.ts` — prompt file resolution from `.octogent/prompts/`
- `apps/api/src/prompts/index.ts` — prompts barrel export
- `apps/api/tests/monitorApi.test.ts`
- `apps/api/tests/monitorCore.test.ts`
- `apps/api/tests/claudeUsage.test.ts`
- `apps/api/tests/codexUsage.test.ts`
- `apps/api/tests/githubRepoSummary.test.ts`
- `apps/api/tests/promptResolver.test.ts`
- `apps/api/tests/xMonitorProvider.test.ts`

## Out-of-scope
- `apps/api/src/createApiServer/monitorRoutes.ts` — HTTP route wiring; owned by `api-server` (read-only here)
- `apps/api/src/createApiServer/usageRoutes.ts` — HTTP route wiring; owned by `api-server` (read-only here)
- `apps/api/src/terminalRuntime/**` — do NOT touch; owned by `runtime-core`
- `packages/core/**` — do NOT touch; owned by `core-contracts`

## Project rules
- Monitor config and cache files under global state dir (`~/.octogent/projects/<id>/state/monitor-*.json`) are a contract surface — be careful with schema changes. — source: `apps/api/AGENTS.md#State And Persistence`
- Prefer explicit normalization paths over silent shape drift. — source: `apps/api/AGENTS.md#State And Persistence`
- Add targeted tests for persistence compatibility and runtime edge cases when touching monitor cache or usage polling. — source: `apps/api/AGENTS.md#Testing`
- `promptResolver.ts` has moved to `apps/api/src/prompts/promptResolver.ts` — do not edit the old location if it resurfaces. — source: observed file structure 2026-04-21

## Inherited operator rules
- Use SymForge **read** tools freely. — source: `~/.claude/CLAUDE.md §1`
- **SymForge edit tools are DISABLED inside worktrees.** You are in `.octogent/worktrees/monitor-and-usage/`. Use built-in `Edit`/`Write` with absolute paths inside your worktree. SymForge reads are fine. — source: `~/.claude/CLAUDE.md §1`; observed incident 2026-04-16
- Surgical changes only; do not improve adjacent code. — source: `~/.claude/CLAUDE.md §Surgical changes`
- Before any destructive action, write `.octogent/tentacles/monitor-and-usage/proposed-destructive.md` and stop. — source: tentacle-planner §No-surprise rule

## Verification
- Typecheck: `pnpm --filter @octogent/api build`
- Test: `pnpm --filter @octogent/api test`
- Lint: `pnpm lint`

## Commit discipline
- Format: `type(scope): description` — e.g. `fix(monitor)`, `fix(usage)`, `feat(github-summary)`
- One commit per completed todo item. Commit inside your worktree. Do not push.

## No-surprise rule
Before any destructive action, write the proposed change to `.octogent/tentacles/monitor-and-usage/proposed-destructive.md` and stop until the user acknowledges.

## How to trigger me

    octogent terminal create \
      --tentacle-id monitor-and-usage \
      --workspace-mode worktree \
      --initial-prompt "Read your CONTEXT.md and todo.md in full. You are in a git worktree — do NOT use SymForge edit tools (edit_within_symbol / replace_symbol_body / batch_edit / insert_symbol / batch_insert / batch_rename / delete_symbol); they write to the indexed main repo, not your worktree. Use built-in Edit/Write. SymForge reads are fine. Pick the highest-priority incomplete todo item. Complete it end-to-end: implement, run verification, commit. Report DONE and exit."

## When to run
On-demand — when fixing monitor feed behavior, usage polling, GitHub summary, skills discovery, or prompt resolution.
