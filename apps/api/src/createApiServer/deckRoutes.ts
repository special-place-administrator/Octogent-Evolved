import { join } from "node:path";

import {
  addTodoItem,
  createDeckTentacle,
  deleteDeckTentacle,
  deleteTodoItem,
  editTodoItem,
  listDeckAvailableSkills,
  parseTodoProgress,
  readDeckTentacles,
  readDeckVaultFile,
  toggleTodoItem,
  updateDeckTentacleSuggestedSkills,
} from "../deck/readDeckTentacles";
import { resolvePrompt } from "../prompts";
import { MAX_CHILDREN_PER_PARENT, RuntimeInputError } from "../terminalRuntime";
import type { ApiRouteHandler } from "./routeHelpers";
import {
  readJsonBodyOrWriteError,
  writeJson,
  writeMethodNotAllowed,
  writeNoContent,
  writeText,
} from "./routeHelpers";
import { parseTerminalAgentProvider, parseTerminalWorkspaceMode } from "./terminalParsers";


const buildSingleTodoWorkerPrompt = async ({
  promptsDir,
  workspaceCwd,
  tentacleId,
  tentacleName,
  todoItemText,
  terminalId,
  apiPort,
}: {
  promptsDir: string;
  workspaceCwd: string;
  tentacleId: string;
  tentacleName: string;
  todoItemText: string;
  terminalId: string;
  apiPort: string;
}) => {
  const tentacleContextPath = join(workspaceCwd, ".octogent/tentacles", tentacleId);

  return await resolvePrompt(promptsDir, "swarm-worker", {
    tentacleName,
    tentacleId,
    tentacleContextPath,
    todoItemText,
    terminalId,
    apiPort,
    workspaceContextIntro:
      "You are working in the shared main workspace on the main branch, not in an isolated worktree.",
    workspaceGuidelines: [
      "- You must work in the main project directory. Do NOT create or use git worktrees for this task.",
      "- You are working in the shared main workspace. Keep edits narrow and focused on this one todo item.",
      "- Do NOT create commits. Leave your completed changes uncommitted in the main workspace.",
      "- Do NOT mark todo items done or rewrite tentacle context files unless this specific todo item explicitly requires it.",
    ].join("\n"),
    commitGuidance:
      "- Do NOT commit. Leave your completed changes uncommitted in the shared workspace and report what changed.",
    definitionOfDoneCommitStep:
      "Changes are left uncommitted in the shared main workspace, ready for operator review.",
    workspaceReminder: "Do not commit. Do not use worktrees.",
    parentTerminalId: "",
    parentSection: "",
  });
};

export const handleDeckTentaclesRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { workspaceCwd, projectStateDir },
) => {
  if (requestUrl.pathname !== "/api/deck/tentacles") return false;

  if (request.method === "GET") {
    const tentacles = readDeckTentacles(workspaceCwd, projectStateDir);
    writeJson(response, 200, tentacles, corsOrigin);
    return true;
  }

  if (request.method === "POST") {
    const bodyReadResult = await readJsonBodyOrWriteError(request, response, corsOrigin);
    if (!bodyReadResult.ok) return true;

    const body = bodyReadResult.payload as Record<string, unknown> | null;
    const name = body && typeof body.name === "string" ? body.name : "";
    const description = body && typeof body.description === "string" ? body.description : "";
    const color = body && typeof body.color === "string" ? body.color : "#d4a017";
    const suggestedSkills =
      body && Array.isArray(body.suggestedSkills)
        ? body.suggestedSkills.filter((skill): skill is string => typeof skill === "string")
        : [];

    const rawOctopus =
      body && typeof body.octopus === "object" && body.octopus !== null
        ? (body.octopus as Record<string, unknown>)
        : {};
    const octopus = {
      animation: typeof rawOctopus.animation === "string" ? rawOctopus.animation : null,
      expression: typeof rawOctopus.expression === "string" ? rawOctopus.expression : null,
      accessory: typeof rawOctopus.accessory === "string" ? rawOctopus.accessory : null,
      hairColor: typeof rawOctopus.hairColor === "string" ? rawOctopus.hairColor : null,
    };

    const result = createDeckTentacle(
      workspaceCwd,
      { name, description, color, octopus, suggestedSkills },
      projectStateDir,
    );
    if (!result.ok) {
      writeJson(response, 400, { error: result.error }, corsOrigin);
      return true;
    }

    writeJson(response, 201, result.tentacle, corsOrigin);
    return true;
  }

  writeMethodNotAllowed(response, corsOrigin);
  return true;
};

