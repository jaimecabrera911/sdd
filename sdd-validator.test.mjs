import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateState } from './sdd-validator.mjs';

const VALIDATOR = fileURLToPath(new URL('./sdd-validator.mjs', import.meta.url));

function fixture(stories) {
  const root = mkdtempSync(join(tmpdir(), 'sdd-test-'));
  const sdd = join(root, '.sdd');
  mkdirSync(join(sdd, 'stories'), { recursive: true });
  mkdirSync(join(sdd, 'sprints'), { recursive: true });
  mkdirSync(join(sdd, 'specs'), { recursive: true });
  writeFileSync(join(sdd, 'specs', 'spec-01.md'), '# Spec 01\n');
  writeFileSync(join(sdd, 'config.yml'),
    'schema_version: 1\nlanguage: es\nmax_concurrency: 3\nbranch_prefix: "sdd/"\n');
  for (const [file, content] of Object.entries(stories)) {
    writeFileSync(join(sdd, 'stories', file), content);
  }
  return root;
}

const featureStory = (id, body, extra = '') => `---
id: ${id}
title: Demo story
status: backlog
blocked: false
type: feature
priority: P1
size: S
blocked-by: []
touches: [src/demo.js]
spec-ref: .sdd/specs/spec-01.md
started: ""
${extra}---

${body}
`;

const esBody = `Como usuario, quiero hacer X, para lograr Y.

## Criterios de aceptación

- **Dado** una sesión válida **Cuando** hago X **Entonces** veo Y (test: tests/demo.test.js)

## Fuera de alcance
- detalle menor 1
- detalle menor 2
- detalle menor 3`;

const enBody = `As a user, I want to do X, so that Y.

## Acceptance Criteria

- **Given** a valid session **When** I do X **Then** I see Y (test: tests/demo.test.js)

## Out of scope
- minor detail 1
- minor detail 2`;

test('ES feature with out-of-scope section is valid (AC truncation regression)', () => {
  const root = fixture({ 'S001-demo.md': featureStory('S001', esBody) });
  const result = validateState(root);
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
});

test('EN feature with out-of-scope section is valid (EN heading regression)', () => {
  const root = fixture({ 'S001-demo.md': featureStory('S001', enBody) });
  const result = validateState(root);
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
});

test('AC scenario without test/manual ref fails', () => {
  const body = `As a user, I want to do X, so that Y.

## Acceptance Criteria

- **Given** a valid session **When** I do X **Then** I see Y`;
  const root = fixture({ 'S001-demo.md': featureStory('S001', body) });
  const result = validateState(root);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.code === 'ac-test-ref'));
});

test('more than 5 AC scenarios fails with ac-count', () => {
  const scenarios = Array.from({ length: 6 }, (_, i) =>
    `- **Dado** a **Cuando** b **Entonces** c${i} (test: tests/t${i}.test.js)`).join('\n');
  const body = `Como usuario, quiero hacer X, para lograr Y.

## Criterios de aceptación

${scenarios}`;
  const root = fixture({ 'S001-demo.md': featureStory('S001', body) });
  const result = validateState(root);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.code === 'ac-count'));
});

test('blocked-by cycle is detected', () => {
  const root = fixture({
    'S001-demo.md': featureStory('S001', esBody).replace('blocked-by: []', 'blocked-by: [S002]'),
    'S002-demo.md': featureStory('S002', esBody).replace('blocked-by: []', 'blocked-by: [S001]'),
  });
  const result = validateState(root);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.code === 'cycle'));
});

test('frontmatter with inline comments and quoted values passes (documented template regression)', () => {
  const story = `---
id: S001
title: Demo: login              # with colon
status: ready                   # backlog|ready|in-progress|review|done
blocked: false
type: feature                   # feature|chore|refactor|spike
priority: P1                    # P0..P3
size: M                         # S|M|L
blocked-by: []                  # may be empty
touches: [src/demo.js]
spec-ref: .sdd/specs/spec-01.md
started: ""                     # ISO timestamp once in-progress
---

Como usuario, quiero hacer X, para lograr Y.

## Criterios de aceptación

- **Dado** a **Cuando** b **Entonces** c (test: tests/demo.test.js)
`;
  const root = fixture({ 'S001-demo.md': story });
  const result = validateState(root);
  assert.deepEqual(result.errors, []);
});

