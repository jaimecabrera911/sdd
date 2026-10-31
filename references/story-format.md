# Story format and the single-responsibility rule

## The story contract

Every story must be executable by one builder in one focused run. If it is not, split it before
it reaches `ready`.

## Split rules (any one → must split)

1. Writing the "para <beneficio>" requires **more than one benefit**.
2. The body forces two **unrelated domain areas** into one change.
3. **More than 5** Gherkin scenarios are needed to cover genuine acceptance.

When a split happens: children get a fresh id, cite each other's threads via `parent:`, and the
original story becomes a note in the sprint archive (if the split happened mid-sprint) or is
never created (always split instead).

## Sizing

| Size | Meaning |
|---|---|
| S | one small module or ≤2 files; test first |
| M | one feature area, ≤5 files |
| L | suspicious → push back toward split unless genuinely atomic |

`L` stories are allowed but flagged in `/sdd:plan` as risk.

## Feature template (story body, in the configured language)

```markdown
Como <rol>, quiero <algo>, para <un único beneficio>.

## Criterios de aceptación

- **Dado** <situación> **Cuando** <la acción> **Entonces** <resultado observable>
  (test: <path-to-test>|<name>)
- **Dado** ... **Entonces** ... (manual: <pasos/evidencia>)
```

Each scenario must carry a `test:` or `manual:` reference. A scenario with neither is build
noise: split it or drop it.

## Non-feature types

**chore** — Problema técnico / Solución propuesta / Criterios de verificación (each item an
observable command or test). Examples: dependency bumps, migrations, CI, migrations.

**refactor** — same as chore, plus: meets both "solution moved to a better shape" and
"observable behavior unchanged" (the verification list proves behavior invariance).

**spike** — capped at a concrete question and a write-up expected in the report; no hidden
implementation work. Output: text in the sdd notes/path cited in the story.

## Priority

| Tag | Meaning |
|---|---|
| P0 | sprint-blocker, do first when unblocked |
| P1 | core of the sprint's goal |
| P2 | This sprint if capacity allows |
| P3 | backlog only |