export const handleDeckSkillsRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { workspaceCwd },
) => {
  if (requestUrl.pathname !== "/api/deck/skills") return false;

  if (request.method !== "GET") {
    writeMethodNotAllowed(response, corsOrigin);
    return true;
  }

  writeJson(response, 200, listDeckAvailableSkills(workspaceCwd), corsOrigin);
  return true;
};

const DECK_TENTACLE_ITEM_PATTERN = /^\/api\/deck\/tentacles\/([^/]+)$/;

export const handleDeckTentacleItemRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { workspaceCwd, projectStateDir },
) => {
  const match = requestUrl.pathname.match(DECK_TENTACLE_ITEM_PATTERN);
  if (!match) return false;

  if (request.method !== "DELETE") {
    writeMethodNotAllowed(response, corsOrigin);
    return true;
  }

  const tentacleId = decodeURIComponent(match[1] as string);
  const result = deleteDeckTentacle(workspaceCwd, tentacleId, projectStateDir);
  if (!result.ok) {
    writeJson(response, 404, { error: result.error }, corsOrigin);
    return true;
  }

  writeNoContent(response, 204, corsOrigin);
  return true;
};

const DECK_VAULT_FILE_PATTERN = /^\/api\/deck\/tentacles\/([^/]+)\/files\/([^/]+)$/;

export const handleDeckVaultFileRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { workspaceCwd },
) => {
  const match = requestUrl.pathname.match(DECK_VAULT_FILE_PATTERN);
  if (!match) return false;
  if (request.method !== "GET") {
    writeMethodNotAllowed(response, corsOrigin);
    return true;
  }

  const tentacleId = decodeURIComponent(match[1] as string);
  const fileName = decodeURIComponent(match[2] as string);

  const content = readDeckVaultFile(workspaceCwd, tentacleId, fileName);
  if (content === null) {
    writeJson(response, 404, { error: "Vault file not found" }, corsOrigin);
    return true;
  }

  writeText(response, 200, content, "text/markdown; charset=utf-8", corsOrigin);
  return true;
};

const DECK_TENTACLE_SKILLS_PATTERN = /^\/api\/deck\/tentacles\/([^/]+)\/skills$/;

export const handleDeckTentacleSkillsRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { workspaceCwd, projectStateDir },
) => {
  const match = requestUrl.pathname.match(DECK_TENTACLE_SKILLS_PATTERN);
  if (!match) return false;
  if (request.method !== "PATCH") {
    writeMethodNotAllowed(response, corsOrigin);
    return true;
  }

  const body = await readJsonBodyOrWriteError(request, response, corsOrigin);
  if (!body.ok) return true;

  const payload = body.payload as Record<string, unknown> | null;
  const suggestedSkills = Array.isArray(payload?.suggestedSkills)
    ? payload.suggestedSkills.filter((skill): skill is string => typeof skill === "string")
    : null;

  if (suggestedSkills === null) {
    writeJson(response, 400, { error: "suggestedSkills (string[]) is required" }, corsOrigin);
    return true;
  }

  const tentacleId = decodeURIComponent(match[1] as string);
  const updated = updateDeckTentacleSuggestedSkills(
    workspaceCwd,
    tentacleId,
    suggestedSkills,
    projectStateDir,
  );
  if (!updated) {
    writeJson(response, 404, { error: "Tentacle not found" }, corsOrigin);
    return true;
  }

  writeJson(response, 200, updated, corsOrigin);
  return true;
};

// ---------------------------------------------------------------------------
// Deck — Todo toggle
// ---------------------------------------------------------------------------

const DECK_TODO_TOGGLE_PATTERN = /^\/api\/deck\/tentacles\/([^/]+)\/todo\/toggle$/;

export const handleDeckTodoToggleRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { workspaceCwd },
) => {
  const match = requestUrl.pathname.match(DECK_TODO_TOGGLE_PATTERN);
  if (!match) return false;
  if (request.method !== "PATCH") {
    writeMethodNotAllowed(response, corsOrigin);
    return true;
  }

  const body = await readJsonBodyOrWriteError(request, response, corsOrigin);
  if (!body.ok) return true;

  const { itemIndex, done } = body.payload as { itemIndex: unknown; done: unknown };
  if (typeof itemIndex !== "number" || typeof done !== "boolean") {
    writeJson(
      response,
      400,
      { error: "itemIndex (number) and done (boolean) are required" },
      corsOrigin,
    );
    return true;
  }

  const tentacleId = decodeURIComponent(match[1] as string);
  const result = toggleTodoItem(workspaceCwd, tentacleId, itemIndex, done);
  if (!result) {
    writeJson(response, 404, { error: "Todo item not found" }, corsOrigin);
    return true;
  }

  writeJson(response, 200, result, corsOrigin);
  return true;
};

