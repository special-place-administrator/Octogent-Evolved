/** API rate-limit / quota usage reported by the monitor provider. */
export type MonitorUsageSnapshot = {
  status: "ok" | "unavailable" | "error";
  /** Where the usage data was read from. `"none"` means no credentials are configured. */
  source: "x-api" | "none";
  fetchedAt: string;
  message?: string | null;
  /** Total request cap for the current window (provider-defined). */
  cap?: number | null;
  /** Requests consumed so far in the current window. */
  used?: number | null;
  /** Requests remaining before the cap is reached. */
  remaining?: number | null;
  /** ISO timestamp when the rate-limit window resets. */
  resetAt?: string | null;
};

export type MonitorPost = {
  source: "x";
  id: string;
  text: string;
  author: string;
  createdAt: string;
  likeCount: number;
  permalink: string;
  /** The query term from the monitor config that caused this post to be included, or null if not tracked. */
  matchedQueryTerm: string | null;
};

/** Masked credential status for a monitor provider — safe to send to the client. */
export type MonitorCredentialSummary = {
  /** True when enough credentials are present for the provider to make API calls. */
  isConfigured: boolean;
  /** Partially redacted bearer token (e.g. `eyJ...abc`), for display only. */
  bearerTokenHint: string | null;
  /** Partially redacted API key, for display only. */
  apiKeyHint: string | null;
  hasApiSecret: boolean;
  hasAccessToken: boolean;
  hasAccessTokenSecret: boolean;
  updatedAt: string | null;
};

export type MonitorConfigSnapshot = {
  providerId: "x";
  queryTerms: string[];
  refreshPolicy: {
    maxCacheAgeMs: number;
    maxPosts: number;
    searchWindowDays: 1 | 3 | 7;
  };
  providers: {
    x: {
      credentials: MonitorCredentialSummary;
    };
  };
};

export type MonitorFeedSnapshot = {
  providerId: "x";
  queryTerms: string[];
  refreshPolicy: {
    maxCacheAgeMs: number;
    maxPosts: number;
    searchWindowDays: 1 | 3 | 7;
  };
  lastFetchedAt: string | null;
  staleAfter: string | null;
  isStale: boolean;
  lastError: string | null;
  posts: MonitorPost[];
  usage: MonitorUsageSnapshot | null;
};
