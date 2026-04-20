# Todo

## 1. Audit domain types for undocumented fields and add inline TSDoc

- [x] Read all files under `packages/core/src/domain/` and add minimal TSDoc comments to any exported type or field whose purpose is non-obvious.

**Why**: `packages/core` is the shared contract between both apps. Exported types like `TerminalSnapshot`, `AgentState`, `TentacleWorkspaceMode`, and types in `deck.ts`, `monitor.ts`, `uiState.ts` are consumed by both `apps/api` and `apps/web`. Undocumented fields make cross-app contract changes risky. Completed in `e614660 docs(domain): add TSDoc comments to non-obvious exported types and fields`.

**Verify**:
- `pnpm --filter @octogent/api build`
- `pnpm --filter @octogent/web build`
- `pnpm lint`

---

## 2. Verify `packages/core` has correct build/typecheck script

- [x] Confirm `packages/core/package.json` has a working typecheck command and that it is exercised by the root `pnpm -r test` or `pnpm build` flow.

**Why**: Confirmed working in `1dd04e8 chore(core-contracts): confirm core typecheck command and build flow coverage`. `pnpm --filter @octogent/core build` runs `tsc -p tsconfig.json --noEmit` cleanly.

**Verify**:
- `pnpm --filter @octogent/core build`
- `pnpm -r test`
- `pnpm lint`

---

## 3. Add unit tests for `buildTerminalList` application logic

- [ ] Add vitest tests for `packages/core/src/application/buildTerminalList.ts` covering the sorting and filtering logic.

**Why**: `buildTerminalList.ts` is the only application-layer logic in `packages/core` and has no visible test coverage in the core package (core has no dedicated test directory observed). This function shapes how terminals are ordered in the UI — regressions in sorting/filtering silently affect canvas layout.

**What**:
- Read `packages/core/src/application/buildTerminalList.ts` to understand input/output
- Check if a `packages/core/tests/` directory exists; if not, create it with a vitest config following the pattern in `apps/api/` or check `packages/core/package.json` for test setup
- Add tests: empty input → empty list, multiple terminals → correct sort order, active vs inactive filtering
- Run verification

**Verify**:
- `pnpm --filter @octogent/core build`
- `pnpm -r test`
- `pnpm lint`