// ---------------------------------------------------------------------------
// Deck — Todo edit (rename item text)
// ---------------------------------------------------------------------------

const DECK_TODO_EDIT_PATTERN = /^\/api\/deck\/tentacles\/([^/]+)\/todo\/edit$/;

export const handleDeckTodoEditRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { workspaceCwd },
) => {
  const match = requestUrl.pathname.match(DECK_TODO_EDIT_PATTERN);
  if (!match) return false;
  if (request.method !== "PATCH") {
    writeMethodNotAllowed(response, corsOrigin);
    return true;
  }

  const body = await readJsonBodyOrWriteError(request, response, corsOrigin);
  if (!body.ok) return true;

  const { itemIndex, text } = body.payload as { itemIndex: unknown; text: unknown };
  if (typeof itemIndex !== "number" || typeof text !== "string" || text.trim().length === 0) {
    writeJson(
      response,
      400,
      { error: "itemIndex (number) and text (non-empty string) are required" },
      corsOrigin,
    );
    return true;
  }

  const tentacleId = decodeURIComponent(match[1] as string);
  const result = editTodoItem(workspaceCwd, tentacleId, itemIndex, text.trim());
  if (!result) {
    writeJson(response, 404, { error: "Todo item not found" }, corsOrigin);
    return true;
  }

  writeJson(response, 200, result, corsOrigin);
  return true;
};

// ---------------------------------------------------------------------------
// Deck — Todo add
// ---------------------------------------------------------------------------

const DECK_TODO_ADD_PATTERN = /^\/api\/deck\/tentacles\/([^/]+)\/todo$/;

export const handleDeckTodoAddRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { workspaceCwd },
) => {
  const match = requestUrl.pathname.match(DECK_TODO_ADD_PATTERN);
  if (!match) return false;
  if (request.method !== "POST") {
    writeMethodNotAllowed(response, corsOrigin);
    return true;
  }

  const body = await readJsonBodyOrWriteError(request, response, corsOrigin);
  if (!body.ok) return true;

  const { text } = body.payload as { text: unknown };
  if (typeof text !== "string" || text.trim().length === 0) {
    writeJson(response, 400, { error: "text (non-empty string) is required" }, corsOrigin);
    return true;
  }

  const tentacleId = decodeURIComponent(match[1] as string);
  const result = addTodoItem(workspaceCwd, tentacleId, text.trim());
  if (!result) {
    writeJson(response, 404, { error: "Tentacle todo.md not found" }, corsOrigin);
    return true;
  }

  writeJson(response, 201, result, corsOrigin);
  return true;
};

// ---------------------------------------------------------------------------
// Deck — Todo delete
// ---------------------------------------------------------------------------

const DECK_TODO_DELETE_PATTERN = /^\/api\/deck\/tentacles\/([^/]+)\/todo\/delete$/;

export const handleDeckTodoDeleteRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { workspaceCwd },
) => {
  const match = requestUrl.pathname.match(DECK_TODO_DELETE_PATTERN);
  if (!match) return false;
  if (request.method !== "POST") {
    writeMethodNotAllowed(response, corsOrigin);
    return true;
  }

  const body = await readJsonBodyOrWriteError(request, response, corsOrigin);
  if (!body.ok) return true;

  const { itemIndex } = body.payload as { itemIndex: unknown };
  if (typeof itemIndex !== "number") {
    writeJson(response, 400, { error: "itemIndex (number) is required" }, corsOrigin);
    return true;
  }

  const tentacleId = decodeURIComponent(match[1] as string);
  const result = deleteTodoItem(workspaceCwd, tentacleId, itemIndex);
  if (!result) {
    writeJson(response, 404, { error: "Todo item not found" }, corsOrigin);
    return true;
  }

  writeJson(response, 200, result, corsOrigin);
  return true;
};

// ---------------------------------------------------------------------------
// Deck — Solve a single todo item
// ---------------------------------------------------------------------------

