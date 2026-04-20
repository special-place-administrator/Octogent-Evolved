# Web Shell

App entry point, primary navigation, canvas/conversation layout, terminal columns, and all CSS modules.

## Scope
- `apps/web/src/App.tsx` — **hot-spot owner**: top-level orchestrator, WebSocket connection, terminal/tentacle state hydration
- `apps/web/src/main.tsx` — React entry point
- `apps/web/src/components/ConsolePrimaryNav.tsx` — primary navigation bar
- `apps/web/src/components/PrimaryViewRouter.tsx` — routes between canvas / activity / github / codeintel / settings / prompts / monitor views
- `apps/web/src/components/CanvasPrimaryView.tsx` — canvas graph layout, terminal column panels, edge rendering, drag/resize, swarm spawn
- `apps/web/src/components/canvas/` — canvas sub-components: `CanvasTerminalColumn.tsx`, `CanvasTentaclePanel.tsx`, `OctopusNode.tsx`, `SessionNode.tsx`, `DeleteAllTerminalsDialog.tsx`
- `apps/web/src/components/DeckPrimaryView.tsx` — **new**: deck tab view orchestrator
- `apps/web/src/components/deck/` — **new**: deck sub-components: `AddTentacleForm.tsx`, `ActionCards.tsx`, `DeckBottomActions.tsx`, `TentaclePod.tsx`, `WorkspaceSetupCard.tsx`, `octopusVisuals.ts`
- `apps/web/src/components/ActivityPrimaryView.tsx` — activity/conversation view
- `apps/web/src/components/ConversationsPrimaryView.tsx` — conversations tab view
- `apps/web/src/components/ActiveAgentsSidebar.tsx` — sidebar showing active agents
- `apps/web/src/components/AgentStateBadge.tsx` — agent state badge component
- `apps/web/src/components/ClearAllConversationsDialog.tsx` — destructive action dialog
- `apps/web/src/components/DeleteTentacleDialog.tsx` — delete tentacle confirmation dialog
- `apps/web/src/components/TentacleGitActionsDialog.tsx` — tentacle git action dialog
- `apps/web/src/components/SidebarActionPanel.tsx` — sidebar action panel
- `apps/web/src/components/SidebarPromptsList.tsx` — sidebar prompts list
- `apps/web/src/components/SidebarConversationsList.tsx` — sidebar conversations list
- `apps/web/src/components/RuntimeStatusStrip.tsx` — runtime status strip
- `apps/web/src/components/TelemetryTape.tsx` — telemetry tape component
- `apps/web/src/components/EmptyOctopus.tsx` — empty state illustration
- `apps/web/src/components/SettingsPrimaryView.tsx` — settings view
- `apps/web/src/components/TerminalPromptPicker.tsx` — terminal prompt picker
- `apps/web/src/components/Terminal.tsx` — terminal renderer
- `apps/web/src/components/terminalReplay.ts` — terminal replay logic
- `apps/web/src/components/terminalWheel.ts` — terminal scroll wheel
- `apps/web/src/components/ui/` — reusable primitives: `ActionButton.tsx`, `ConfirmationDialog.tsx`, `SettingsToggle.tsx`, `StatusBadge.tsx`, `MarkdownContent.tsx`
- `apps/web/src/app/terminalRuntimeStateStore.ts` — `createTerminalRuntimeStateStore`, runtime state store
- `apps/web/src/app/canvas/` — canvas-specific app logic and types
- `apps/web/src/app/constants.ts` — app-wide constants
- `apps/web/src/app/formatTimestamp.ts` — timestamp formatting
- `apps/web/src/app/types.ts` — app-level types
- `apps/web/src/app/hotkeys.ts` — hotkey definitions
- `apps/web/src/app/notificationSounds.ts` — notification sound logic
- `apps/web/src/app/terminalState.ts` — terminal state normalizer
- `apps/web/src/app/conversationNormalizers.ts` — conversation data normalizers
- `apps/web/src/app/uiStateNormalizers.ts` — UI state normalizers
- `apps/web/src/app/hooks/useConsoleKeyboardShortcuts.ts` — keyboard shortcut hook
- `apps/web/src/app/hooks/useCanvasTransform.ts` — canvas transform hook
- `apps/web/src/app/hooks/useForceSimulation.ts` — force simulation for canvas layout
- `apps/web/src/app/hooks/useInitialColumnsHydration.ts` — initial column hydration hook
- `apps/web/src/app/hooks/useTerminalStateReconciliation.ts` — terminal state reconciliation hook
- `apps/web/src/app/hooks/useTerminalMutations.ts` — terminal mutation actions hook
- `apps/web/src/app/hooks/useTerminalCompletionNotification.ts` — completion sound/notification hook
- `apps/web/src/app/hooks/usePersistedUiState.ts` — persisted UI state hook
- `apps/web/src/app/hooks/useWorkspaceSetup.ts` — workspace setup hook
- `apps/web/src/app/hooks/useClickOutside.ts` — click-outside detection hook
- `apps/web/src/app/hooks/useBackendLivenessPolling.ts` — backend liveness polling hook
- `apps/web/src/app/hooks/useConversationsRuntime.ts` — conversations runtime hook
- `apps/web/src/app/hooks/usePromptLibrary.ts` — prompt library hook
- `apps/web/src/runtime/` — HTTP transport: `HttpTerminalSnapshotReader.ts`, `runtimeEndpoints.ts`
- `apps/web/src/styles/` — **hot-spot owner**: all CSS modules
- `apps/web/tests/CanvasPrimaryView.test.tsx`
- `apps/web/tests/Terminal.test.tsx`
- `apps/web/tests/app-shell-navigation.test.tsx`
- `apps/web/tests/app-swarm-refresh.test.tsx`
- `apps/web/tests/app-ui-state-persistence.test.tsx`
- `apps/web/tests/app-workspace-setup.test.tsx`
- `apps/web/tests/canvas-tentacle-panel.test.tsx`
- `apps/web/tests/delete-all-terminals-dialog.test.tsx`
- `apps/web/tests/hotkeys.test.tsx`
- `apps/web/tests/terminalReplay.test.ts`
- `apps/web/tests/terminalState.test.tsx`
- `apps/web/tests/terminalWheel.test.tsx`
- `apps/web/tests/uiPrimitives.test.tsx`
- `apps/web/tests/runtimeEndpoints.test.tsx`
- `apps/web/tests/HttpTerminalSnapshotReader.test.tsx`
- `apps/web/tests/RuntimeStatusStrip.test.tsx`
- `apps/web/tests/add-tentacle-form.test.tsx`

