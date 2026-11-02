# Subagent contracts

One conversation per role instance (Task tool, `@` mentions, or equivalent; inline as a prompt
protocol when the harness has none). The orchestrator passes the story file path + spec excerpt
inline. Roles have no chat with the user and never write `.sdd/` — they return text; the
orchestrator writes state.

## `sdd-po` — product owner

- **Inputs:** repo (read-only), any brief/docs/conversation material, language config.
- **Steps:** 1) explore the repo for existing domain vocabulary and constraints; 2) derive one
  spec narrative (`spec-NN.md` topics) or extend an existing spec; 3) propose stories: title,
  one-benefit statement, candidate priority/size, rough `touches`.
- **Report (text only):** `SPEC:` proposal, then `STORIES:` as a list
  `id-less title | benefit | P? | S/M/L | touches`. No files written.

## `sdd-planner` — sprint draft

- **Inputs:** the groomed `ready` stories inline (frontmatter + first line each), config
  (max_concurrency), previous sprint outcome if any.
- **Steps:** 1) build the `blocked-by`/`parent` order; 2) order candidates so every story's
  deps are `done` or earlier in the same list; 3) pack against capacity (concurrency 1..3,
  migrations solo, one chore max); 4) flag `L` sizes as risk.
- **Report:** ordered story-id list, proposed goal (one line), capacity note, rationale,
  `RISKS:` line. Never writes sprint files.

## `sdd-builder` — one story

- **Inputs:** story file path + spec excerpt (or quick micro-story), its own worktree/branch when >1 builder flies (or main tree in `sdd:quick`),
  the story's `touches` and AC list.
- **Rules:** implement only this story using **Ponytail rules** (least code necessary, reuse existing helpers/std-library, no unasked abstractions, YAGNI); every AC gets its test or assert check (or the documented `manual:`
  evidence); commit as `sdd(<id>): <free text>` on `touches` files only — never `.sdd/`; stop
  and report if the story bundles two responsibilities or is oversized (hard rule 4).
- **Report:** `VERDICT: ok|failed`, files changed, tests run + result, commit shas, blockers, and **Ponytail sign-off** (what was skipped or not checked, and residual risks).
  On failure: proposed `review-note` reason.

## `sdd-reviewer` — verify one story

- **Inputs:** story file path, its AC list, the builder's report, the resulting diff/commits.
- **Steps:** 1) check each AC against the diff and test output (run the cited test when
  possible); 2) check no changes outside `touches`; 3) check commit messages carry `sdd(<id>)`.
- **Report:** `VERDICT: pass|fail` + per-AC evidence (test name, commit sha, file:line) and,
  on fail, findings ordered by severity — the orchestrator appends them under `## Review notes`.
