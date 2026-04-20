# Runtime Core

PTY session orchestration, terminal lifecycle, worktree management, hooks, and agent state detection.

## Scope
- `apps/api/src/terminalRuntime.ts` — **hot-spot owner**: orchestrator, `createTerminalRuntime`, wires all runtime subsystems
- `apps/api/src/terminalRuntime/sessionRuntime.ts` — per-session PTY lifecycle, `createSessionRuntime`
- `apps/api/src/terminalRuntime/hookProcessor.ts` — Claude Code hook installation and processing, `createHookProcessor`
- `apps/api/src/terminalRuntime/worktreeManager.ts` — worktree creation/removal/lookup, `createWorktreeManager`
- `apps/api/src/terminalRuntime/gitOperations.ts` — git actions (branch, merge, PR), `createGitOperations`
- `apps/api/src/terminalRuntime/systemClients.ts` — git CLI and gh CLI wrappers, `createDefaultGitClient`
- `apps/api/src/terminalRuntime/conversations.ts` — transcript parsing, `parseRuntimeState`
- `apps/api/src/terminalRuntime/claudeTranscript.ts` — Claude transcript format parsing
- `apps/api/src/terminalRuntime/protocol.ts` — PTY protocol handling
- `apps/api/src/terminalRuntime/ptyEnvironment.ts` — PTY environment variable injection (`OCTOGENT_*` identity vars)
- `apps/api/src/terminalRuntime/channelMessaging.ts` — inter-agent channel messaging
- `apps/api/src/terminalRuntime/registry.ts` — terminal registry persistence
- `apps/api/src/terminalRuntime/constants.ts` — `TENTACLE_WORKTREE_BRANCH_PREFIX`, `TENTACLE_WORKTREE_RELATIVE_PATH`, etc.
- `apps/api/src/terminalRuntime/types.ts` — runtime-internal types, `RuntimeInputError`
- `apps/api/src/agentStateDetection.ts` — `AgentStateTracker`, BEL-code parsing, idle/active state (Stop hook → idle)
- `apps/api/src/setupState.ts` — `markSetupStepVerified`, `markTentaclesInitialized`
- `apps/api/src/setupStatus.ts` — setup status queries
- `apps/api/src/startupPrerequisites.ts` — node/git/gh prerequisite checks
- `apps/api/src/runtimeMetadata.ts` — runtime metadata helpers
- `apps/api/src/projectPersistence.ts` — project-level persistence utilities
- `apps/api/src/cli.ts` — CLI entry point
- `apps/api/src/server.ts` — process entry point
- `apps/api/tests/sessionRuntime.test.ts`
- `apps/api/tests/hookDrivenBootstrap.test.ts`
- `apps/api/tests/agentStateDetection.test.ts`
- `apps/api/tests/protocol.test.ts`
- `apps/api/tests/startupPrerequisites.test.ts`
- `apps/api/tests/upgradeHandler.test.ts`
- `apps/api/tests/logging.test.ts`

## Out-of-scope
- `apps/api/src/createApiServer/**` — do NOT touch; owned by `api-server`
- `apps/api/src/monitor/**` — do NOT touch; owned by `monitor-and-usage`
- `apps/api/src/claudeUsage.ts`, `codexUsage.ts` — do NOT touch; owned by `monitor-and-usage`
- `packages/core/**` — do NOT touch; owned by `core-contracts`

## Project rules
- Treat PTY/session lifecycle code as stateful and failure-prone; handle cleanup, disconnects, and partial failures explicitly. — source: `apps/api/AGENTS.md#PTY, Process, And Git Safety`
- For worktree operations, prioritize correctness and recoverability over clever automation. — source: `apps/api/AGENTS.md#PTY, Process, And Git Safety`
- Avoid destructive filesystem or git behavior unless the task explicitly requires it and the UI/API surface makes the action clear. — source: `apps/api/AGENTS.md#PTY, Process, And Git Safety`
- Prefer explicit migration or normalization paths over silent shape drift in `.octogent/` state files. — source: `apps/api/AGENTS.md#State And Persistence`
- Reproduce bugs with a test before changing runtime logic when feasible. — source: `apps/api/AGENTS.md#Testing`
- The back-to-idle signal is the Stop hook, NOT `idle_prompt`. Bootstrap is gated on hook signals, not timers. — source: `git log 132c1b8`, `19b9bd5`
- Hooks are always regenerated fresh on install (not patched); hook URLs refresh on server restart. — source: `git log 73a33a8`, `937c2ac`
- `OCTOGENT_*` identity env vars are injected into every PTY via `ptyEnvironment.ts`. — source: `git log a8cc2cd`
- Any terminal output (not just pattern matches) triggers state processing. — source: `git log 8a93cff`

## Inherited operator rules
- Use SymForge **read** tools freely. — source: `~/.claude/CLAUDE.md §1`
- **SymForge edit tools are DISABLED inside worktrees.** You are in `.octogent/worktrees/runtime-core/`. Use built-in `Edit`/`Write` with absolute paths inside your worktree instead. SymForge reads are fine. — source: `~/.claude/CLAUDE.md §1`; observed incident 2026-04-16
- Surgical changes only; do not improve adjacent code. — source: `~/.claude/CLAUDE.md §Surgical changes`
- No features beyond what was asked. — source: `~/.claude/CLAUDE.md §Simplicity first`
- Before any destructive action, write `.octogent/tentacles/runtime-core/proposed-destructive.md` and stop until user acknowledges. — source: tentacle-planner prompt §No-surprise rule

## Verification
- Typecheck: `pnpm --filter @octogent/api build` (runs `tsc --noEmit`)
- Test: `pnpm --filter @octogent/api test` (vitest run)
- Lint: `pnpm lint` (biome check from repo root)

## Commit discipline
- Format: `type(scope): description` — examples: `fix(state): use Stop hook, not idle_prompt, as the back-to-idle signal`, `fix(runtime): gate claude bootstrap on hook signals instead of timers`
- Scope: `fix(runtime)`, `fix(hooks)`, `fix(bootstrap)`, `fix(worktree)`, `test(runtime)`
- One commit per completed todo item. Commit inside your worktree. Do not push.

## No-surprise rule
Before any destructive action (delete PTY processes, remove worktrees, change hook format), write the proposed change to `.octogent/tentacles/runtime-core/proposed-destructive.md` and stop until the user acknowledges.

## How to trigger me

    octogent terminal create \
      --tentacle-id runtime-core \
      --workspace-mode worktree \
      --initial-prompt "Read your CONTEXT.md and todo.md in full. You are in a git worktree — do NOT use SymForge edit tools (edit_within_symbol / replace_symbol_body / batch_edit / insert_symbol / batch_insert / batch_rename / delete_symbol); they write to the indexed main repo, not your worktree. Use built-in Edit/Write. SymForge reads are fine. Pick the highest-priority incomplete todo item. Complete it end-to-end: implement, run verification, commit. Report DONE and exit."

## When to run
On-demand — when fixing PTY lifecycle bugs, hook behavior, worktree operations, or agent state detection.
