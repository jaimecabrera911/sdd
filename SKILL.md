---
name: sdd
description: File-based agile methodology driven by specs. A single entry point orchestrates user stories with a unique responsibility, sprint planning, building with subagents, verification against acceptance criteria, and retrospectives. Agil methodology with .sdd/ backlog, planning, todo. Use when the user mentions sdd, agile, sprint, backlog, stories, or invokes /sdd:<task>.
version: 0.1.0
user-invocable: true
argument-hint: "[init · backlog · plan · build · review · retro · status] [arguments]"
---

# sdd — Spec-Driven agile for agent teams

You are the **orchestrator** of this methodology. You are the only writer of `.sdd/` state
(single-writer). Subagents do work and report back; you update state and commit it.

**First step on every invocation, before anything else:**

1. Read [method.md](method.md) — hard rules, lifecycle, agent roster.
2. Read [state-format.md](state-format.md) — file and frontmatter contracts.
3. Read [story-format.md](story-format.md) only when writing or editing stories/specs.
4. If `.sdd/config.yml` exists, confirm the configured `language: es|en`. If it does not exist,
   detect: the language of the project docs (README, src comments) and the user's message. All
   artifacts (stories, specs, sprint files, lessons, your user-facing summaries) are produced in
   the detected language; commit messages stay ASCII-tight prefixed with `sdd(S###):`.
5. Read `.sdd/lessons.md` before acting (it is the session cross-memory).
6. Mechanic fallback: run the state validator shipped next to this SKILL.md file
   (sdd-validator.mjs) — `node <skill-dir>/sdd-validator.mjs <this-project>` — and mention
   that all found errors are mandatory fixes before continuing. This check is mechanical and
   is applied in `status` and immediately before any review sign-off: "no AC without a test"
   is enforced by a script, not by a judge. If it doesn't exist in this install, continue without it.

## Hard refusals

- No git repo (`git rev-parse --is-inside-work-tree` fails) → explain, offer the exact commands
  to initialize, do nothing else. This applies to every phase.
- `.sdd/` missing on a non-`init` phase → recommend `/sdd:init` and stop.

## Phase routing (from $ARGUMENTS or user wording)

| Phase | When triggered |
|---|---|
| `init` | "sdd init", new project setup, user wants to start the methodology |
| `backlog` | grooming, priorizar, "agregar this requirement", split stories |
| `plan` | sprint planning, "armar el sprint" |
| `build` | run the sprint, execute tickets, "sigan" |
| `review` | review results, close the sprint, accept stories |
| `retro` | retrospective, post-mortem |
| `status` (default) | no phase, "¿cómo vamos?", todo view |

Unknown phase → run `status` and show the valid commands.

## Phase notes (details in method.md, contracts in state-format.md)

**init** — Check git first. If the user provided material (brief, docs, conversation), synthesize
spec-01 + initial stories (spawn `sdd-po` for exploration if the repo has code; the PO's proposal
is text you convert into story files yourself). If there is no material at all, interview with
short questions (≤6) before synthesizing. Create `.sdd/config.yml` with the detected language,
`max_concurrency: 3`, `branch_prefix: "sdd/"`. Ask the user to confirm priorities before
committing.

**backlog** — Groom in this order: split violations of single responsibility (rules in
story-format.md), resolve `blocked-by` ordering, assign `size: S|M|L`, assign missing
`priority: P0..P3` (ask if unclear), promote stories that pass grooming to `status: ready`.
If the user wants a change to a frozen sprint ("add", "interrupt" only on their explicit order),
follow the change-control rules in method.md.

**plan** — Propose a sprint from `ready` stories whose blocked-by are all `done`: a named goal,
the ordered story list, capacity note. You get ONE approval gate from the user here. After the
gate, write `.sdd/sprints/current.md` and commit. Never reorder or add stories afterwards.

**build** — Sweep ghosts first (in-progress stories with no commit matching `git log
--grep "sdd(S`): ask to reopen or discard). Then loop: pick unblocked, `in-progress`-free
frontier stories from the current sprint (or from `ready` if no sprint file exists — ask first),
spawn `sdd-builder` subagents, max `max_concurrency` (≤3), serialized conflict slots:
skip a story if its `touches` intersect a running story's, wait and run it after; at most one
`type: chore` in flight; migrations always solo. **With more than one builder in flight, give
each one its own git worktree/branch** (protocol in method.md → Concurrency slots) — never let
two builders commit from the same working tree. When a builder reports, update the story to
`review` (on success) or `ready` with a `review-note` (on failure), commit with the
`sdd(<id>): state` convention, then dispatch `sdd-reviewer`. Pass → `done`, then merge the
worktree branch following the merge conflict resolution protocol in method.md and clean it up; fail → back to `in-progress` with the reviewer findings
appended and notify the user. Keep going until the
sprint frontier is empty or the user stops you. Never run stories outside the frozen sprint.

**review** — For stories the user wants to accept (or all in `review`/`done` of the current
sprint): show evidence (commits, tests), ask for the sprint sign-off, then archive
`sprints/current.md` → `sprints/sprint-NN.md` with the outcome rolled up.

**retro** — Compare the sprint goal against outcomes; extract ≤5 durable lessons; append to
`.sdd/lessons.md` with date and sprint reference; surface one actionable environment/tooling
improvement. This file is read at the start of every future run, so keep it terse.

**status** — Run the mechanical validator first if installed. Render: goal, sprint progress,
board (grouped by priority, epic when present; `blocked: true` stories listed apart with their
`blocked-why`), parent tree for split stories, ghost warnings, and a one-line "next action"
hint. Zero questions.

## Subagent roster

| Agent | Spawn for | Reports back |
|---|---|---|
| `sdd-po` | exploring the repo, proposing specs/stories | proposal text (you write files) |
| `sdd-planner` | dependency analysis, sprint draft | draft + rationale |
| `sdd-builder` | implementing one story | per-story report (files, tests, commits) |
| `sdd-reviewer` | verifying one story against its AC | verdict + evidence |

Spawn one conversation per role instance where subagents exist (Task tool, `@` mentions, or
equivalent). If the harness has none (e.g. Codex), adopt each role inline: run its contract as a
prompt protocol for that step, and never blur two roles in one step. Pass story file path + spec
excerpt inline; roles have no chat with the user.

## Single-writer protocol

You write and commit every `.sdd/` change: status transitions, new files, sweep notes. Builders
never touch `.sdd/`. Commit state changes as `sdd(<story-or-sprint>): <transition>`.
