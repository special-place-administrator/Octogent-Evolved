import os
import re

# Fix 1: agentStateDetection.ts - add PROCESSING_PATTERNS constant
path = 'apps/api/src/agentStateDetection.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

if 'const PROCESSING_PATTERNS' not in content:
    content = content.replace(
        '] as const;\n\nconst DEFAULT_MAX_BUFFER_LENGTH',
        '] as const;\n\nconst PROCESSING_PATTERNS = [/esc to interrupt/i] as const;\n\nconst DEFAULT_MAX_BUFFER_LENGTH'
    )
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Fixed: {path}')
else:
    print(f'Already fixed: {path}')

# Fix 2: codexUsage.test.ts - use regex for path comparison
path = 'apps/api/tests/codexUsage.test.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = 'expect(writeFileText.mock.calls[0]?.[0]).toBe("/workspace/.codex/auth.json");'
new = 'expect(writeFileText.mock.calls[0]?.[0]).toMatch(/[\\\\/]workspace[\\\\/]\\.codex[\\\\/]auth\\.json$/);'
if old in content:
    content = content.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Fixed: {path}')
else:
    print(f'Already fixed or not found: {path}')

# Fix 3: canvas-tentacle-panel.test.tsx - expect 3 args
path = 'apps/web/tests/canvas-tentacle-panel.test.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old1 = 'expect(onSpawnSwarm).toHaveBeenNthCalledWith(1, "docs-knowledge", "worktree");'
new1 = 'expect(onSpawnSwarm).toHaveBeenNthCalledWith(1, "docs-knowledge", "worktree", 3);'
old2 = 'expect(onSpawnSwarm).toHaveBeenNthCalledWith(2, "docs-knowledge", "shared");'
new2 = 'expect(onSpawnSwarm).toHaveBeenNthCalledWith(2, "docs-knowledge", "shared", 3);'

if old1 in content:
    content = content.replace(old1, new1).replace(old2, new2)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Fixed: {path}')
else:
    print(f'Already fixed or not found: {path}')

# Fix 4: App.tsx - remove refreshColumns from onSpawnSwarm
path = 'apps/web/src/App.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = '''              onSpawnSwarm: async (tentacleId, workspaceMode, maxWorkers) => {
                const body: Record<string, unknown> = { workspaceMode };
                if (typeof maxWorkers === "number" && maxWorkers > 0) {
                  body.maxWorkers = Math.floor(maxWorkers);
                }
                const response = await fetch(
                  `/api/deck/tentacles/${encodeURIComponent(tentacleId)}/swarm`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                  },
                );
                if (!response.ok) {
                  const errorBody = await response.text().catch(() => response.statusText);
                  console.error(
                    `Failed to spawn swarm for tentacle ${tentacleId}: ${response.status} ${errorBody}`,
                  );
                  return;
                }
                await refreshColumns();
              },'''

new = '''              onSpawnSwarm: async (tentacleId, workspaceMode, maxWorkers) => {
                const body: Record<string, unknown> = { workspaceMode };
                if (typeof maxWorkers === "number" && maxWorkers > 0) {
                  body.maxWorkers = Math.floor(maxWorkers);
                }
                const response = await fetch(
                  `/api/deck/tentacles/${encodeURIComponent(tentacleId)}/swarm`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                  },
                );
                if (!response.ok) {
                  const errorBody = await response.text().catch(() => response.statusText);
                  console.error(
                    `Failed to spawn swarm for tentacle ${tentacleId}: ${response.status} ${errorBody}`,
                  );
                  return;
                }
                // Swarm workers are created asynchronously; the WebSocket will
                // deliver terminal events and trigger a debounced refresh.
                // Avoid an eager snapshot refresh that would return stale data.
              },'''

if old in content:
    content = content.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Fixed: {path}')
else:
    print(f'Already fixed or not found: {path}')

print('Done.')
