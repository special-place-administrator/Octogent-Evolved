# Todo

## 1. Add tests for treemap layout edge cases

- [ ] Add vitest tests for `layoutTreemap` in `codeIntelAggregation.ts` covering empty input, single-file input, and very large file counts.

**Why**: `layoutTreemap` is a pure function with no observed test coverage in the web test suite. It is the core layout algorithm for the CodeIntel treemap view. Edge cases (zero files, one file, files with equal edit counts) are easy to test and guard against visual regressions when the algorithm is touched.

**What**:
- Read `apps/web/src/app/codeIntelAggregation.ts` `layoutTreemap`, `squarify`, `buildCodeIntelTreemapRoot`
- Add tests in a new file `apps/web/tests/codeIntelAggregation.test.ts` (or add to an existing web test if one fits): empty root → empty rects, single node → fills full rect, two equal nodes → each gets roughly half
- Run verification

**Verify**:
- `pnpm --filter @octogent/web build`
- `pnpm --filter @octogent/web test`
- `pnpm lint`

---

## 2. Add test for PR lifecycle state transitions in `useTentacleGitLifecycle`

- [ ] Add tests in `app-github-runtime.test.tsx` (or a new file) for the PR state machine in `useTentacleGitLifecycle`: no PR → PR open → PR merged flow.

**Why**: `useTentacleGitLifecycle.ts` parses PR snapshots (`parseTentaclePullRequest`) and drives the GitHub view state. The test file `app-github-runtime.test.tsx` exists but the PR lifecycle state transitions (none → open → merged, error state) are a common source of UI inconsistency when the API response shape changes.

**What**:
- Read `apps/web/src/app/hooks/useTentacleGitLifecycle.ts`
- Read `apps/web/tests/app-github-runtime.test.tsx` for existing patterns
- Add tests: mock API returning null PR → open PR → merged PR; assert hook state at each step
- Run verification

**Verify**:
- `pnpm --filter @octogent/web build`
- `pnpm --filter @octogent/web test`
- `pnpm lint`

---

## 3. Add tests for MonitorPrimaryView and app-monitor-runtime

- [ ] Add or extend tests in `app-monitor-runtime.test.tsx` for `MonitorPrimaryView.tsx` and the `useMonitorRuntime` hook.

**Why**: `MonitorPrimaryView.tsx` is a new component. `app-monitor-runtime.test.tsx` exists but may only cover the hook (not the component). The monitor feed is the primary agent activity surface — rendering regressions here mean operators lose visibility into running agents.

**What**:
- Read `apps/web/src/components/MonitorPrimaryView.tsx` to understand props and rendering
- Read `apps/web/tests/app-monitor-runtime.test.tsx` for existing coverage
- Add tests: empty feed → empty state shown, events present → feed items rendered, stale feed → stale indicator shown
- Run verification

**Verify**:
- `pnpm --filter @octogent/web build`
- `pnpm --filter @octogent/web test`
- `pnpm lint`

---

## 4. Add tests for UsageHeatmap rendering

- [ ] Add vitest tests for `UsageHeatmap.tsx` and `useUsageHeatmapPolling.ts`.

**Why**: `UsageHeatmap.tsx` is a new visualization component with no observed test coverage. Usage heatmap data drives operator decisions about token budget. Regressions in normalization (`usageNormalizers.ts`) or rendering go undetected without a test.

**What**:
- Read `apps/web/src/components/UsageHeatmap.tsx` to understand the data shape and rendering
- Read `apps/web/src/app/hooks/useUsageHeatmapPolling.ts` and `apps/web/src/app/usageNormalizers.ts`
- Add tests: no usage data → empty/zero state rendered, populated data → heatmap cells rendered with correct values
- Run verification

**Verify**:
- `pnpm --filter @octogent/web build`
- `pnpm --filter @octogent/web test`
- `pnpm lint`
