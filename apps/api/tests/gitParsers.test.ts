import { describe, expect, it } from "vitest";

import {
  parseTentacleCommitMessage,
  parseTentaclePullRequestCreateInput,
  parseTentacleSyncBaseRef,
} from "../src/createApiServer/gitParsers";

describe("parseTentacleCommitMessage", () => {
  it("returns message when given a valid string", () => {
    const result = parseTentacleCommitMessage({ message: "feat: add thing" });
    expect(result).toEqual({ message: "feat: add thing", error: null });
  });

  it("trims whitespace from message", () => {
    const result = parseTentacleCommitMessage({ message: "  trimmed  " });
    expect(result).toEqual({ message: "trimmed", error: null });
  });

  it("errors when payload is null", () => {
    const result = parseTentacleCommitMessage(null);
    expect(result.error).toBe("Expected a JSON object body.");
    expect(result.message).toBeNull();
  });

  it("errors when payload is not an object", () => {
    const result = parseTentacleCommitMessage("string payload");
    expect(result.error).toBe("Expected a JSON object body.");
  });

  it("errors when message field is missing", () => {
    const result = parseTentacleCommitMessage({});
    expect(result.error).toBe("Commit message must be a string.");
  });

  it("errors when message is not a string", () => {
    const result = parseTentacleCommitMessage({ message: 42 });
    expect(result.error).toBe("Commit message must be a string.");
  });

  it("errors when message is empty after trimming", () => {
    const result = parseTentacleCommitMessage({ message: "   " });
    expect(result.error).toBe("Commit message cannot be empty.");
    expect(result.message).toBeNull();
  });
});

describe("parseTentacleSyncBaseRef", () => {
  it("returns null baseRef when payload is null", () => {
    const result = parseTentacleSyncBaseRef(null);
    expect(result).toEqual({ baseRef: null, error: null });
  });

  it("returns null baseRef when payload is undefined", () => {
    const result = parseTentacleSyncBaseRef(undefined);
    expect(result).toEqual({ baseRef: null, error: null });
  });

  it("returns null baseRef when baseRef field is absent", () => {
    const result = parseTentacleSyncBaseRef({});
    expect(result).toEqual({ baseRef: null, error: null });
  });

  it("returns trimmed baseRef when given a valid string", () => {
    const result = parseTentacleSyncBaseRef({ baseRef: " main " });
    expect(result).toEqual({ baseRef: "main", error: null });
  });

  it("errors when payload is not an object", () => {
    const result = parseTentacleSyncBaseRef(123);
    expect(result.error).toBe("Expected a JSON object body.");
    expect(result.baseRef).toBeNull();
  });

  it("errors when baseRef is not a string", () => {
    const result = parseTentacleSyncBaseRef({ baseRef: true });
    expect(result.error).toBe("baseRef must be a string.");
  });

  it("errors when baseRef is empty after trimming", () => {
    const result = parseTentacleSyncBaseRef({ baseRef: "   " });
    expect(result.error).toBe("baseRef cannot be empty.");
  });
});

describe("parseTentaclePullRequestCreateInput", () => {
  it("returns parsed fields for a minimal valid payload", () => {
    const result = parseTentaclePullRequestCreateInput({ title: "My PR" });
    expect(result).toEqual({ title: "My PR", body: "", baseRef: null, error: null });
  });

  it("returns body and baseRef when provided", () => {
    const result = parseTentaclePullRequestCreateInput({
      title: "My PR",
      body: "Description here",
      baseRef: "main",
    });
    expect(result).toEqual({
      title: "My PR",
      body: "Description here",
      baseRef: "main",
      error: null,
    });
  });

  it("trims title", () => {
    const result = parseTentaclePullRequestCreateInput({ title: "  spaced  " });
    expect(result.title).toBe("spaced");
  });

  it("trims baseRef", () => {
    const result = parseTentaclePullRequestCreateInput({ title: "T", baseRef: " dev " });
    expect(result.baseRef).toBe("dev");
  });

  it("errors when payload is null", () => {
    const result = parseTentaclePullRequestCreateInput(null);
    expect(result.error).toBe("Expected a JSON object body.");
  });

  it("errors when payload is not an object", () => {
    const result = parseTentaclePullRequestCreateInput("bad");
    expect(result.error).toBe("Expected a JSON object body.");
  });

  it("errors when title is missing", () => {
    const result = parseTentaclePullRequestCreateInput({});
    expect(result.error).toBe("Pull request title cannot be empty.");
  });

  it("errors when title is whitespace-only", () => {
    const result = parseTentaclePullRequestCreateInput({ title: "   " });
    expect(result.error).toBe("Pull request title cannot be empty.");
  });

  it("errors when body is not a string", () => {
    const result = parseTentaclePullRequestCreateInput({ title: "T", body: 99 });
    expect(result.error).toBe("Pull request body must be a string.");
  });

  it("errors when baseRef is not a string", () => {
    const result = parseTentaclePullRequestCreateInput({ title: "T", baseRef: false });
    expect(result.error).toBe("Pull request baseRef must be a string.");
  });

  it("errors when baseRef is empty after trimming", () => {
    const result = parseTentaclePullRequestCreateInput({ title: "T", baseRef: "  " });
    expect(result.error).toBe("Pull request baseRef cannot be empty.");
  });

  it("returns null baseRef when baseRef is not provided", () => {
    const result = parseTentaclePullRequestCreateInput({ title: "T" });
    expect(result.baseRef).toBeNull();
  });
});
