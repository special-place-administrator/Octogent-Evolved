# Todo

## 1. Add tests for swarm-refresh state reconciliation

- [ ] Extend or add vitest tests in `app-swarm-refresh.test.tsx` covering the canvas refresh cycle when a swarm spawn completes and new terminals appear.

**Why**: `app-swarm-refresh.test.tsx` exists but the canvas swarm-refresh path involves `CanvasPrimaryView` state reconciliation with newly created terminals, `lastHandledCreatedTerminalIdRef`, and the `refreshColumns` function in `App.tsx`. The recent swarm orchestration work touched these paths heavily. Gaps here mean regressions in the most complex multi-agent flow go undetected.

**What**:
- Read `apps/web/tests/app-swarm-refresh.test.tsx` to understand existing coverage
- Read `apps/web/src/App.tsx` `refreshColumns` and `sortTerminalSnapshots` to understand the refresh logic
- Add tests: new terminal appears after swarm spawn → column list updates; duplicate terminal id → not double-added
- Use existing `appTestHarness` patterns
- Run verification

**Verify**:
- `pnpm --filter @octogent/web build`
- `pnpm --filter @octogent/web test`
- `pnpm lint`

---

## 2. Add test for workspace-setup card display logic

- [ ] Add a test in `app-workspace-setup.test.tsx` covering the `shouldShowWorkspaceSetupCard` condition in `CanvasPrimaryView`.

**Why**: `shouldShowWorkspaceSetupCard` controls whether the workspace setup onboarding card is shown. `app-workspace-setup.test.tsx` exists but it is unclear whether it covers the `CanvasPrimaryView`-level display condition (vs. just the setup-step API calls). Missing coverage here means the onboarding card could silently appear/disappear after refactors.

**What**:
- Read `apps/web/tests/app-workspace-setup.test.tsx` to see existing coverage
- Read `apps/web/src/components/CanvasPrimaryView.tsx` around the `shouldShowWorkspaceSetupCard` condition to understand it
- Add a test: no terminals + setup not complete → card shown; terminals present → card hidden
- Run verification

**Verify**:
- `pnpm --filter @octogent/web build`
- `pnpm --filter @octogent/web test`
- `pnpm lint`

---

## 3. Add test for UI state persistence round-trip

- [ ] Extend `app-ui-state-persistence.test.tsx` to verify that canvas panel positions survive a simulated page reload (state write → state read → same positions).

**Why**: `app-ui-state-persistence.test.tsx` exists but the `.octogent`-backed state model is the canonical persistence layer. A round-trip test (persist → reload → restore) would catch any serialization drift. Especially relevant after the swarm orchestration merge which touched column layout state.

**What**:
- Read `apps/web/tests/app-ui-state-persistence.test.tsx` for existing patterns
- Read `apps/web/src/app/terminalRuntimeStateStore.ts` to understand the state shape
- Add a round-trip test: set column positions → simulate reload → assert positions restored
- Run verification

**Verify**:
- `pnpm --filter @octogent/web build`
- `pnpm --filter @octogent/web test`
- `pnpm lint`

---

## 4. Add tests for DeckPrimaryView and TentaclePod

- [ ] Add vitest tests for the `DeckPrimaryView.tsx` and `TentaclePod.tsx` components in the new `apps/web/src/components/deck/` directory.

**Why**: `DeckPrimaryView.tsx` and `TentaclePod.tsx` are significant new components (`b5e5664`, `fa48ca1`) with no observed test coverage. The deck view is the primary tentacle management surface — regressions here directly affect the operator's ability to manage agents. `tentacle-pod.test.tsx` exists but should be checked for coverage gaps.

**What**:
- Read `apps/web/src/components/DeckPrimaryView.tsx` and `apps/web/src/components/deck/TentaclePod.tsx`
- Read `apps/web/tests/tentacle-pod.test.tsx` to see existing coverage
- Add tests: tentacle pod renders with correct name/status, todo progress fraction shown correctly, action buttons trigger correct callbacks
- Run verification

**Verify**:
- `pnpm --filter @octogent/web build`
- `pnpm --filter @octogent/web test`
- `pnpm lint`

---

## 5. Add tests for OctopusNode canvas rendering

- [ ] Add vitest tests for `OctopusNode.tsx` and `CanvasTentaclePanel.tsx` — the new canvas node components.

**Why**: `OctopusNode.tsx`, `CanvasTentaclePanel.tsx`, and `SessionNode.tsx` are new canvas node components added during the canvas octoboss/tentacle visualization work. `canvas-tentacle-panel.test.tsx` exists — confirm it covers `CanvasTentaclePanel` props and state. `OctopusNode` (the sprite-based rendering with checkmark and todo progress) has no observed test.

**What**:
- Read `apps/web/src/components/canvas/OctopusNode.tsx` to understand props and rendering
- Read `apps/web/tests/canvas-tentacle-panel.test.tsx` to see what's covered
- Add tests for `OctopusNode`: all-done → checkmark rendered, in-progress → fraction shown, no todos → neither shown
- Run verification

**Verify**:
- `pnpm --filter @octogent/web build`
- `pnpm --filter @octogent/web test`
- `pnpm lint`
