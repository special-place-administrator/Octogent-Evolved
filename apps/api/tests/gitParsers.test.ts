import { describe, expect, it } from "vitest";
import {
  parseTentacleCommitMessage,
  parseTentaclePullRequestCreateInput,
  parseTentacleSyncBaseRef,
} from "../src/createApiServer/gitParsers";

describe("parseTentacleCommitMessage", () => {
  it("returns the trimmed message for a valid string", () => {
    expect(parseTentacleCommitMessage({ message: "feat: do thing" })).toEqual({
      message: "feat: do thing",
      error: null,
    });
  });

  it("trims surrounding whitespace from the message", () => {
    expect(parseTentacleCommitMessage({ message: "  hello  " })).toEqual({
      message: "hello",
      error: null,
    });
  });

  it("returns error for null payload", () => {
    expect(parseTentacleCommitMessage(null)).toEqual({
      message: null,
      error: "Expected a JSON object body.",
    });
  });

  it("returns error for undefined payload", () => {
    expect(parseTentacleCommitMessage(undefined)).toEqual({
      message: null,
      error: "Expected a JSON object body.",
    });
  });

  it("returns error for non-object payload", () => {
    expect(parseTentacleCommitMessage("string")).toEqual({
      message: null,
      error: "Expected a JSON object body.",
    });
  });

  it("returns error when message field is missing", () => {
    expect(parseTentacleCommitMessage({})).toEqual({
      message: null,
      error: "Commit message must be a string.",
    });
  });

  it("returns error when message is a number", () => {
    expect(parseTentacleCommitMessage({ message: 42 })).toEqual({
      message: null,
      error: "Commit message must be a string.",
    });
  });

  it("returns error when message is whitespace only", () => {
    expect(parseTentacleCommitMessage({ message: "   " })).toEqual({
      message: null,
      error: "Commit message cannot be empty.",
    });
  });

  it("returns error when message is empty string", () => {
    expect(parseTentacleCommitMessage({ message: "" })).toEqual({
      message: null,
      error: "Commit message cannot be empty.",
    });
  });
});

describe("parseTentacleSyncBaseRef", () => {
  it("returns null baseRef with no error for null payload", () => {
    expect(parseTentacleSyncBaseRef(null)).toEqual({
      baseRef: null,
      error: null,
    });
  });

  it("returns null baseRef with no error for undefined payload", () => {
    expect(parseTentacleSyncBaseRef(undefined)).toEqual({
      baseRef: null,
      error: null,
    });
  });

  it("returns error for non-object payload", () => {
    expect(parseTentacleSyncBaseRef("main")).toEqual({
      baseRef: null,
      error: "Expected a JSON object body.",
    });
  });

  it("returns null baseRef with no error when baseRef field is absent", () => {
    expect(parseTentacleSyncBaseRef({})).toEqual({
      baseRef: null,
      error: null,
    });
  });

  it("returns error when baseRef is a number", () => {
    expect(parseTentacleSyncBaseRef({ baseRef: 123 })).toEqual({
      baseRef: null,
      error: "baseRef must be a string.",
    });
  });

  it("returns error when baseRef is empty string", () => {
    expect(parseTentacleSyncBaseRef({ baseRef: "" })).toEqual({
      baseRef: null,
      error: "baseRef cannot be empty.",
    });
  });

  it("returns error when baseRef is whitespace only", () => {
    expect(parseTentacleSyncBaseRef({ baseRef: "   " })).toEqual({
      baseRef: null,
      error: "baseRef cannot be empty.",
    });
  });

  it("returns trimmed baseRef for a valid string", () => {
    expect(parseTentacleSyncBaseRef({ baseRef: "  main  " })).toEqual({
      baseRef: "main",
      error: null,
    });
  });

  it("returns baseRef as-is when already trimmed", () => {
    expect(parseTentacleSyncBaseRef({ baseRef: "origin/main" })).toEqual({
      baseRef: "origin/main",
      error: null,
    });
  });
});

