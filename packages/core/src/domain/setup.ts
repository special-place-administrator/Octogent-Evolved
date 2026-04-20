export type WorkspaceSetupStepId =
  | "initialize-workspace"
  | "ensure-gitignore"
  | "check-claude"
  | "check-git"
  | "check-curl"
  | "create-tentacles";

export type WorkspaceSetupStep = {
  id: WorkspaceSetupStepId;
  title: string;
  description: string;
  complete: boolean;
  required: boolean;
  /** Label for the primary CTA button shown in the setup UI, or null if no action is available. */
  actionLabel: string | null;
  statusText: string;
  /** Human-readable instructions shown when the step is incomplete. */
  guidance: string | null;
  /** Shell command the user should run to complete this step, or null if it's handled automatically. */
  command: string | null;
};

export type WorkspaceSetupSnapshot = {
  /** True when no workspace has ever been initialized in this directory. */
  isFirstRun: boolean;
  /** True when the setup card should be rendered (e.g. first run or required steps incomplete). */
  shouldShowSetupCard: boolean;
  hasAnyTentacles: boolean;
  tentacleCount: number;
  steps: WorkspaceSetupStep[];
};