const DECK_TODO_SOLVE_PATTERN = /^\/api\/deck\/tentacles\/([^/]+)\/todo\/solve$/;

export const handleDeckTodoSolveRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { runtime, workspaceCwd, projectStateDir, promptsDir, getApiPort },
) => {
  const match = requestUrl.pathname.match(DECK_TODO_SOLVE_PATTERN);
  if (!match) return false;
  if (request.method !== "POST") {
    writeMethodNotAllowed(response, corsOrigin);
    return true;
  }

  const bodyReadResult = await readJsonBodyOrWriteError(request, response, corsOrigin);
  if (!bodyReadResult.ok) return true;

  const body = (bodyReadResult.payload ?? {}) as Record<string, unknown>;
  const itemIndex = body.itemIndex;
  if (typeof itemIndex !== "number") {
    writeJson(response, 400, { error: "itemIndex (number) is required" }, corsOrigin);
    return true;
  }

  const agentProviderResult = parseTerminalAgentProvider(body);
  if (agentProviderResult.error) {
    writeJson(response, 400, { error: agentProviderResult.error }, corsOrigin);
    return true;
  }

  const tentacleId = decodeURIComponent(match[1] as string);
  const todoContent = readDeckVaultFile(workspaceCwd, tentacleId, "todo.md");
  if (todoContent === null) {
    writeJson(response, 404, { error: "Tentacle or todo.md not found." }, corsOrigin);
    return true;
  }

  const todoResult = parseTodoProgress(todoContent);
  const todoItem = todoResult.items[itemIndex] ?? null;
  if (!todoItem) {
    writeJson(response, 404, { error: "Todo item not found." }, corsOrigin);
    return true;
  }
  if (todoItem.done) {
    writeJson(response, 400, { error: "Todo item is already complete." }, corsOrigin);
    return true;
  }

  const terminalId = `${tentacleId}-todo-${itemIndex}`;
  const existingTerminal = runtime
    .listTerminalSnapshots()
    .find((terminal) => terminal.terminalId === terminalId);
  if (existingTerminal) {
    writeJson(
      response,
      409,
      { error: "A solve agent is already active for this todo item.", terminalId },
      corsOrigin,
    );
    return true;
  }

  const deckTentacles = readDeckTentacles(workspaceCwd, projectStateDir);
  const deckEntry = deckTentacles.find((tentacle) => tentacle.tentacleId === tentacleId);
  const tentacleName = deckEntry?.displayName ?? tentacleId;

  try {
    const workerPrompt = await buildSingleTodoWorkerPrompt({
      promptsDir,
      workspaceCwd,
      tentacleId,
      tentacleName,
      todoItemText: todoItem.text,
      terminalId,
      apiPort: getApiPort(),
    });

    const snapshot = runtime.createTerminal({
      terminalId,
      tentacleId,
      tentacleName,
      nameOrigin: "generated",
      autoRenamePromptContext: todoItem.text,
      workspaceMode: "shared",
      ...(agentProviderResult.agentProvider
        ? { agentProvider: agentProviderResult.agentProvider }
        : {}),
      ...(workerPrompt ? { initialPrompt: workerPrompt } : {}),
    });

    writeJson(
      response,
      201,
      {
        terminalId: snapshot.terminalId,
        tentacleId,
        itemIndex,
        workspaceMode: "shared",
      },
      corsOrigin,
    );
    return true;
  } catch (error) {
    if (error instanceof RuntimeInputError) {
      writeJson(response, 400, { error: error.message }, corsOrigin);
      return true;
    }

    throw error;
  }
};

// ---------------------------------------------------------------------------
// Deck — Swarm
// ---------------------------------------------------------------------------

const DECK_TENTACLE_SWARM_PATTERN = /^\/api\/deck\/tentacles\/([^/]+)\/swarm$/;

