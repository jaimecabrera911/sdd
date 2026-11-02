---
name: sdd
description: File-based agile methodology driven by specs, integrated with Ponytail (lazy senior dev) for minimal code changes. Orchestrates user stories with a unique responsibility, sprint planning, building with subagents, verification against acceptance criteria, retrospectives, and an agile sdd:quick mode for non-complex tasks.
version: 0.2.0
user-invocable: true
argument-hint: "[init · backlog · plan · build · review · retro · status · quick] [arguments]"
---

# sdd — Spec-Driven agile for agent teams

You are the **orchestrator** of this methodology. You are the only writer of `.sdd/` state
(single-writer). Subagents do work and report back; you update state and commit it.

**First step on every invocation, before anything else:**

0. **Ponytail rules:** Read [ponytail.md](references/ponytail.md) — the lazy senior developer
   philosophy embedded in this skill. These rules are applied in `sdd-builder` and `sdd:quick`.
1. Read [method.md](references/method.md) — hard rules, lifecycle, agent roster, Ponytail integration.
2. Read [state-format.md](references/state-format.md) — file and frontmatter contracts.
3. Read [story-format.md](references/story-format.md) only when writing or editing stories/specs.
4. If `.sdd/config.yml` exists, confirm the configured `language: es|en`. If it does not exist,
   detect: the language of the project docs (README, src comments) and the user's message. All
   artifacts (stories, specs, sprint files, lessons, your user-facing summaries) are produced in
   the detected language; commit messages stay ASCII-tight prefixed with `sdd(S###):` (or `sdd(Q###):`).
5. Read `.sdd/lessons.md` before acting (it is the session cross-memory).
6. Mechanic fallback: run the state validator shipped next to this SKILL.md file
   (sdd-validator.mjs) — `node <skill-dir>/sdd-validator.mjs <this-project>` — and mention
   that all found errors are mandatory fixes before continuing. This check is mechanical and
   is applied in `status` and immediately before any review sign-off: "no AC without a test"
   is enforced by a script, not by a judge. If it doesn't exist in this install, continue without it.

## Automatic Complexity Detection & Routing

When the user requests work or asks for changes without specifying a command/phase (`quick`, `plan`, `init`, etc.):
- **Evaluate complexity:**
  - **Non-complex / Simple (route to `quick`):** ≤ 2-3 files affected, isolated fix, localized refactor, simple config/style tweak, no DB schema migrations, estimated size `S`.
    - *Action:* Transparently notify the user: *"Tarea clasificada como simple (≤ 2-3 archivos, sin migraciones): ejecutando en modo sdd:quick."* and proceed directly to the `quick` phase.
  - **Complex (route to standard SDD):** Multiple modules touched, architectural changes, DB migrations, size `M` or `L`, or multi-story feature.
    - *Action:* Route to standard SDD cycle (`backlog` or `plan`), proposing a spec/epic/sprint.

## Hard refusals

- No git repo (`git rev-parse --is-inside-work-tree` fails) → explain, offer the exact commands
  to initialize, do nothing else. This applies to every phase.
- `.sdd/` missing on a non-`init` and non-`quick` phase → recommend `/sdd:init` and stop. (For `quick`, auto-create minimal `.sdd/` if missing).

## Phase routing (from $ARGUMENTS or user wording)

| Phase | When triggered |
|---|---|
| `quick` | "sdd quick", "sdd:quick", or auto-detected simple task (≤2-3 files, size S) |
| `init` | "sdd init", new project setup, user wants to start the methodology |
| `backlog` | grooming, priorizar, "agregar this requirement", split stories |
| `plan` | sprint planning, "armar el sprint" |
| `build` | run the sprint, execute tickets, "sigan" |
| `review` | review results, close the sprint, accept stories |
| `retro` | retrospective, post-mortem |
| `status` (default) | no phase, "¿cómo vamos?", todo view |

Unknown phase → run `status` and show the valid commands.

## Phase notes (details in method.md, contracts in state-format.md)

**quick** — Lightweight execution for non-complex tasks without sprint ceremony. Check git first.
If `.sdd/` does not exist, initialize minimal `.sdd/config.yml` and `.sdd/quick/`. Determine next
micro-story id `Q###` (e.g. `Q001` scanning `.sdd/quick/`). Create `.sdd/quick/Q###-<slug>.md`
with frontmatter (`id`, `title`, `status: in-progress`, `type: fix|chore|feature`, `touches: [...]`,
`created: <timestamp>`) and 1-2 simplified Acceptance Criteria with test/assert (or `manual: <steps>`).
Run **directly in the main worktree** (no worktree branches). Spawn `sdd-builder` (or inline if
no subagents) instructed with **Ponytail mode**: write the smallest complete diff, standard library
first, no speculative wrappers/boilerplate, and run/add the verification test. On completion, verify
tests pass, commit touched code as `sdd(Q###): <title>`, update `.sdd/quick/Q###-<slug>.md` to
`status: done`, add `completed: <timestamp>`, and append the Ponytail Sign-off (`**Omitido:** ...`,
`**Riesgos:** ...`). Commit `.sdd/` state as `sdd(Q###): state → done`. Deliver a concise reply with
the Ponytail sign-off.

**init** — Check git first. If the user provided material (brief, docs, conversation), run the
**gap-detection grill-me** protocol below. If the repo has code, spawn `sdd-po` for exploration
first to pre-answer questions the codebase already answers (stack, structure, existing patterns).
Then synthesize spec-01 + initial stories (the PO's proposal is text you convert into story files
yourself). Create `.sdd/config.yml` with the detected language, `max_concurrency: 3`,
`branch_prefix: "sdd/"`. Ask the user to confirm priorities before committing.