## Out-of-scope
- `apps/web/src/components/CodeIntelPrimaryView.tsx`, `CodeIntelTreemap.tsx`, `CodeIntelArcDiagram.tsx` — owned by `web-data-views`
- `apps/web/src/components/GitHubPrimaryView.tsx` — owned by `web-data-views`
- `apps/web/src/components/MonitorPrimaryView.tsx` — owned by `web-data-views`
- `apps/web/src/components/UsageHeatmap.tsx` — owned by `web-data-views`
- `apps/web/src/app/codeIntelAggregation.ts`, `app/hooks/useCodeIntelRuntime.ts`, `app/hooks/useTentacleGitLifecycle.ts` — owned by `web-data-views`
- `apps/web/src/app/hooks/useGitHubPrimaryViewModel.ts`, `useGithubSummaryPolling.ts` — owned by `web-data-views`
- `apps/web/src/app/hooks/useMonitorRuntime.ts`, `useClaudeUsagePolling.ts`, `useCodexUsagePolling.ts`, `useUsageHeatmapPolling.ts` — owned by `web-data-views`
- `apps/web/src/app/githubMetrics.ts`, `githubNormalizers.ts`, `monitorNormalizers.ts`, `usageNormalizers.ts` — owned by `web-data-views`
- `packages/core/**` — do NOT touch; owned by `core-contracts`
- `apps/api/**` — do NOT touch

## Project rules
- Keep backend orchestration out of the UI — consume API/runtime contracts, do not recreate server logic in React components. — source: `apps/web/AGENTS.md#Ownership`
- Top-level containers should orchestrate; move pure constants, parsers, normalizers, and hooks into `src/app/*`. — source: `apps/web/AGENTS.md#Module Shape`
- Keep large JSX blocks in focused components under `src/components/*` with typed props; reusable primitives in `src/components/ui/*`. — source: `apps/web/AGENTS.md#Module Shape`
- Runtime transport code belongs in `src/runtime/*`. — source: `apps/web/AGENTS.md#Module Shape`
- Add or update focused CSS modules under `src/styles/*` instead of growing one large stylesheet; preserve the token-driven modular CSS structure. — source: `apps/web/AGENTS.md#Styling`
- Use the existing product vocabulary: agents, sessions, worktrees, logs, pipelines, tentacles, terminal columns. — source: `apps/web/AGENTS.md#UI Conventions`
- Prefer in-app confirmation and action-panel flows over browser-native dialogs for destructive actions. — source: `apps/web/AGENTS.md#UI Conventions`
- Persist layout and UI preferences through the runtime-backed `.octogent` state model, not browser-only storage. — source: `apps/web/AGENTS.md#State`
- Add targeted component or runtime tests when changing view-model logic, state reconciliation, or destructive UI flows. — source: `apps/web/AGENTS.md#Testing`

## Inherited operator rules
- Use SymForge **read** tools freely. — source: `~/.claude/CLAUDE.md §1`
- **SymForge edit tools are DISABLED inside worktrees.** You are in `.octogent/worktrees/web-shell/`. Use built-in `Edit`/`Write` with absolute paths inside your worktree. SymForge reads are fine. — source: `~/.claude/CLAUDE.md §1`; observed incident 2026-04-16
- Surgical changes only; do not improve adjacent code. — source: `~/.claude/CLAUDE.md §Surgical changes`
- Before any destructive action, write `.octogent/tentacles/web-shell/proposed-destructive.md` and stop. — source: tentacle-planner §No-surprise rule

## Verification
- Typecheck: `pnpm --filter @octogent/web build` (runs `tsc --noEmit && vite build`)
- Test: `pnpm --filter @octogent/web test`
- Lint: `pnpm lint`

## Commit discipline
- Format: `type(scope): description` — e.g. `fix(canvas)`, `feat(shell)`, `fix(ui)`, `test(web)`, `feat(deck)`
- One commit per completed todo item. Commit inside your worktree. Do not push.

## No-surprise rule
Before any destructive action (remove CSS tokens used across components, change App.tsx state shape, break column layout), write the proposed change to `.octogent/tentacles/web-shell/proposed-destructive.md` and stop until the user acknowledges.

## How to trigger me

    octogent terminal create \
      --tentacle-id web-shell \
      --workspace-mode worktree \
      --initial-prompt "Read your CONTEXT.md and todo.md in full. You are in a git worktree — do NOT use SymForge edit tools (edit_within_symbol / replace_symbol_body / batch_edit / insert_symbol / batch_insert / batch_rename / delete_symbol); they write to the indexed main repo, not your worktree. Use built-in Edit/Write. SymForge reads are fine. Pick the highest-priority incomplete todo item. Complete it end-to-end: implement, run verification, commit. Report DONE and exit."

## When to run
On-demand — when fixing canvas layout, navigation behavior, CSS regressions, deck view, terminal column interactions, or workspace setup flow.
