# NOTICE

**Octogent-Evolved** is a fork of [hesamsheikh/octogent](https://github.com/hesamsheikh/octogent), originally created by **Hesam Sheikh**.

All credit for the original design, the canvas UI, the tentacle/worktree model, the channel-messaging primitive, and the overall multi-terminal orchestration concept belongs to the upstream author. This fork would not exist without that foundation.

## What this fork adds

This fork diverges from upstream `main` at the commit hash recorded in the initial merge on this repo. The focus of divergence is correctness and robustness of the swarm-orchestration flow:

- **Swarm coordinator contract**: coordinators now gate merge decisions on git commit bodies (structured `DONE:` / `BLOCKED:` markers) rather than on channel messages, which could fail silently.
- **Dynamic poll cadence**: coordinators pick 2 / 5 / 10-minute poll caps based on estimated task size.
- **`ahead=0` semantics hardened**: coordinator no longer misreads a fresh worker branch as "already merged" when its tip happens to point at main's current HEAD.
- **Env-var identity injection**: spawned PTYs now carry `OCTOGENT_TERMINAL_ID` / `OCTOGENT_TENTACLE_ID` / `OCTOGENT_PARENT_TERMINAL_ID` / `OCTOGENT_ROLE` / `OCTOGENT_API_BASE` so prompts and user commands never need to hardcode IDs.
- **Channel delivery fix**: messages injected into claude-code terminals now use bracketed-paste + delayed `\r` (same idiom as initial-prompt injection), so `DONE:` messages actually submit instead of staging in the input buffer.
- **CLI walk-up project lookup**: `octogent` CLI invoked from inside a git worktree now finds the owning project's config + live server, not the default port.
- **Worktree persistence across terminal lifecycles**: tentacle-scoped worktrees survive terminal cascade cleanup.
- **Planner prompt rewrite**: `prompts/tentacle-planner.md` restructured as a 5-phase low-interaction orchestrator with at most two user checkpoints (layout approval + auto-spawn confirmation).

See `git log origin/main` for the full commit history.

## License

Octogent-Evolved inherits the MIT license from upstream. See `LICENSE` for full text. This notice file exists to document the attribution in accordance with MIT terms and as a matter of honest provenance.
