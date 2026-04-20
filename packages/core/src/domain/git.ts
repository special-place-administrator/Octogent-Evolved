import type { TentacleWorkspaceMode } from "./terminal";

export type TentaclePullRequestStatus = "none" | "open" | "merged" | "closed";

export type TentacleGitStatusSnapshot = {
  tentacleId: string;
  workspaceMode: TentacleWorkspaceMode;
  branchName: string;
  /** Tracking branch (e.g. `origin/main`), or null if none is configured. */
  upstreamBranchName: string | null;
  /** True when there are uncommitted changes (staged or unstaged) in the working tree. */
  isDirty: boolean;
  /** Commits on the local branch not yet pushed to the upstream. */
  aheadCount: number;
  /** Commits on the upstream not yet pulled into the local branch. */
  behindCount: number;
  insertedLineCount: number;
  deletedLineCount: number;
  hasConflicts: boolean;
  changedFiles: string[];
  /** The branch to diff/PR against (e.g. `main`), inferred from the repo default. */
  defaultBaseBranchName: string | null;
};

export type TentaclePullRequestSnapshot = {
  tentacleId: string;
  workspaceMode: TentacleWorkspaceMode;
  status: TentaclePullRequestStatus;
  number: number | null;
  url: string | null;
  title: string | null;
  /** Target branch the PR merges into (e.g. `main`). */
  baseRef: string | null;
  /** Source branch the PR is opened from. */
  headRef: string | null;
  isDraft: boolean | null;
  /** GitHub's mergeability assessment. `UNKNOWN` means GitHub hasn't computed it yet. */
  mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN" | null;
  /** Raw GitHub `mergeStateStatus` string (e.g. `CLEAN`, `BLOCKED`, `BEHIND`). Untyped because GitHub may add values. */
  mergeStateStatus: string | null;
};