export const handleDeckTentacleSwarmRoute: ApiRouteHandler = async (
  { request, response, requestUrl, corsOrigin },
  { runtime, workspaceCwd, projectStateDir, promptsDir, getApiPort },
) => {
  const match = requestUrl.pathname.match(DECK_TENTACLE_SWARM_PATTERN);
  if (!match) return false;

  if (request.method !== "POST") {
    writeMethodNotAllowed(response, corsOrigin);
    return true;
  }

  const tentacleId = decodeURIComponent(match[1] as string);

  // Read and parse the tentacle's todo.md.
  const todoContent = readDeckVaultFile(workspaceCwd, tentacleId, "todo.md");
  if (todoContent === null) {
    writeJson(response, 404, { error: "Tentacle or todo.md not found." }, corsOrigin);
    return true;
  }

  const todoResult = parseTodoProgress(todoContent);
  const incompleteItems = todoResult.items
    .map((item, index) => ({ ...item, index }))
    .filter((item) => !item.done);

  if (incompleteItems.length === 0) {
    writeJson(response, 400, { error: "No incomplete todo items found." }, corsOrigin);
    return true;
  }

  // Parse optional request body for item filtering and agent provider.
  const bodyReadResult = await readJsonBodyOrWriteError(request, response, corsOrigin);
  if (!bodyReadResult.ok) return true;
  const body = (bodyReadResult.payload ?? {}) as Record<string, unknown>;

  const agentProviderResult = parseTerminalAgentProvider(body);
  if (agentProviderResult.error) {
    writeJson(response, 400, { error: agentProviderResult.error }, corsOrigin);
    return true;
  }

  const workspaceModeResult = parseTerminalWorkspaceMode(body);
  if (workspaceModeResult.error) {
    writeJson(response, 400, { error: workspaceModeResult.error }, corsOrigin);
    return true;
  }
  const workerWorkspaceMode =
    body.workspaceMode === undefined ? "worktree" : workspaceModeResult.workspaceMode;

  // Additive / idempotent: filter out todos already claimed by an active
  // worker. A claim is just "there is a live terminal for this tentacle's
  // swarm with a matching todoIndex in its terminalId" — tracked in the
  // runtime registry, no markdown state. When a terminal exits or is
  // removed, the claim auto-releases.
  const existingTerminals = runtime.listTerminalSnapshots();
  const claimedIndices = new Set<number>();
  const workerIdPrefix = `${tentacleId}-swarm-`;
  const parentSuffix = "-swarm-parent";
  for (const terminal of existingTerminals) {
    if (!terminal.terminalId.startsWith(workerIdPrefix)) continue;
    if (terminal.terminalId.endsWith(parentSuffix)) continue; // parent isn't a worker
    const suffix = terminal.terminalId.slice(workerIdPrefix.length);
    const parsed = Number.parseInt(suffix, 10);
    if (Number.isInteger(parsed)) {
      claimedIndices.add(parsed);
    }
  }

  let targetItems = incompleteItems.filter((item) => !claimedIndices.has(item.index));

  // Filter to specific item indices if requested.
  if (Array.isArray(body.todoItemIndices)) {
    const requestedIndices = new Set(
      (body.todoItemIndices as unknown[]).filter((v): v is number => typeof v === "number"),
    );
    targetItems = targetItems.filter((item) => requestedIndices.has(item.index));
    if (targetItems.length === 0) {
      writeJson(
        response,
        400,
        {
          error:
            "None of the requested todo item indices are free (either done, nonexistent, or already claimed by an active worker).",
        },
        corsOrigin,
      );
      return true;
    }
  }

  if (targetItems.length === 0) {
    writeJson(
      response,
      400,
      {
        error: "No free todo items available — all incomplete items are already claimed by active workers.",
        claimedIndices: [...claimedIndices],
      },
      corsOrigin,
    );
    return true;
  }

  // Worker count: bounded by min(body.maxWorkers, MAX_CHILDREN_PER_PARENT, targetItems.length).
  // UI exposes maxWorkers as an explicit user control; MAX_CHILDREN_PER_PARENT
  // is the runtime hard cap.
  const rawMaxWorkers = typeof body.maxWorkers === "number" ? Math.floor(body.maxWorkers) : undefined;
  const effectiveMax =
    rawMaxWorkers !== undefined && rawMaxWorkers > 0
      ? Math.min(rawMaxWorkers, MAX_CHILDREN_PER_PARENT)
      : MAX_CHILDREN_PER_PARENT;
  if (targetItems.length > effectiveMax) {
    // Todo order is priority order, so overflow items are deferred.
    targetItems = targetItems.slice(0, effectiveMax);
  }

  // Determine base ref: use tentacle's worktree branch if it exists, otherwise HEAD.
  const tentacleTerminal = existingTerminals.find(
    (t) => t.tentacleId === tentacleId && t.workspaceMode === "worktree",
  );
  const baseRef = tentacleTerminal ? `octogent/${tentacleId}` : "HEAD";

  // Resolve the tentacle display name for prompts.
  const deckTentacles = readDeckTentacles(workspaceCwd, projectStateDir);
  const deckEntry = deckTentacles.find((t) => t.tentacleId === tentacleId);
  const tentacleName = deckEntry?.displayName ?? tentacleId;

  const apiPort = getApiPort();
  const needsParent = targetItems.length > 1;
  const parentTerminalId = needsParent ? `${tentacleId}-swarm-parent` : null;
  const tentacleContextPath = join(workspaceCwd, ".octogent/tentacles", tentacleId);
  const workers = targetItems.map((item) => ({
    terminalId: `${tentacleId}-swarm-${item.index}`,
    todoIndex: item.index,
    todoText: item.text,
  }));

  const buildWorkerContextIntro = (): string =>
    workerWorkspaceMode === "worktree"
      ? "You are working on an isolated worktree branch, not the main branch."
      : "You are working in the shared main workspace on the main branch, not in an isolated worktree.";

  const buildWorkerGuidelines = (terminalId: string): string =>
    workerWorkspaceMode === "worktree"
      ? `- You are working in an isolated git worktree on branch \`octogent/${terminalId}\`. Make changes freely without worrying about conflicts with other agents.`
      : [
          "- You are working in the shared main workspace. Other workers may touch the same files, so keep your edits narrow, avoid broad refactors, and coordinate via your parent if you hit overlap.",
          "- Do NOT create commits in shared mode. Leave your changes uncommitted for the coordinator to review and commit later.",
          "- Do NOT mark todo items done or rewrite tentacle context files unless your assigned todo item explicitly requires it. The coordinator handles the final tentacle-level sync.",
        ].join("\n");

  const buildWorkerCommitGuidance = (): string =>
    workerWorkspaceMode === "worktree"
      ? "- Commit your changes with a clear commit message describing what you did."
      : "- Do NOT commit in shared mode. Leave your completed changes uncommitted and report DONE with a short summary of what changed.";

  const buildWorkerDefinitionOfDoneCommitStep = (): string =>
    workerWorkspaceMode === "worktree"
      ? "Changes are committed with a descriptive message."
      : "Changes are left uncommitted in the shared workspace, ready for coordinator review.";

  const buildWorkerReminder = (): string =>
    workerWorkspaceMode === "worktree" ? "Commit." : "Do not commit in shared mode.";

  const buildWorkerWorkspaceSection = (): string =>
    workerWorkspaceMode === "worktree"
      ? [
          "Each worker commits to its own isolated branch:",
          "",
          ...workers.map(
            (w) => `- \`octogent/${w.terminalId}\` — item #${w.todoIndex}: ${w.todoText}`,
          ),
        ].join("\n")
      : [
          "Workers are running in the shared main workspace, not in separate worktrees.",
          "",
          "There are no per-worker branches for this swarm. Supervise them carefully to avoid overlapping edits in the same files.",
        ].join("\n");

  const buildCompletionStrategySection = (baseBranch: string): string =>
    workerWorkspaceMode === "worktree"
      ? [
          `**Parameters for this swarm:**`,
          "",
          `- Base branch: \`${baseBranch}\``,
          `- Integration branch: \`octogent_integration_${tentacleId}\``,
          `- Worker branches:`,
          ...workers.map(
            (w) => `  - \`octogent/${w.terminalId}\` — item #${w.todoIndex}: ${w.todoText}`,
          ),
          "",
          "### Step-by-step merge process",
          "",
          `1. **Create the integration branch** from \`${baseBranch}\`. Delete any stale one first:`,
          "   ```bash",
          `   git branch -D octogent_integration_${tentacleId} 2>/dev/null || true`,
          `   git checkout ${baseBranch}`,
          `   git checkout -b octogent_integration_${tentacleId}`,
          "   ```",
          "",
          "2. **Review each mergeable worker branch** before merging it:",
          "   ```bash",
          `   git log <worker-branch> --oneline`,
          `   git show <worker-branch> --stat`,
          `   git diff ${baseBranch}..<worker-branch>`,
          "   ```",
          `   A worker branch is "mergeable" when it is ahead of \`${baseBranch}\`, its worktree is clean, and its verification commands (per CONTEXT.md) pass. You do not need a DONE channel message — the commit IS the signal.`,
          "",
          "3. **Merge each mergeable worker branch** into the integration branch. Start with the smallest diff:",
          "   ```bash",
          "   git merge --no-ff <worker-branch>",
          "   ```",
          "   Resolve conflicts carefully — read both sides before choosing.",
          "",
          "4. **Run tests** on the integration branch after all merges. Do not skip this step.",
          "",
          `5. **If tests pass**, merge the integration branch into \`${baseBranch}\`:`,
          "   ```bash",
          `   git checkout ${baseBranch}`,
          `   git merge --no-ff octogent_integration_${tentacleId}`,
          "   ```",
          "",
          "6. **If tests fail**, investigate and fix on the integration branch before merging into base. Do not merge broken code.",
          "",
          `7. **Sync tentacle docs**: tick completed items \`[x]\` in \`.octogent/tentacles/${tentacleId}/todo.md\`. Update \`.octogent/tentacles/${tentacleId}/CONTEXT.md\` only if the merged work changed the reality it describes.`,
          "",
          "8. **Clean up:**",
          "   ```bash",
          `   git branch -d octogent_integration_${tentacleId}`,
          "   ```",
          "",
          "### Handling stalled or blocked workers",
          "",
          "- **No commits after ~15 minutes of activity**: likely stuck. Investigate; do not spawn a replacement worker.",
          "- **Commit message contains `BLOCKED:`** (prefix or section): read the blocker body, resolve what you can (edit CONTEXT.md, unblock dependencies), or escalate to the operator.",
          "- **Branch has commits but worktree is dirty**: worker is mid-step. Give it another poll cycle before merging.",
          "- **Merge conflicts too complex to resolve**: merge the other workers' branches first; leave the conflicted one for the operator.",
        ].join("\n")
      : [
          `Only begin final verification after ALL ${workers.length} workers have reported DONE.`,
          "",
          "Workers are sharing the main workspace, so there are no per-worker branches to merge.",
          "",
          "### Step-by-step completion process",
          "",
          `1. **Verify the workspace is on \`${baseBranch}\`** and review the overall diff carefully. Do not assume the combined result is safe just because workers reported DONE.`,
          "",
          "2. **Review the changed files** to ensure workers did not overwrite each other or leave partial edits.",
          "",
          "3. **Run tests** on the shared workspace after all workers report DONE. Do not skip this step.",
          "",
          "4. **If tests fail**, investigate and coordinate fixes. Do not declare the swarm complete while the workspace is broken.",
          "",
          `5. **Update tentacle state/docs** before asking for approval. Mark completed items as done in \`.octogent/tentacles/${tentacleId}/todo.md\`, and update \`.octogent/tentacles/${tentacleId}/CONTEXT.md\` or other tentacle markdown files if the completed work changed the reality they describe. If no tentacle docs need updates, say that explicitly.`,
          "",
          "6. **Wait for explicit user approval** before creating any commit on the shared main branch. Present a concise summary of the reviewed diff, test results, and tentacle-doc updates first.",
          "",
          "7. **Only after approval, create one final commit** on the shared branch that captures the swarm's completed work.",
          "",
          "8. **Report completion** only after the shared workspace is reviewed, tests pass, tentacle docs are synced, approval is granted, and the final commit is created.",
          "",
          "### Shared-workspace failure recovery",
          "",
          "If two workers collide in the same files, stop them from making broad new edits, inspect the current diff, and coordinate targeted follow-up changes instead of pretending there is a clean merge boundary.",
        ].join("\n");

  const parentBaseBranch =
    workerWorkspaceMode === "worktree" ? (baseRef === "HEAD" ? "main" : baseRef) : "main";

  try {
    // Spawn every worker terminal directly from the API. The previous design
    // delegated this to the parent coordinator agent (which was supposed to
    // execute `octogent terminal create` commands via shell) — that was
    // fragile: depended on agent compliance, agent timing, and shell-escaping
    // correctness. Direct spawning is deterministic.
    //
    // Stagger subsequent worker spawns by SPAWN_STAGGER_MS so their Claude
    // Code sessions don't all hit the initial-prompt-inject timer at the
    // same system-load peak. Without this, concurrent bracketed-paste +
    // Enter events interleave and Claude Code can fail to register the
    // Enter as a submit, leaving the prompt staged but not sent.
    const SPAWN_STAGGER_MS = 500;
    let spawnIndex = 0;
    for (const worker of workers) {
      const item = targetItems.find((it) => it.index === worker.todoIndex);
      if (!item) continue;

      const parentSection = parentTerminalId
        ? [
            "## Communication",
            "",
            "Your coordinator reads your FINAL commit body (the `DONE:` / `BLOCKED:` marker) as the authoritative signal. That is the contract. Channels are optional courtesy, not required.",
            "",
            "Identity env vars set by the runtime (use these — do not hardcode IDs):",
            "",
            "- `$OCTOGENT_TERMINAL_ID` — your own terminal ID",
            "- `$OCTOGENT_TENTACLE_ID` — the tentacle you belong to",
            "- `$OCTOGENT_PARENT_TERMINAL_ID` — the coordinator's terminal ID",
            "- `$OCTOGENT_ROLE` — `worker` for you",
            "- `$OCTOGENT_API_BASE` — the live API origin (the CLI auto-picks this up)",
            "",
            "Optional channel-send (fire-and-forget; failure is harmless):",
            "",
            "```bash",
            `octogent channel send "$OCTOGENT_PARENT_TERMINAL_ID" "DONE: ${item.text}" --from "$OCTOGENT_TERMINAL_ID" || true`,
            "```",
            "If blocked and you want to also ping the coordinator:",
            "```bash",
            `octogent channel send "$OCTOGENT_PARENT_TERMINAL_ID" "BLOCKED: <describe>" --from "$OCTOGENT_TERMINAL_ID" || true`,
            "```",
            "",
            "Do not block on channel success. The commit body is the real report.",
          ].join("\n")
        : "";

      const workerPrompt = await resolvePrompt(promptsDir, "swarm-worker", {
        tentacleName,
        tentacleId,
        tentacleContextPath,
        todoItemText: item.text,
        terminalId: worker.terminalId,
        apiPort,
        workspaceContextIntro: buildWorkerContextIntro(),
        workspaceGuidelines: buildWorkerGuidelines(worker.terminalId),
        commitGuidance: buildWorkerCommitGuidance(),
        definitionOfDoneCommitStep: buildWorkerDefinitionOfDoneCommitStep(),
        workspaceReminder: buildWorkerReminder(),
        parentTerminalId: parentTerminalId ?? "",
        parentSection,
      });

      runtime.createTerminal({
        terminalId: worker.terminalId,
        tentacleId,
        ...(workerWorkspaceMode === "worktree" ? { worktreeId: worker.terminalId } : {}),
        ...(parentTerminalId ? { parentTerminalId } : {}),
        tentacleName,
        nameOrigin: "generated",
        autoRenamePromptContext: item.text,
        workspaceMode: workerWorkspaceMode,
        ...(agentProviderResult.agentProvider
          ? { agentProvider: agentProviderResult.agentProvider }
          : {}),
        ...(workerPrompt ? { initialPrompt: workerPrompt } : {}),
        ...(workerWorkspaceMode === "worktree" ? { baseRef } : {}),
      });

      spawnIndex++;
      if (spawnIndex < workers.length) {
        await new Promise<void>((resolve) => setTimeout(resolve, SPAWN_STAGGER_MS));
      }
    }

    // Parent coordinator for multi-worker swarms. Role is monitor + merge
    // only — it does NOT spawn workers. All workers listed in its prompt
    // already exist at this point.
    if (needsParent && parentTerminalId) {
      const workerListing = workers
        .map((w) => `- \`${w.terminalId}\` — item #${w.todoIndex}: ${w.todoText}`)
        .join("\n");

      const parentPrompt = await resolvePrompt(promptsDir, "swarm-parent", {
        tentacleName,
        tentacleId,
        workerCount: String(workers.length),
        maxChildrenPerParent: String(MAX_CHILDREN_PER_PARENT),
        workerListing,
        workerWorkspaceSection: buildWorkerWorkspaceSection(),
        completionStrategySection: buildCompletionStrategySection(parentBaseBranch),
        baseBranch: parentBaseBranch,
        terminalId: parentTerminalId,
        apiPort,
      });

      runtime.createTerminal({
        terminalId: parentTerminalId,
        tentacleId,
        tentacleName: `${tentacleName} (coordinator)`,
        workspaceMode: "shared",
        ...(agentProviderResult.agentProvider
          ? { agentProvider: agentProviderResult.agentProvider }
          : {}),
        ...(parentPrompt ? { initialPrompt: parentPrompt } : {}),
      });
    }
  } catch (error) {
    if (error instanceof RuntimeInputError) {
      writeJson(response, 400, { error: error.message }, corsOrigin);
      return true;
    }
    throw error;
  }

  writeJson(
    response,
    201,
    { tentacleId, parentTerminalId, workers, claimedIndicesBeforeSpawn: [...claimedIndices] },
    corsOrigin,
  );
  return true;
};
