# State file contracts (`.sdd/` screen)

All files are plain markdown; frontmatter is flattened YAML (no nesting, no multiline).

## Layout

```
.sdd/
├── config.yml
├── specs/spec-01.md
├── stories/S001-<slug>(ready).md
├── quick/Q001-<slug>.md
├── sprints/S01-<slug>(in-progress).md
└── lessons.md
```

## config.yml

```yaml
schema_version: 1
language: es          # es | en — artifacts language
max_concurrency: 3    # 1..3
branch_prefix: "sdd/"
```

## Story file `stories/S007-<slug>(<status>).md`

Frontmatter (all story rows are validated mechanically):

```yaml
---
id: S007
title: Login with Google
status: ready            # backlog|ready|in-progress|blocked|in-review|done|cancelled
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

Sprint filename: `S##-<slug>(<status>).md`, with status `planned|in-progress|done|cancelled|blocked`.
The file carries goal, story list (in execution order), and date. Rename it whenever its status
changes; do not use `current.md`. Story filenames use `S###-<slug>(<status>).md` and are renamed
on every status change. Keep filename suffix and frontmatter `status` synchronized. A blocked
story records `blocked-why:` (e.g. `waiting-for-external-api`); `/sdd:status` lists these apart.

## Quick Micro-story `quick/Q001-<slug>.md`

Frontmatter:

```yaml
---
id: Q001
title: Fix timeout in payment webhook
status: done             # in-progress|done
type: fix                # fix|chore|feature
touches: [src/webhook.js]
created: 2026-10-31T21:30:00Z
completed: 2026-10-31T21:32:00Z
---
```

Body:

```markdown
## Objetivo
Descripción concisa de la corrección o cambio mínimo.

## Criterios de aceptación
- [ ] Retorna 200 y procesa timeout sin romper el flujo (test: tests/webhook.test.js)

## Ponytail Sign-off
- **Omitido:** No se crearon nuevos wrappers ni abstracciones adicionales.
- **Riesgos:** Ninguno en rutas de ejecución paralelas.
```

## Physical invariants enforced by tests

- Every id appears once; the id matches the filename slug.
- `blocked-by` refs exist, no cycles (through `blocked-by` and `parent`).
- A `parent` points at an existing story.
- Feature AC scenarios carry `(test: ...)` or `(manual: ...)`.
- `type: chore|refactor|spike` carries an explicit verification list.
- Priority in `P0..P3`, size in `S|M|L`, status in the canonical list, type in the canonical list.