test('config.yml with inline comments and quoted values passes', () => {
  const root = fixture({ 'S001-demo.md': featureStory('S001', esBody) });
  writeFileSync(join(root, '.sdd', 'config.yml'),
    'schema_version: 1   # version\nlanguage: "es"        # es | en\nmax_concurrency: 3    # 1..3\nbranch_prefix: "sdd/"\n');
  const result = validateState(root);
  assert.deepEqual(result.errors, []);
});

test('second AC heading cannot hide unchecked scenarios', () => {
  const body = `Como usuario, quiero hacer X, para lograr Y.

## Criterios de aceptación

- **Dado** a **Cuando** b **Entonces** c (test: tests/a.test.js)

## Criterios de aceptación (detalle)

- **Dado** x **Cuando** y **Entonces** z
`;
  const root = fixture({ 'S001-demo.md': featureStory('S001', body) });
  const result = validateState(root);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.code === 'ac-test-ref'));
});

test('all current* sprint files are checked', () => {
  const root = fixture({ 'S001-demo.md': featureStory('S001', esBody) });
  writeFileSync(join(root, '.sdd', 'sprints', 'current.md'), '# Sprint\n- S001\n');
  writeFileSync(join(root, '.sdd', 'sprints', 'current-alt.md'), '# Sprint alt\n- S999\n');
  const result = validateState(root);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.code === 'sprint-ref' && e.msg.includes('current-alt.md')));
});

test('blocked without blocked-why is an error', () => {
  const root = fixture({
    'S001-demo.md': featureStory('S001', esBody, 'blocked: true\n'),
  });
  const result = validateState(root);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.code === 'blocked-why-missing'));
});

test('blank blocked-by is accepted as empty', () => {
  const root = fixture({
    'S001-demo.md': featureStory('S001', esBody).replace('blocked-by: []', 'blocked-by:'),
  });
  const result = validateState(root);
  assert.equal(result.ok, true);
});

test('in-progress without started is an error', () => {
  const root = fixture({
    'S001-demo.md': featureStory('S001', esBody).replace('status: backlog', 'status: in-progress'),
  });
  const result = validateState(root);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.code === 'started-missing'));
});

test('duplicate frontmatter keys are reported', () => {
  const root = fixture({
    'S001-demo.md': featureStory('S001', esBody).replace('status: backlog', 'status: done\nstatus: backlog'),
  });
  const result = validateState(root);
  assert.ok(result.errors.some((e) => e.code === 'dup-key'));
});

test('dangling spec-ref is reported', () => {
  const root = fixture({
    'S001-demo.md': featureStory('S001', esBody).replace('.sdd/specs/spec-01.md', '.sdd/specs/gone.md'),
  });
  const result = validateState(root);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.code === 'spec-ref-missing'));
});

test('a directory in stories/ yields a structured error, not a crash', () => {
  const root = fixture({ 'S001-demo.md': featureStory('S001', esBody) });
  mkdirSync(join(root, '.sdd', 'stories', 'S002-notes.md'));
  const result = validateState(root);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.code === 'story-unreadable'));
});

