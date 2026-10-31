# State file contracts (`.sdd/` screen)

All files are plain markdown; frontmatter is flattened YAML (no nesting, no multiline).

## Layout

```
.sdd/
├── config.yml
├── specs/spec-01.md
├── stories/S001-<slug>.md
├── sprints/current.md → sprint-NN.md (archived)
└── lessons.md
```

## config.yml

```yaml
schema_version: 1
language: es          # es | en — artifacts language
max_concurrency: 3    # 1..3
branch_prefix: "sdd/"
```

## Story file `stories/S007-<slug>.md`

Frontmatter (all story rows are validated mechanically):

```yaml
---
id: S007
title: Login with Google
status: ready            # backlog|ready|in-progress|review|done
blocked: false
type: feature            # feature|chore|refactor|spike
priority: P1             # P0..P3
epic: auth               # optional
parent:                  # set when it was split from another story
size: M                  # S|M|L
blocked-by: [S004]       # may be empty
touches: [src/auth.js, package.json]
spec-ref: .sdd/specs/spec-01.md#oauth
started: ""              # ISO timestamp once in-progress
---
```

Body of a feature (in the configured language):

```markdown
Como <rol>, quiero <algo>, para <un único beneficio>.

## Criterios de aceptación

- **Dado** / **Cuando** / **Entonces** ... (test: tests/auth.test.js#login-google)
- ... (manual: <evidence-passos>)

## Fuera de alcance
- ...
```

Body of chore/refactor/spike:

```markdown
## Problema técnico
## Solución propuesta
## Criterios de verificación
- [ ] comando o prueba observable
```

## Sprint file

`current.md` carries goal, story list (in execution order), date; archived as `sprint-02.md` at
sign-off with the outcome recap. A held story additionally writes `blocked-why:` (e.g.
`waiting-for-external-api`) next to `blocked: true`; `/sdd:status` lists those apart.

## Physical invariants enforced by tests

- Every id appears once; the id matches the filename slug.
- `blocked-by` refs exist, no cycles (through `blocked-by` and `parent`).
- A `parent` points at an existing story.
- Feature AC scenarios carry `(test: ...)` or `(manual: ...)`.
- `type: chore|refactor|spike` carries an explicit verification list.
- Priority in `P0..P3`, size in `S|M|L`, status in the canonical list, type in the canonical list.
