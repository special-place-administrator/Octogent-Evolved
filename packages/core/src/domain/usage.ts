export type ClaudeUsageSnapshot = {
  status: "ok" | "unavailable" | "error";
  fetchedAt: string;
  /**
   * How the usage data was obtained.
   * - `cli-pty` — scraped from the Claude CLI PTY output
   * - `oauth-api` — fetched via the Claude OAuth API
   * - `none` — no credentials or source available
   */
  source: "cli-pty" | "oauth-api" | "none";
  message?: string | null;
  planType?: string | null;
  /** Percentage of the primary (e.g. Opus/max) usage quota consumed this period. */
  primaryUsedPercent?: number | null;
  primaryResetAt?: string | null;
  /** Percentage of the secondary (e.g. Sonnet/standard) usage quota consumed this period. */
  secondaryUsedPercent?: number | null;
  secondaryResetAt?: string | null;
  /** Percentage of the Sonnet-specific sub-quota consumed, if tracked separately. */
  sonnetUsedPercent?: number | null;
  sonnetResetAt?: string | null;
  /** Extra usage cost accrued above the plan limit (in USD). */
  extraUsageCostUsed?: number | null;
  /** Maximum extra usage cost allowed before the account is rate-limited (in USD). */
  extraUsageCostLimit?: number | null;
};

export type CodexUsageSnapshot = {
  status: "ok" | "unavailable" | "error";
  fetchedAt: string;
  /** How the usage data was obtained. `"none"` means no credentials are configured. */
  source: "oauth-api" | "none";
  message?: string | null;
  planType?: string | null;
  primaryUsedPercent?: number | null;
  primaryResetAt?: string | null;
  secondaryUsedPercent?: number | null;
  secondaryResetAt?: string | null;
  /** Remaining Codex credit balance in USD, or null if on a subscription without per-credit billing. */
  creditsBalance?: number | null;
  /** True when the plan has unlimited Codex credits (balance field is irrelevant). */
  creditsUnlimited?: boolean | null;
};

/** A single data point in the commit-frequency sparkline (one entry per day). */
export type GitHubCommitPoint = {
  date: string;
  count: number;
};

export type GitHubRecentCommit = {
  hash: string;
  shortHash: string;
  subject: string;
  authorName: string;
  authorEmail: string;
  authoredAt: string;
  body: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
};

export type GitHubRepoSummarySnapshot = {
  status: "ok" | "unavailable" | "error";
  fetchedAt: string;
  source: "gh-cli" | "none";
  message?: string | null;
  repo?: string | null;
  stargazerCount?: number | null;
  openIssueCount?: number | null;
  openPullRequestCount?: number | null;
  commitsPerDay?: GitHubCommitPoint[];
  recentCommits?: GitHubRecentCommit[];
};
