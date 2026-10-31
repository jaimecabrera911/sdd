# sdd method — hard rules and lifecycle

## Cycle

`init → backlog (groom) → plan (sprint) → build (execute) → review (accept) → retro (learn)`
`status` is a free pass at any moment.

## Board states

```
backlog → ready → in-progress → review → done
```

- `blocked: true` is a label that can coexist with any state; it is the only way a story is held.
  A blocked story also states its cause in `blocked-why:` (e.g. `waiting-for-external-api`),
  listed apart by `/sdd:status`, and cannot be promoted to the sprint frontier while it holds.
- A story only enters `ready` when grooming is complete (responsibility, size, priority, blocked-by).
- `in-progress` is set the moment a builder starts; `started:` timestamp is written then.
- Stories outside the current sprint stay `ready`, do not advance during the sprint.

## Hard rules (no exceptions)

1. **Git required.** Without a working repo nothing runs.
2. **Single-writer.** Only the orchestrator writes `.sdd/`. Subagents report text.
3. **No work without a story.** Code changes only through a story file, always.
4. **One responsibility per story.** Split rules in story-format.md; enforced at backlog.
   During build, discovering that a story bundles two responsibilities → stop that builder,
   send the story back to `backlog`, split, replan with the user if the sprint is affected.
5. **Frozen sprint.** After the plan gate, scope is frozen. New requirements are groomed into
   backlog for the next sprint. The user can order an `interrupt` explicitly; then the sprint
   is killed and replanned from scratch. No silent scope edits.
6. **No AC without a test.** Every Gherkin scenario cites `test: <ref>` or `manual: <evidence>`.
   `manual:` is for what genuinely cannot be automated (visuals, third-party dashboards).
7. **Commits carry the story id.** Builders: `sdd(S007): <free text>`. Orchestrator state
   changes: `sdd(S007): state → review` / `sdd(sprint-02): ...`.
8. **Commits exclude `.sdd/`.** Builders commit `touches` only; orchestrator commits state.

## Gates (only where a human is required)

- Sprint plan approval (plan phase).
- Reviewer failure → notify the user before re-running the same builder.
- Sprint sign-off (review phase).
- `interrupt` orders.

Everything else runs autonomously. `status` never asks anything.

Auto-gate (headless runs): when `SDD_AUTONOMOUS=1` is set in the session environment (e.g.
automated e2e via `opencode run`/server), the three gates below execute as self-approvals,
recording `(auto-gate)` + rationale in the sprint file, instead of pausing the flow to ask.
Interactive sessions never read this flag.

## Change control

| Path | Rule |
|---|---|
| New requirement, no sprint running | groom into backlog normally |
| Sprint frozen, small change | PO writes story into backlog tagged `next-sprint` in the description |
| Sprint frozen, blocker discovered | return affected stories to `backlog`, replan, one gate |
| `interrupt` (explicit user order only) | kill the sprint file, replan from scratch after a gate |

## Concurrency slots (build)

- Max parallel builders = `.sdd/config.yml max_concurrency` (cap 3).
- **Isolated worktree per parallel builder.** Three builders sharing one working tree share one
  `.git/index` — parallel commits collide on `index.lock`. So: when launching more than one
  builder concurrently, the orchestrator first creates `git worktree add
  .sdd/.worktrees/<ID> -b <branch_prefix><ID>` (branch prefix from config) and points the
  builder at that path; the builder commits there and never touches `.sdd/`. After review pass
  the orchestrator merges the branch into the integration branch and removes the worktree.
  Single-story flights (or serialized stories) run in the main tree — no worktree needed.
- Skip (serialize) a story whose `touches` intersect any in-flight story's.
- Max one `type: chore` in flight; migrations/schemas always fly solo.
- A failed story drops its slot immediately; no parallel retries of the same story.

## Merge and Conflict Resolution Protocol (post-review)

When a parallel builder passes `sdd-reviewer` verification:
1. **Pre-merge verification:** Ensure the integration branch is clean (`git status --porcelain`).
2. **Lineage-preserving merge:** Merge with `--no-ff`:
   `git merge --no-ff <branch_prefix><ID> -m "sdd(<ID>): merge story implementation"`
3. **Conflict handling rules:**
   - *Conflict on files outside declared touches:* Treat as unauthorized scope creep. Abort merge immediately (`git merge --abort`). Return the story to `in-progress` with notes describing the scope conflict.
   - *Conflict on lockfiles/build artifacts:* If the conflict is solely on package lockfiles or generated indexes, resolve deterministically using project tooling (`npm install`, `pnpm install`, or schema generation), verify tests pass, and complete the merge.
   - *Direct code conflict:* If merge conflicts occur on legitimate touches, run `git merge --abort`. Do NOT force-merge or discard either branch silently. Mark story as `blocked: true` with `blocked-why: merge-conflict-with-<prior-story>`, notify the orchestrator/user, and serialize resolution.
4. **Post-merge verification gate:** Run the integration test suite on the merged branch before pruning the worktree:
   `git worktree remove --force .sdd/.worktrees/<ID>` and `git branch -d <branch_prefix><ID>`.

## Ghost capture (build entry)

A story in `in-progress` with no commit matching `git log --grep "sdd(<id>)"` after its
`started:` is a ghost. Offer: reopen as-is (builder resumes from current ED state if clean) or
back to `ready` keeping notes. Never silently discard.

## Spec-first

- `specs/spec-NN.md` is the truth source; stories cite it via `spec-ref:`.
- If a story cannot be derived from a spec, ask the user before inventing one — the spec may
  need to grow first, and that is an init/invc-meeting conversation.