describe("parseTentaclePullRequestCreateInput", () => {
  it("returns error for null payload", () => {
    expect(parseTentaclePullRequestCreateInput(null)).toEqual({
      title: null,
      body: "",
      baseRef: null,
      error: "Expected a JSON object body.",
    });
  });

  it("returns error for non-object payload", () => {
    expect(parseTentaclePullRequestCreateInput("text")).toEqual({
      title: null,
      body: "",
      baseRef: null,
      error: "Expected a JSON object body.",
    });
  });

  it("returns error when title is missing", () => {
    expect(parseTentaclePullRequestCreateInput({})).toEqual({
      title: null,
      body: "",
      baseRef: null,
      error: "Pull request title cannot be empty.",
    });
  });

  it("returns error when title is empty string", () => {
    expect(parseTentaclePullRequestCreateInput({ title: "" })).toEqual({
      title: null,
      body: "",
      baseRef: null,
      error: "Pull request title cannot be empty.",
    });
  });

  it("returns error when title is whitespace only", () => {
    expect(parseTentaclePullRequestCreateInput({ title: "   " })).toEqual({
      title: null,
      body: "",
      baseRef: null,
      error: "Pull request title cannot be empty.",
    });
  });

  it("returns error when title is not a string", () => {
    expect(parseTentaclePullRequestCreateInput({ title: 42 })).toEqual({
      title: null,
      body: "",
      baseRef: null,
      error: "Pull request title cannot be empty.",
    });
  });

  it("returns error when body is not a string", () => {
    expect(parseTentaclePullRequestCreateInput({ title: "My PR", body: 123 })).toEqual({
      title: null,
      body: "",
      baseRef: null,
      error: "Pull request body must be a string.",
    });
  });

  it("returns error when baseRef is not a string", () => {
    expect(parseTentaclePullRequestCreateInput({ title: "My PR", baseRef: true })).toEqual({
      title: null,
      body: "",
      baseRef: null,
      error: "Pull request baseRef must be a string.",
    });
  });

  it("returns error when baseRef is empty string", () => {
    expect(parseTentaclePullRequestCreateInput({ title: "My PR", baseRef: "" })).toEqual({
      title: null,
      body: "",
      baseRef: null,
      error: "Pull request baseRef cannot be empty.",
    });
  });

  it("returns error when baseRef is whitespace only", () => {
    expect(parseTentaclePullRequestCreateInput({ title: "My PR", baseRef: "  " })).toEqual({
      title: null,
      body: "",
      baseRef: null,
      error: "Pull request baseRef cannot be empty.",
    });
  });

  it("returns trimmed title and null body and null baseRef for minimal valid input", () => {
    expect(parseTentaclePullRequestCreateInput({ title: "  My PR  " })).toEqual({
      title: "My PR",
      body: "",
      baseRef: null,
      error: null,
    });
  });

  it("includes body when provided as string", () => {
    expect(
      parseTentaclePullRequestCreateInput({ title: "My PR", body: "Some description" }),
    ).toEqual({
      title: "My PR",
      body: "Some description",
      baseRef: null,
      error: null,
    });
  });

  it("includes trimmed baseRef when provided", () => {
    expect(
      parseTentaclePullRequestCreateInput({ title: "My PR", body: "", baseRef: "  main  " }),
    ).toEqual({
      title: "My PR",
      body: "",
      baseRef: "main",
      error: null,
    });
  });

  it("returns null baseRef when baseRef field is absent", () => {
    expect(parseTentaclePullRequestCreateInput({ title: "My PR", body: "desc" })).toEqual({
      title: "My PR",
      body: "desc",
      baseRef: null,
      error: null,
    });
  });

  it("returns empty body when body field is absent", () => {
    expect(parseTentaclePullRequestCreateInput({ title: "My PR" })).toEqual({
      title: "My PR",
      body: "",
      baseRef: null,
      error: null,
    });
  });
});
