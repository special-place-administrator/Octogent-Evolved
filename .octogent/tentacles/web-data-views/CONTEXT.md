# Web Data Views

CodeIntel treemap/arc visualizations, GitHub primary view, monitor feed view, usage heatmap, and their supporting hooks and aggregations.

## Scope
- `apps/web/src/components/CodeIntelPrimaryView.tsx` — CodeIntel tab: wraps treemap and arc diagram
- `apps/web/src/components/CodeIntelTreemap.tsx` — squarified treemap visualization
- `apps/web/src/components/CodeIntelArcDiagram.tsx` — file-coupling arc diagram; `CodeIntelArcDiagramProps`, `fileCouplingMap`
- `apps/web/src/components/GitHubPrimaryView.tsx` — GitHub overview tab: repo stats, star count, open PRs/issues
- `apps/web/src/components/MonitorPrimaryView.tsx` — **new**: monitor feed primary view
- `apps/web/src/components/UsageHeatmap.tsx` — **new**: Claude/Codex usage heatmap visualization
- `apps/web/src/app/codeIntelAggregation.ts` — `layoutTreemap`, `buildCodeIntelTreemapRoot`, treemap layout algorithm
- `apps/web/src/app/githubMetrics.ts` — GitHub metrics computation
- `apps/web/src/app/githubNormalizers.ts` — GitHub API response normalizers
- `apps/web/src/app/monitorNormalizers.ts` — monitor feed normalizers
- `apps/web/src/app/usageNormalizers.ts` — usage data normalizers
- `apps/web/src/app/hooks/useCodeIntelRuntime.ts` — CodeIntel SSE event hook
- `apps/web/src/app/hooks/useTentacleGitLifecycle.ts` — tentacle git/PR state hook, `parseTentaclePullRequest`
- `apps/web/src/app/hooks/useGitHubPrimaryViewModel.ts` — GitHub view model hook
- `apps/web/src/app/hooks/useGithubSummaryPolling.ts` — GitHub summary polling hook
- `apps/web/src/app/hooks/useMonitorRuntime.ts` — monitor runtime hook
- `apps/web/src/app/hooks/useClaudeUsagePolling.ts` — Claude usage polling hook
- `apps/web/src/app/hooks/useCodexUsagePolling.ts` — Codex usage polling hook
- `apps/web/src/app/hooks/useUsageHeatmapPolling.ts` — usage heatmap polling hook
- `apps/web/src/app/hooks/useAgentRuntimeStates.ts` — agent runtime states hook
- `apps/web/src/app/hooks/useCanvasGraphData.ts` — canvas graph data hook
- `apps/web/src/components/PromptsPrimaryView.tsx` — prompts library view
- `apps/web/src/app/hooks/usePollingData.ts` — generic polling data hook
- `apps/web/tests/githubMetrics.test.tsx`
- `apps/web/tests/useAgentRuntimeStates.test.tsx`
- `apps/web/tests/tentacle-pod.test.tsx`
- `apps/web/tests/app-github-runtime.test.tsx`
- `apps/web/tests/app-monitor-runtime.test.tsx`

## Out-of-scope
- `apps/web/src/components/CanvasPrimaryView.tsx`, `canvas/**` — canvas layout; owned by `web-shell`
- `apps/web/src/components/DeckPrimaryView.tsx`, `deck/**` — deck view; owned by `web-shell`
- `apps/web/src/App.tsx` — do NOT touch; owned by `web-shell`
- `apps/web/src/styles/**` — CSS modules; owned by `web-shell`
- `apps/api/**` — do NOT touch
- `packages/core/**` — do NOT touch; owned by `core-contracts`

## Project rules
- Keep backend orchestration out of the UI — consume API/runtime contracts, not recreate server logic. — source: `apps/web/AGENTS.md#Ownership`
- Keep large JSX blocks in focused components with typed props; pure aggregation logic in `src/app/*`. — source: `apps/web/AGENTS.md#Module Shape`
- Add targeted component or hook tests when changing view-model logic or state reconciliation. — source: `apps/web/AGENTS.md#Testing`
- Use the existing product vocabulary: agents, sessions, worktrees, tentacles. — source: `apps/web/AGENTS.md#UI Conventions`

## Inherited operator rules
- Use SymForge **read** tools freely. — source: `~/.claude/CLAUDE.md §1`
- **SymForge edit tools are DISABLED inside worktrees.** You are in `.octogent/worktrees/web-data-views/`. Use built-in `Edit`/`Write` with absolute paths inside your worktree. SymForge reads are fine. — source: `~/.claude/CLAUDE.md §1`; observed incident 2026-04-16
- Surgical changes only; do not improve adjacent code. — source: `~/.claude/CLAUDE.md §Surgical changes`
- Before any destructive action, write `.octogent/tentacles/web-data-views/proposed-destructive.md` and stop. — source: tentacle-planner §No-surprise rule

## Verification
- Typecheck: `pnpm --filter @octogent/web build`
- Test: `pnpm --filter @octogent/web test`
- Lint: `pnpm lint`

## Commit discipline
- Format: `type(scope): description` — e.g. `fix(codeintel)`, `feat(github-view)`, `fix(arc-diagram)`, `feat(monitor-view)`, `feat(usage-heatmap)`
- One commit per completed todo item. Commit inside your worktree. Do not push.

## No-surprise rule
Before any destructive action, write the proposed change to `.octogent/tentacles/web-data-views/proposed-destructive.md` and stop until the user acknowledges.

## How to trigger me

    octogent terminal create \
      --tentacle-id web-data-views \
      --workspace-mode worktree \
      --initial-prompt "Read your CONTEXT.md and todo.md in full. You are in a git worktree — do NOT use SymForge edit tools (edit_within_symbol / replace_symbol_body / batch_edit / insert_symbol / batch_insert / batch_rename / delete_symbol); they write to the indexed main repo, not your worktree. Use built-in Edit/Write. SymForge reads are fine. Pick the highest-priority incomplete todo item. Complete it end-to-end: implement, run verification, commit. Report DONE and exit."

## When to run
On-demand — when fixing CodeIntel visualizations, GitHub view data, monitor feed rendering, usage heatmap, or related hook logic.
