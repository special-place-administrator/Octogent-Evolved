# Prompts & Docs

Agent-facing prompt templates and developer-facing documentation — they co-evolve since prompts cite docs and docs describe expected prompt behavior.

## Scope
- `prompts/` — all prompt templates:
  - `prompts/tentacle-planner.md` — orchestrator prompt for planning tentacle layout (10-option menu added in `9a65b7e`)
  - `prompts/tentacle-worker.md` — worker prompt for executing todo items
  - `prompts/swarm-worker.md` — swarm worker prompt (mandates DONE/BLOCKED commit marker)
  - `prompts/swarm-parent.md` — swarm parent/coordinator prompt
  - `prompts/tentacle-context-init.md` — initial context setup prompt
  - `prompts/tentacle-update-tentacle.md` — tentacle self-update prompt
  - `prompts/tentacle-reorganize-todos.md` — todo reorganization prompt
  - `prompts/octoboss-clean-contexts.md` — octoboss clean contexts prompt
  - `prompts/octoboss-reorganize-tentacles.md` — octoboss reorganize tentacles prompt
  - `prompts/octoboss-reorganize-todos.md` — octoboss reorganize todos prompt
  - `prompts/sandbox-init.md` — sandbox initialization prompt
  - `prompts/meta-prompt-generator.md` — meta prompt generator
- `docs/` — all documentation:
  - `docs/concepts/` — `mental-model.md`, `tentacles.md`, `runtime-and-api.md`
  - `docs/guides/` — `working-with-todos.md`, `orchestrating-child-agents.md`, `inter-agent-messaging.md`
  - `docs/reference/` — `api.md`, `cli.md`, `filesystem-layout.md`, `troubleshooting.md`, `experimental-features.md`
  - `docs/getting-started/` — `installation.md`, `quickstart.md`
  - `docs/index.md`
- `README.md`

## Out-of-scope
- **All code** — this tentacle only edits markdown. Any code behavior change described in a doc must be implemented in the owning code tentacle first.
- `apps/**`, `packages/**` — do NOT touch
- `.octogent/tentacles/**` — tentacle context files are managed by the planner and individual agents, not by this tentacle

## Project rules
- Prompts are synced from `prompts/` to `.octogent/prompts/core/` at runtime — edits here are the source of truth; don't edit the synced copies. — source: `docs/reference/filesystem-layout.md#Prompt storage`
- The first heading and first non-empty paragraph of a prompt file are used by the runtime as display name and description. — source: `docs/concepts/tentacles.md#Definition`
- `swarm-worker.md` mandates a DONE/BLOCKED commit marker — do not remove this requirement. — source: `git log 977e786`
- The tentacle-planner prompt now has a 10-option menu (option 10 = Remap). Do not remove the numbered menu format. — source: `git log 9a65b7e`
- `docs/reference/cli.md` is a new reference file — keep it in sync with actual CLI flags in `apps/api/src/cli.ts`. — source: observed file structure 2026-04-21
- When changing runtime behavior descriptions in docs, verify the behavior in the relevant code tentacle first. — **TO-VERIFY**: confirm this workflow matches how the team actually operates

## Inherited operator rules
- Use SymForge **read** tools freely. — source: `~/.claude/CLAUDE.md §1`
- **SymForge edit tools are DISABLED inside worktrees.** You are in `.octogent/worktrees/prompts-and-docs/`. Use built-in `Edit`/`Write` with absolute paths inside your worktree. SymForge reads are fine. — source: `~/.claude/CLAUDE.md §1`; observed incident 2026-04-16
- Surgical changes only; do not rewrite docs orthogonal to the task. — source: `~/.claude/CLAUDE.md §Surgical changes`
- Before any destructive action, write `.octogent/tentacles/prompts-and-docs/proposed-destructive.md` and stop. — source: tentacle-planner §No-surprise rule

## Verification
- Markdown lint: `pnpm lint` (biome check from repo root — **TO-VERIFY** whether it covers `.md` files)
- Prompt sync: `ls .octogent/prompts/core/` to confirm synced copies exist after editing (runtime syncs on startup)
- No build step required for docs-only changes

## Commit discipline
- Format: `type(scope): description` — examples: `docs(readme): divergence-log entry for idle-signal state fix`, `fix(prompts): swarm-worker also mandates DONE/BLOCKED commit marker`, `feat(prompts): add 10-option menu to tentacle-planner`
- Scope: `docs(readme)`, `docs(concepts)`, `docs(guides)`, `fix(prompts)`, `feat(prompts)`
- One commit per completed todo item. Commit inside your worktree. Do not push.

## No-surprise rule
Before removing or renaming a prompt file that the runtime references by path, write the proposed change to `.octogent/tentacles/prompts-and-docs/proposed-destructive.md` and stop until the user acknowledges.

## How to trigger me

    octogent terminal create \
      --tentacle-id prompts-and-docs \
      --workspace-mode worktree \
      --initial-prompt "Read your CONTEXT.md and todo.md in full. You are in a git worktree — do NOT use SymForge edit tools (edit_within_symbol / replace_symbol_body / batch_edit / insert_symbol / batch_insert / batch_rename / delete_symbol); they write to the indexed main repo, not your worktree. Use built-in Edit/Write. SymForge reads are fine. Pick the highest-priority incomplete todo item. Complete it end-to-end: implement, run verification, commit. Report DONE and exit."

## When to run
On-demand — when prompt behavior has changed in code and docs need updating, or when standalone doc improvements are needed.
