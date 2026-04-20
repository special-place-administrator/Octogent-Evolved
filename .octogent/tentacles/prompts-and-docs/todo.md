# Todo

## 1. Update docs to reflect Stop-hook idle-signal change

- [ ] Update `docs/concepts/runtime-and-api.md` and/or `docs/reference/troubleshooting.md` to document that the back-to-idle signal is the Stop hook, not `idle_prompt`.

**Why**: Commit `132c1b8 fix(state): use Stop hook, not idle_prompt, as the back-to-idle signal` changed runtime behavior but the concept docs still describe the old `idle_prompt` mechanism (or are silent on this). Any operator or agent reading the docs to diagnose idle-detection issues will get incorrect guidance. Commit `8da16ca docs(readme): divergence-log entry for idle-signal state fix` added a README entry but the concept docs were not updated.

**What**:
- Read `docs/concepts/runtime-and-api.md` and `docs/reference/troubleshooting.md`
- Find any reference to `idle_prompt` as an idle signal and correct it to describe the Stop hook
- If no explicit description exists, add a short paragraph explaining the Stop hook → idle transition
- Do not touch code files

**Verify**:
- Read the updated doc to confirm the description is accurate against the code behavior (check `apps/api/src/agentStateDetection.ts` as reference — read only)
- `pnpm lint`

---

## 2. Add a `docs/guides/worktree-workflow.md` guide

- [ ] Write a new guide explaining the worktree-based agent workflow: tentacle → worktree terminal → implement → commit → merge back.

**Why**: `docs/guides/` has `working-with-todos.md`, `orchestrating-child-agents.md`, and `inter-agent-messaging.md` but no guide on the worktree workflow — the primary isolation mechanism for parallel agents. The mental model doc mentions worktrees vs tentacles but doesn't explain the operational flow. Any new user or agent trying to understand why they're in a worktree and what to do at the end has no reference document.

**What**:
- Read `docs/concepts/mental-model.md` and `docs/concepts/tentacles.md` for vocabulary
- Read `docs/reference/filesystem-layout.md` for `.octogent/worktrees/` path structure
- Write `docs/guides/worktree-workflow.md` covering: what a worktree is, how it's created, how agents work inside it (Edit/Write not SymForge edits), how to commit, how the merge back to main happens
- Keep it concise — 2–4 sections, no code examples required

**Verify**:
- Read the file back and check it is consistent with `docs/concepts/mental-model.md` vocabulary
- `pnpm lint`

---

## 3. Audit `tentacle-planner.md` prompt for accuracy after recent fork changes

- [ ] Read `prompts/tentacle-planner.md` against the current codebase state and note any stale references (e.g. old CLI flags, removed API endpoints, changed file paths).

**Why**: `prompts/tentacle-planner.md` references CLI commands, API endpoints, and file paths that may have shifted during recent work. A stale prompt causes agents to invoke wrong commands. The 10-option menu was added (`9a65b7e`) but earlier sections may reference outdated patterns.

**What**:
- Read `prompts/tentacle-planner.md` in full
- Cross-check any `octogent terminal create` CLI flags against actual CLI behavior (read `apps/api/src/cli.ts` — read only)
- Fix any stale CLI flags, wrong file paths, or removed options directly in the prompt file
- Do not restructure the prompt — surgical corrections only

**Verify**:
- Read the updated prompt and confirm all CLI commands and file paths are accurate
- `pnpm lint`

---

## 4. Write `docs/reference/cli.md` content

- [ ] Populate `docs/reference/cli.md` with current CLI command reference based on actual CLI source.

**Why**: `docs/reference/cli.md` exists as a file but may be empty or a placeholder (it's a new file, added alongside the CLI refactor). Operators using the CLI directly have no documentation. This is a quick win — read the CLI source and write the reference.

**What**:
- Read `apps/api/src/cli.ts` to understand all available commands and flags (read only)
- Read `docs/reference/cli.md` to see current content (may be empty)
- Write a concise CLI reference: each command, its flags, and a one-line description
- Keep it in the style of other reference docs (`docs/reference/api.md`, `docs/reference/filesystem-layout.md`)

**Verify**:
- Read the file back and confirm it matches the actual CLI source
- `pnpm lint`
