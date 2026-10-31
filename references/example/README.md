# Worked example — a complete `.sdd/` mid-sprint

This is a real `.sdd/` tree (S001 `done`, S002 `in-progress`, current sprint frozen with its
Gates section). It is validated by `sdd-validator.test.mjs` on every run, so it always matches
the contracts in `../state-format.md`.

| File | What it shows |
|---|---|
| `config.yml` | required config keys, `language: es` |
| `.gitignore` | keeps `.worktrees/` out of state commits |
| `specs/spec-01.md` | spec referenced by both stories via `spec-ref:` |
| `stories/S001-login-google.md` | finished feature: 2 AC with `test:` refs, out-of-scope, `started` kept |
| `stories/S002-logout-button.md` | in-progress, `blocked-by: [S001]` ordered after it in the sprint |
| `sprints/current.md` | goal, date, capacity, ordered ids, `## Gates` |
| `lessons.md` | terse cross-memory read at the start of every run |

To eyeball it: `node <skill-dir>/sdd-validator.mjs <skill-dir>/references/example`.