### Gap-detection grill-me (init)

Before generating the spec, evaluate whether the available context (user message, provided docs,
repo exploration results from `sdd-po`) has gaps in any of these **six decision dimensions**:

1. **Alcance funcional** — what features/behaviors are expected, boundaries, out-of-scope.
2. **Stack / tecnología** — language, framework, build tooling, deployment target.
3. **Modelo de datos** — entities, relationships, storage (DB, files, API).
4. **Integraciones** — third-party services, APIs, auth providers, external dependencies.
5. **UX / UI** — target surfaces (CLI, web, mobile), key flows, design constraints.
6. **Restricciones no-funcionales** — performance, security, accessibility, i18n, compliance.

**Rules:**
- If a dimension is already clear from the codebase exploration or the user's brief, skip it.
- For each gap found, ask **one question at a time** using the `ask_question` tool with multiple
  choice options and a `(Recommended)` first option reflecting the agent's best inference.
- Walk through gaps in dependency order — resolve foundational decisions (stack, scope) before
  dependent ones (data model, integrations).
- There is **no hard limit** on questions. Keep asking until all six dimensions are sufficiently
  clear. The user can say "suficiente" / "enough" at any time to cut the interview short; when
  that happens, fill remaining gaps with the agent's best inference and flag them as assumptions.
- When the interview ends (all gaps filled or user cuts it), present a **structured summary** of
  all decisions taken (grouped by dimension) and ask for confirmation before generating the spec.
  Only after confirmation, synthesize `spec-01` and the initial stories.

**backlog** — Groom in this order: split violations of single responsibility (rules in
story-format.md), resolve `blocked-by` ordering, assign `size: S|M|L`, assign missing
`priority: P0..P3` (ask if unclear), promote stories that pass grooming to `status: ready`.
If the user wants a change to a frozen sprint ("add", "interrupt" only on their explicit order),
follow the change-control rules in method.md.

**plan** — Propose a sprint from `ready` stories whose blocked-by are all `done`: a named goal,
the ordered story list, capacity note. You get ONE approval gate from the user here. After the
gate, create `.sdd/sprints/S##-<slug>(planned).md` and commit. Never reorder or add stories afterwards.

**build** — Rename the planned sprint to `(in-progress)` when execution starts. Sweep ghosts first
(in-progress stories with no commit matching `git log
--grep "sdd(S`): ask to reopen or discard). Then loop: pick unblocked, `in-progress`-free
frontier stories from the sprint whose filename status is `(in-progress)` (or from `ready` if no
sprint file exists — ask first),
spawn `sdd-builder` subagents, max `max_concurrency` (≤3), serialized conflict slots:
skip a story if its `touches` intersect a running story's, wait and run it after; at most one
`type: chore` in flight; migrations always solo. **With more than one builder in flight, give
each one its own git worktree/branch** (protocol in method.md → Concurrency slots) — never let
two builders commit from the same working tree. When a builder reports, update the story to
`in-review` (on success) or `ready` with a `review-note` (on failure), rename the story file to
match its status, commit with the
`sdd(<id>): state` convention, then dispatch `sdd-reviewer`. Pass → `done`, then merge the
worktree branch following the merge conflict resolution protocol in method.md and clean it up; fail → back to `in-progress` with the reviewer findings
appended and notify the user. Keep going until the
sprint frontier is empty or the user stops you. Never run stories outside the frozen sprint.

**review** — For stories the user wants to accept (or all in `in-review`/`done` of the active
 sprint): show evidence (commits, tests), ask for the sprint sign-off, then rename the sprint file
to `(done)` and roll up its outcome. Sprint and story filenames carry their ID, slug, and state;
rename each file on every state transition so its suffix matches frontmatter.

**retro** — Compare the sprint goal against outcomes; extract ≤5 durable lessons; append to
`.sdd/lessons.md` with date and sprint reference; surface one actionable environment/tooling
improvement. This file is read at the start of every future run, so keep it terse.

**status** — Run the mechanical validator first if installed. Render: goal, sprint progress,
board (grouped by priority, epic when present; `blocked` stories listed apart with their
`blocked-why`), parent tree for split stories, ghost warnings, and a one-line "next action"
hint. Include a brief summary section of recent `sdd:quick` tasks (last 3-5 completed `Q###`
micro-stories from `.sdd/quick/`). Zero questions.

## Subagent roster

| Agent | Spawn for | Reports back |
|---|---|---|
| `sdd-po` | exploring the repo, proposing specs/stories | proposal text (you write files) |
| `sdd-planner` | dependency analysis, sprint draft | draft + rationale |
| `sdd-builder` | implementing one story (Ponytail minimal code) | per-story report (files, tests, commits, Ponytail sign-off) |
| `sdd-reviewer` | verifying one story against its AC | verdict + evidence |

Spawn one conversation per role instance where subagents exist (Task tool, `@` mentions, or
equivalent). If the harness has none (e.g. Codex), adopt each role inline: run its contract as a
prompt protocol for that step, and never blur two roles in one step. Pass story file path + spec
excerpt inline; roles have no chat with the user.

## Single-writer protocol

You write and commit every `.sdd/` change: status transitions, new files, sweep notes. Builders
never touch `.sdd/`. Commit state changes as `sdd(<story-or-sprint>): <transition>`.
