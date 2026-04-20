<div align="center">

<img width="1500" height="500" alt="Octogent header" src="./static/images/octogent-header.png" />
<br/>
<br/>

<strong>too many terminals, not enough tentacles</strong>
<br />
<br />

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22+-5FA04E?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Fork of](https://img.shields.io/badge/fork%20of-hesamsheikh%2Foctogent-0A84FF?style=flat-square&logo=github)](https://github.com/hesamsheikh/octogent)

</div>

# Octogent-Evolved

> **Fork of [hesamsheikh/octogent](https://github.com/hesamsheikh/octogent)** by **Hesam Sheikh** — original design, canvas UI, tentacle/worktree model, and channel-messaging primitive. This fork hardens the swarm-orchestration flow for real multi-worker workloads and adds canvas task visibility, security hardening, and coordinator self-cleanup. See [`NOTICE.md`](./NOTICE.md) for attribution in full.

It's really not fun to have **ten Claude Code sessions open at once**, constantly switching between them and trying to remember what each one was supposed to do. *Things get blurry fast* when one agent is doing documentation, another is touching the database, another is changing the API, and another is somewhere in the frontend. **Octogent** gives each job its own <u>scoped context, notes, and task list</u>, while also making it possible for Claude Code to **spawn other Claude Code agents**, assign them work, and communicate with them.

## The Vision

Treat terminal coding agents as parts of a bigger orchestration layer — not the final interface by themselves. The point is not to hide **Claude Code** behind abstractions; the point is to make *multi-agent work less chaotic for the developer* on a real codebase.

## What Octogent Does for You

- **Creates tentacles as context layers** so agents work with scoped markdown files instead of broad, messy chat context
- **Uses `todo.md` as an execution surface** so tasks stay visible, trackable, and ready for delegation
- **Runs multiple Claude Code terminals** so one developer can coordinate several coding sessions at once
- **Spawns child agents from todo items** so parallel work has a concrete source of truth
- **Supports inter-agent messaging** so workers and coordinators can report completion, blockers, and handoff notes
- **Keeps agent-facing context in files** so the system is more durable than a single prompt thread
- **Shows live todo progress on the canvas** — color-coded fractions and checkmarks directly on each octopus node
- **Auto-cleans swarm sessions** — coordinator deletes all worker terminals then itself after all merges land
- **Provides a local API and UI** for terminal lifecycle, persistence, websocket transport, and orchestration

A **tentacle** is a folder under `.octogent/tentacles/<tentacle-id>/` that holds agent-readable markdown such as `CONTEXT.md`, `todo.md`, and any extra notes needed for that slice of the codebase. The octopus metaphor is literal: *one octopus, many tentacles, different work happening at the same time*.

---

## Divergence from upstream

This fork began on `fix/swarm-orchestration` with the goal of making the swarm flow actually work end-to-end for multi-worker tentacles under real load. Upstream's swarm path had silent failure modes at several layers. The merged commits below, listed in merge order, address each one.

### Swarm correctness

| Commit | Area | Summary |
|---|---|---|
| `77f902d` | CLI path | Parent-coordinator prompts no longer run `node bin/octogent`; they use the PATH-resolved `octogent` command. Fixes silent worker-spawn failures from any cwd that isn't the octogent package directory. |
| `b2b1818` | UI | "Create Agent" now exposes a workspace-mode picker. Context-menu entry correctly scopes worktree terminals to the clicked tentacle (was hardcoded to the root). |
| `e391734` | Planner prompt | `prompts/tentacle-planner.md` rewritten as a 5-phase low-interaction orchestrator with at most two user checkpoints (layout approval + auto-spawn confirmation). Mandates `- [ ]` checkbox format for `todo.md` so `parseTodoProgress` doesn't 400. |
| `e8c9a0f` | Bootstrap | Claude-code terminals now receive `/effort auto` as part of their boot sequence. |
| `6d119f6` | Planner prompt | Adds the "SymForge edit tools are read-only inside a worktree" guardrail so workers don't silently write into the main index. |
| `31b5afe` | UI | "Create Agent" auto-injects the `tentacle-worker` prompt template with proper identity substitution. |
| `fd66f50` | Worker flow | Six-fix polish batch for GUI-native orchestration (template variable threading, context-menu scoping, misc). |
| `2cbf7de` | Runtime | Tentacle-scoped worktrees now persist across terminal cascade cleanup. Free-standing worker worktrees still auto-clean. |
| `f2a8392` | Swarm spawn | API spawns all workers directly instead of asking the parent to shell-exec them. Adds claim-based idempotent spawn and a worker-count picker (1–9) in the panel. |
| `2c322d6` | PTY | First-pass timing fix for the "[Pasted text #1 +N lines]" staging race where multiple concurrent spawns left prompts unsubmitted. `INITIAL_PROMPT_SUBMIT_DELAY_MS` bumped to 2000 ms + 500 ms stagger between worker spawns. Superseded by `19b9bd5`. |
| `19b9bd5` | PTY | Replaces the fixed-timer paste-and-pray bootstrap for claude-code with a signal-gated state machine that waits on the existing `notification.idle_prompt` and `user-prompt-submit` hook callbacks before advancing each phase. Retries the bracketed paste up to 3 times when `idle_prompt` re-fires without a submit (the "Enter got eaten" case). Legacy timer schedule is preserved as the fallback when hook callbacks don't arrive, plus a kill switch via `OCTOGENT_HOOK_GATED_BOOTSTRAP=0`. Fixes the 5+ concurrent worker case where 2–3 workers and the coordinator would stage paste without submitting. Six new tests drive the state machine deterministically via the hook API. |
| `3509c80` | Runtime | `deleteTerminal` now passes `bestEffort: true` when removing free-standing (non-tentacle-scoped) worktrees. Previously a dirty worktree, stale git metadata, or already-merged branch could 409 the delete and leave an undeletable ghost node on the canvas. Tentacle-scoped worktrees keep their strict behavior (silent failure there could lose commits). `removeTentacleWorktree`'s bestEffort path also now continues to branch cleanup after a worktree-remove failure instead of short-circuiting, so the happy path is strictly more complete. |
| `77d53bb` | PTY | Follow-up to `19b9bd5`. Primary-source report: workers were receiving the prompt body *twice* because Claude Code fires `notification.idle_prompt` the moment the TUI renders `[Pasted text +N lines]` — BEFORE processing our Enter. The previous `submit vs idle` race consistently saw idle first, misread it as "paste eaten, retry", and re-pasted on the happy path. Fix: wait only for `user-prompt-submit` during the submit window; on timeout, retry with a bare `\r` — never re-paste. A bare `\r` either submits the staged paste (fixing the original Enter-eaten bug) or is a harmless empty submission. Cannot produce duplicate prompts under any condition. T4 rewritten as a regression guard. |
| `937c2ac` | Runtime | Hook URLs in existing `.claude/settings.json` files get baked in at `installHooksInDirectory` time. When the server restarts on a different port (auto-pick walks 8787..), every previously-spawned worker fires curl at the dead port and shows `PreToolUse:Bash hook error ECONNREFUSED` on each tool call. Fix: at terminal runtime init, iterate all claude-code worktree terminals and re-install hooks with the current URL. `mergeHookEntries` now strips existing octogent-owned entries (fingerprinted by `/api/hooks/` or `/api/code-intel/events` substrings) before appending the fresh ones — otherwise re-install would double the hook entries and every hook would fire twice. User-authored hooks are preserved verbatim. |
| `132c1b8` | State | Panel state badge was sticking at `IDLE` while the agent was visibly processing ("Whisking…", "Creating…"). Root cause: `notification.idle_prompt` was wired to force `agentState = "idle"`, but Claude Code fires that hook more generously than "user has been idle" — it also fires between tool calls and after paste rendering. One stray idle_prompt mid-processing flipped the badge to IDLE and nothing transitioned it back. Fix: stop using `idle_prompt` as a state-force signal (it keeps its two other jobs — incrementing the bootstrap counter and flushing queued channel messages). Use the `Stop` hook as the authoritative "turn finished, back to idle" signal instead — `Stop` fires exactly once per agent turn. State cycle is now the clean one: idle → processing (on `user-prompt-submit`) → idle (on `Stop`). |

### Swarm contract rewrite

| Commit | Area | Summary |
|---|---|---|
| `d7df799` | Coordinator prompt | New "commits are the signal" contract. Coordinator no longer waits for `DONE` channel messages; it gates merge decisions on the branch state and the final commit body. Channels become advisory. |
| `fbe3076` | Coordinator prompt | Dynamic poll cap. Coordinator picks **2 / 5 / 10 minutes** before the first poll based on estimated task size (with rules for re-picking between cycles). Supersedes the earlier hardcoded 5-min cap (`aea0339`). |
| `61655ef` | Worker & coordinator prompts | Two tightenings: (a) `ahead=0` is explicitly called out as "not yet started / in progress" so the coordinator never misreads a fresh worker branch as already-merged; (b) worker's FINAL commit body MUST carry a structured `DONE:` or `BLOCKED:` marker in a fixed shape (summary / verification / files / caveats, or tried / failed / needs). |
| `977e786` | Swarm-worker prompt | `prompts/swarm-worker.md` (the template used by multi-worker swarms, distinct from `tentacle-worker.md`) also mandates the `DONE:` / `BLOCKED:` marker. Previously only the solo-worker template carried it. |

### Identity & portability

| Commit | Area | Summary |
|---|---|---|
| `a8cc2cd` | Runtime | Every spawned PTY now inherits identity env vars: `OCTOGENT_TERMINAL_ID`, `OCTOGENT_TENTACLE_ID`, `OCTOGENT_PARENT_TERMINAL_ID`, `OCTOGENT_ROLE`, `OCTOGENT_API_BASE`. Prompts and user commands never hardcode IDs. |
| `ee3de78` | CLI | `resolveRuntimeApiBase` walks **up** from `cwd` looking for the owning project's config. Fixes `octogent` commands (including `channel send`) from inside a git worktree — previously fell back to the default port and hit either nothing or a stale server. |
| `82d92be` | Channel delivery | Channel messages sent to claude-code terminals now use bracketed-paste + a deliberate `\r` 2 seconds later (same idiom as initial-prompt injection). Stops messages from staging unsubmitted in the input buffer. |

### Canvas task visibility

| Commit | Area | Summary |
|---|---|---|
| `c2aee3d` | Canvas | Green checkmark renders on tentacle nodes where `todoDone === todoTotal > 0`. Double-polyline (black outline + green fill) gives a floating effect visible against any background. |
| `822c70b`–`45e3044` | Canvas | Iterative positioning: checkmark settled at top-right of the octopus sprite body (`cx = glyphW/2 - glyphW*0.18`, `cy = glyphH*0.1`). |
| `1a9045a` | Canvas | Color-coded todo fraction appears on incomplete tentacles at the same position as the checkmark. Format: `done/total`. |
| `85a0d51` | Canvas | Fraction anchored inside sprite bounds (`textAnchor="middle"` at the same x as the checkmark). |
| `de0e274` | Canvas | Fraction color-coded by progress state: **white** = not started (0 done), **orange** = in progress (some done). Checkmark stays green for fully complete. |
| `7e38c75` | Deck | Deck view polls tentacle data every 10 s so todo counts stay fresh without a manual refresh. |

### Coordinator nudge & cleanup

| Commit | Area | Summary |
|---|---|---|
| Prompt edit | Coordinator prompt | Added **failure mode #6**: after merging a worker branch, coordinator must tick `- [ ] → - [x]` in `.octogent/tentacles/<id>/todo.md` on main and commit. The UI reads `todo.md` from main — workers cannot tick it from their worktrees without merge conflicts. |
| Prompt edit | Coordinator prompt | Added **nudge mechanism**: if a worker branch shows `ahead=0` AND `agentRuntimeState` is `idle` for more than one poll cycle, coordinator sends a channel message prompting the worker to resume. Uses `curl /api/terminals/<id>` to check runtime state and `octogent channel send` to nudge. |
| `59b0573` | Coordinator prompt | **Auto-cleanup**: after all worker branches are merged and verified, coordinator deletes each worker terminal (`DELETE /api/terminals/<workerTerminalId>`) then deletes itself (`DELETE /api/terminals/{{terminalId}}`). The canvas clears automatically — no manual cleanup step. |

### Tentacle planner improvements

| Commit | Area | Summary |
|---|---|---|
| Prompt edit | Planner prompt | Added **10-option startup menu**: Full run, Propose only, Fill gaps, Re-enrich, Add todos, Prune todos, Status report, Spawn all, Single tentacle, Remap. Operator picks on first message; planner skips phases not needed for the chosen mode. |
| Prompt edit | Planner prompt | Added **skills discovery step** in Phase 4: scans `.claude/skills/` and injects an `octogent:suggested-skills` block so workers get relevant skill context automatically. |

### State detection

| Commit | Area | Summary |
|---|---|---|
| Prompt edit | `agentStateDetection.ts` | Any non-empty output chunk from the PTY now transitions the agent to `processing`. Previously required a regex match against known processing patterns — silent tool calls and non-matching output left the badge stuck at `IDLE`. `PROCESSING_PATTERNS` retained as a secondary check for compatibility. |

### Security & robustness (code-review agent pass)

| Area | Fix |
|---|---|
| `requestHandler.ts` | Path traversal prevention: `path.normalize()` + strict prefix check before serving any file from the project directory. |
| `readDeckTentacles.ts` | `isSafeTentaclePath()` helper blocks `..`, `:`, backslashes, and validates resolved path containment before reading tentacle files. |
| `MarkdownContent.tsx` | XSS sanitizer hardened: event handler regex catches unquoted values (`onerror=alert(1)`); dangerous tags (`iframe`, `object`, `embed`, `form`, `input`, `textarea`, `button`, `select`) blocked; `data:text/html` URLs blocked. |
| `sessionRuntime.ts` | `.catch()` on fire-and-forget bootstrap; WebSocket error messages sanitized before forwarding to the client. |
| `server.ts` / `cli.ts` | `.catch()` on SIGINT/SIGTERM handlers so shutdown errors don't swallow the exit. |
| `miscRoutes.ts` | `.catch()` on background cache refresh. |
| `requestParsers.ts` | `JSON.parse` wrapped in try/catch; malformed body returns 400 instead of crashing. |
| `terminalRuntime.ts` | `drainPendingHookEventsRef` converted to mutable-ref object to satisfy `useConst` lint rule. |
| `typeCoercion.ts`, `buildTerminalList.ts`, `InMemoryTerminalSnapshotReader.ts` | Defensive improvements in core package. |

### Test coverage additions

| Area | Tests added |
|---|---|
| `agentStateDetection.test.ts` | State-machine edge cases including any-chunk-is-processing path |
| `gitParsers.test.ts` | 33 unit tests for all git parser functions (new file) |
| `createApiServer.test.ts` | Error path tests for `handleDeckTentacleSwarmRoute` (8 tests) |
| `monitorCore.test.ts` | Stale-cache boundary tests |
| `claudeUsage.test.ts` | Retry and grace-period tests for Claude usage polling |
| `promptResolver.test.ts` | Updated for current swarm-parent content and `claimedIndicesBeforeSpawn` field |

All 303 tests pass. Zero lint errors. Build clean.

### Fork meta

| Commit | Area | Summary |
|---|---|---|
| `0c12dec` | Fork | `package.json` renamed `octogent` → `octogent-evolved`, version bumped `0.1.0` → `0.2.0`, repository URL updated, `NOTICE.md` added, README attribution. Bin stays `octogent`. |

Full history: `git log main --first-parent`.

---

## Install (fork-specific)

This fork is **not published to npm**. Install from the repo directly.

### Option A — git clone + `npm link` (recommended for dev)

```bash
git clone https://github.com/special-place-administrator/Octogent-Evolved.git
cd Octogent-Evolved
pnpm install
pnpm build
npm link
```

After `npm link`, the global `octogent` command points at this checkout. Edit sources, re-run `pnpm build`, restart the server — changes are live. **Do not run `npm i -g octogent`** — that pulls the upstream registry version and silently overwrites the symlink.

### Option B — install from tarball (for a coworker / second machine)

On the machine that has the repo built:

```bash
cd Octogent-Evolved
npm pack
# produces octogent-evolved-0.2.0.tgz
```

On the target machine:

```bash
npm install -g ./octogent-evolved-0.2.0.tgz
```

### Option C — install directly from GitHub

```bash
npm install -g git+https://github.com/special-place-administrator/Octogent-Evolved.git
```

(This clones + installs the current `main` in one step. The target machine needs `git`, `pnpm`, and Node 22+.)

## Quick start

```bash
cd <your-project>
octogent
```

On first run, Octogent creates the local `.octogent/` scaffold, assigns a stable project ID, picks an available local API port starting at `8787`, and opens the UI unless `OCTOGENT_NO_OPEN=1` is set.

## Requirements

- Node.js `22+`
- `claude` installed (the Claude Code CLI — the supported agent)
- `git` for worktree terminals
- `gh` for GitHub pull-request features
- `curl` for the Claude hook callback flow
- `pnpm@11+` for dev builds

Startup fails if neither `claude` nor another supported provider binary is installed. The current docs only cover **Claude Code**.

## What persists

- `.octogent/` — project-local scaffold and worktrees
- `~/.octogent/projects/<project-id>/state/` — runtime state, transcripts, monitor cache, metadata
- `.octogent/tentacles/<tentacle-id>/` — context files and todos that agents read

PTY sessions survive browser reloads during the idle grace period. They do **not** survive an API restart. A restart deletes in-flight channel queues.

## How the swarm flow works now

1. **Planner** (`prompts/tentacle-planner.md`) offers a 10-option menu on startup. In full-run mode it proposes a tentacle layout, gets operator approval, writes `CONTEXT.md` + `todo.md` into the tentacle folder.
2. **Spawn Swarm** button — operator picks worker count (1–9). API allocates claim-indexed worker IDs, spawns worker terminals in their own worktrees with a 500 ms stagger. Last, it spawns the coordinator in shared-mode with the same tentacle scope.
3. **Workers** read `CONTEXT.md` / `todo.md`, pick an unclaimed `- [ ]` item, implement it, run verification, commit to `octogent/<worker-id>`, and end their **final commit body** with a `DONE:` or `BLOCKED:` marker in the mandated shape.
4. **Coordinator** runs a 2/5/10-minute tight poll loop (its own tier choice per task size). Each cycle: `git fetch`, check each worker branch for `ahead > 0` + clean worktree, read the last commit body for `DONE:` / `BLOCKED:`. On first delta, exits the poll and either merges or investigates. If a worker shows `ahead=0` and `agentRuntimeState=idle` for more than one cycle, coordinator sends a nudge via the channel API.
5. **Merges** happen into an integration branch first (`octogent_integration_<tentacle>`), then into `main` after post-merge verification passes. Coordinator ticks the corresponding `- [ ]` → `- [x]` in `todo.md` on `main` and commits.
6. **Cleanup** — after all merges land, coordinator deletes each worker terminal via `DELETE /api/terminals/<id>`, then deletes itself. The canvas clears automatically.
7. **Canvas** shows live progress: color-coded `done/total` fraction on incomplete tentacles (white = not started, orange = in progress) and a floating green checkmark when all tasks are done.
8. **Channel messages** (inter-agent IPC) are optional fire-and-forget status; if channel-send fails, the commit is still the real signal.

## Docs (upstream)

Mental model and conceptual docs are inherited from upstream and remain accurate. Swarm-specific docs will be refreshed here as part of future divergence:

- [Tentacles](docs/concepts/tentacles.md)
- [Working With Todos](docs/guides/working-with-todos.md)
- [Orchestrating Child Agents](docs/guides/orchestrating-child-agents.md)
- [Inter-Agent Messaging](docs/guides/inter-agent-messaging.md)
- [CLI Reference](docs/reference/cli.md)
- [Filesystem Layout](docs/reference/filesystem-layout.md)
- [API Reference](docs/reference/api.md)
- [Experimental Features](docs/reference/experimental-features.md)
- [Troubleshooting](docs/reference/troubleshooting.md)

## License

MIT, inherited from upstream. See [`LICENSE`](./LICENSE) and [`NOTICE.md`](./NOTICE.md).

## Credit

Original Octogent by [Hesam Sheikh](https://github.com/hesamsheikh). All the design work that makes this thing worth forking belongs to that project.
