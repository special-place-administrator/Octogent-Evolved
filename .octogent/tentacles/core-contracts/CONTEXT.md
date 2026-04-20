# Core Contracts

Framework-agnostic domain types, application logic, ports, and lightweight adapters shared by `apps/api` and `apps/web`.

## Scope
- `packages/core/src/domain/` — core types: `terminal.ts` (`TerminalSnapshot`, `AgentState`, `TentacleWorkspaceMode`), `agentRuntime.ts`, `channel.ts`, `completionSound.ts`, `conversation.ts`, `deck.ts`, `git.ts`, `monitor.ts`, `setup.ts`, `uiState.ts`, `usage.ts`
- `packages/core/src/application/` — use-case logic: `buildTerminalList.ts`
- `packages/core/src/ports/` — system boundary interfaces: `TerminalSnapshotReader.ts`
- `packages/core/src/adapters/` — lightweight framework-agnostic adapters: `InMemoryTerminalSnapshotReader.ts`
- `packages/core/src/util/` — pure helpers: `typeCoercion.ts`
- `packages/core/src/index.ts` — barrel export
- `packages/core/AGENTS.md`, `packages/core/package.json`, `packages/core/tsconfig.json`

## Out-of-scope
- No React, HTTP server, PTY, process execution, filesystem persistence, or browser-specific behavior belongs here.
- `apps/api/**` — do NOT touch; each subsystem owns its own code
- `apps/web/**` — do NOT touch; owned by `web-shell` or `web-data-views`

## Project rules
- Keep the ports-and-adapters split clear: `domain/` for types and concepts, `application/` for use-case logic, `ports/` for system boundaries, `adapters/` only when framework-agnostic. — source: `packages/core/AGENTS.md#Design`
- Avoid leaking app-specific naming or transport details into shared types unless that detail is truly part of the domain contract. — source: `packages/core/AGENTS.md#Design`
- Be cautious with exported types and functions — changes here affect both apps. — source: `packages/core/AGENTS.md#Change Discipline`
- When modifying shared contracts, update the dependent call sites and add tests that pin the behavior from the core package outward. — source: `packages/core/AGENTS.md#Change Discipline`
- Prefer additive changes and normalization helpers over breaking contract churn. — source: `packages/core/AGENTS.md#Change Discipline`
- Read `docs/concepts/mental-model.md`, `docs/concepts/tentacles.md`, `docs/concepts/runtime-and-api.md` when changing shared domain terminology. — source: `packages/core/AGENTS.md#Relevant Docs`
- `packages/core` has a standalone typecheck: `pnpm --filter @octogent/core build` runs `tsc -p tsconfig.json --noEmit`. This was confirmed working (`1dd04e8`). — source: `git log 1dd04e8`

## Inherited operator rules
- Use SymForge **read** tools freely. — source: `~/.claude/CLAUDE.md §1`
- **SymForge edit tools are DISABLED inside worktrees.** You are in `.octogent/worktrees/core-contracts/`. Use built-in `Edit`/`Write` with absolute paths inside your worktree. SymForge reads are fine. — source: `~/.claude/CLAUDE.md §1`; observed incident 2026-04-16
- Surgical changes only; do not improve adjacent code. — source: `~/.claude/CLAUDE.md §Surgical changes`
- Before any destructive action, write `.octogent/tentacles/core-contracts/proposed-destructive.md` and stop. — source: tentacle-planner §No-surprise rule

## Verification
- Typecheck (core): `pnpm --filter @octogent/core build` — runs `tsc -p tsconfig.json --noEmit` (confirmed working `1dd04e8`)
- Typecheck (transitive): `pnpm --filter @octogent/api build` and `pnpm --filter @octogent/web build`
- Test: `pnpm -r test` (runs all workspaces)
- Lint: `pnpm lint`

## Commit discipline
- Format: `type(scope): description` — e.g. `feat(core)`, `fix(domain)`, `chore(types)`
- One commit per completed todo item. Commit inside your worktree. Do not push.

## No-surprise rule
Before any destructive action (remove exported types, rename domain concepts, break port interfaces), write the proposed change to `.octogent/tentacles/core-contracts/proposed-destructive.md` and stop until the user acknowledges.

## How to trigger me

    octogent terminal create \
      --tentacle-id core-contracts \
      --workspace-mode worktree \
      --initial-prompt "Read your CONTEXT.md and todo.md in full. You are in a git worktree — do NOT use SymForge edit tools (edit_within_symbol / replace_symbol_body / batch_edit / insert_symbol / batch_insert / batch_rename / delete_symbol); they write to the indexed main repo, not your worktree. Use built-in Edit/Write. SymForge reads are fine. Pick the highest-priority incomplete todo item. Complete it end-to-end: implement, run verification, commit. Report DONE and exit."

## When to run
On-demand — when adding new domain types, extending ports, or normalizing shared contracts across api and web.