test('CLI validates correctly from a path containing spaces', () => {
  const base = mkdtempSync(join(tmpdir(), 'sdd with spaces '));
  const root = fixture({ 'S001-demo.md': featureStory('S001', esBody) });
  cpSync(root, join(base, 'proj'), { recursive: true });
  const res = spawnSync(process.execPath, [VALIDATOR, join(base, 'proj')], { encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stderr, /estado ok/);
});

test('validator messages follow config.language', () => {
  const body = `As a user, I want X, so that Y.

## Acceptance Criteria

- **Given** a **When** b **Then** c`;
  const root = fixture({ 'S001-demo.md': featureStory('S001', body) });
  const es = validateState(root);
  assert.ok(es.errors.some((e) => e.code === 'ac-test-ref' && e.msg.includes('escenario de AC sin')));
  assert.equal(es.lang, 'es');
  writeFileSync(join(root, '.sdd', 'config.yml'),
    'schema_version: 1\nlanguage: en\nmax_concurrency: 3\nbranch_prefix: "sdd/"\n');
  const en = validateState(root);
  assert.ok(en.errors.some((e) => e.code === 'ac-test-ref' && e.msg.includes('AC scenario without')));
  assert.equal(en.lang, 'en');
});

test('documented template with wrapped (test:) continuation line passes', () => {
  const body = `Como usuario, quiero hacer X, para lograr Y.

## Criterios de aceptación

- **Dado** <situación> **Cuando** <la acción> **Entonces** <resultado observable>
  (test: <path-to-test>|<name>)
- **Dado** ... **Entonces** ... (manual: <pasos/evidencia>)

## Fuera de alcance
- ...
`;
  const root = fixture({ 'S001-demo.md': featureStory('S001', body) });
  const result = validateState(root);
  assert.deepEqual(result.errors, []);
});

test('split stub (parent of another story) is exempt from body-shape checks', () => {
  const stub = featureStory('S001', 'Dividido en S002 y S003.');
  const child = featureStory('S002', esBody).replace('spec-ref: .sdd/specs/spec-01.md', 'parent: S001');
  const root = fixture({ 'S001-demo.md': stub, 'S002-child.md': child });
  const result = validateState(root);
  assert.deepEqual(result.errors, []);
});

test('sprint dep-order violation is reported', () => {
  const a = featureStory('S001', esBody);
  const b = featureStory('S002', esBody).replace('blocked-by: []', 'blocked-by: [S001]');
  const root = fixture({ 'S001-demo.md': a, 'S002-other.md': b });
  writeFileSync(join(root, '.sdd', 'sprints', 'current.md'),
    '# Sprint\n## Gates\n- plan: ok\n\n1. S002\n2. S001\n');
  const result = validateState(root);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.code === 'sprint-dep-order'));
});

test('sprint dep-order passes when dep is done or ordered earlier', () => {
  const a = featureStory('S001', esBody).replace('status: backlog', 'status: done');
  const b = featureStory('S002', esBody).replace('blocked-by: []', 'blocked-by: [S001]');
  const root = fixture({ 'S001-demo.md': a, 'S002-other.md': b });
  writeFileSync(join(root, '.sdd', 'sprints', 'current.md'),
    '# Sprint\n## Gates\n- plan: ok\n\n1. S001\n2. S002\n');
  const result = validateState(root);
  assert.deepEqual(result.errors, []);
});

test('Solución propuesta alone does not satisfy the verification checklist', () => {
  const body = `## Problema técnico
Algo falla.

## Solución propuesta
- cambiar el orden

`;
  const story = featureStory('S001', body).replace('type: feature', 'type: chore');
  const root = fixture({ 'S001-demo.md': story });
  const result = validateState(root);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.code === 'tech-shape'));
});

test('started set on a done story does not warn', () => {
  const root = fixture({
    'S001-demo.md': featureStory('S001', esBody, '')
      .replace('status: backlog', 'status: done')
      .replace('started: ""', 'started: 2026-10-31T10:00:00Z'),
  });
  const result = validateState(root);
  assert.equal(result.ok, true);
  assert.equal(result.warn.filter((w) => w.includes('started')).length, 0);
});

test('lowercase story id in the sprint is flagged, not ignored', () => {
  const root = fixture({ 'S001-demo.md': featureStory('S001', esBody) });
  writeFileSync(join(root, '.sdd', 'sprints', 'current.md'),
    '# Sprint\n## Gates\n- plan: ok\n\n1. s001\n');
  const result = validateState(root);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.code === 'sprint-ref' && e.msg.includes('s001')));
});

test('shipped worked example validates clean', () => {
  const result = validateState(fileURLToPath(new URL('references/example', import.meta.url)));
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
});
