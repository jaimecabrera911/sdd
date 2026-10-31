#!/usr/bin/env node
// sdd state validator — mechanical enforcement of the .sdd/ state contract.
// Usage: node validate-sdd-state.mjs <project-root> [--quiet]
// Exit 0 = valid state. Exit 1 = violations (or absent/broken .sdd).
// Also exported as validateState(dir) for tests.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const STATUSES = ['backlog', 'ready', 'in-progress', 'review', 'done'];
const TYPES = ['feature', 'chore', 'refactor', 'spike'];
const PRIOS = ['P0', 'P1', 'P2', 'P3'];
const SIZES = ['S', 'M', 'L'];
const STORY_FILE = /^[AS](\d{3})-[a-z0-9-]+\.md$/;

function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return { fm: null, body: text, frontRaw: null };
  const fm = {};
  let lastKey = null;
  let multiline = false;
  for (const raw of m[1].split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (/^- /.test(line) && lastKey) {
      // multiline YAML list continuation: touches:\n  - a\n  - b
      const item = line.slice(2).trim();
      if (!Array.isArray(fm[lastKey])) fm[lastKey] = [];
      fm[lastKey].push(item);
      continue;
    }
    const mm = /^([a-zA-Z][a-zA-Z0-9_-]*):\s*(.*)$/.exec(line);
    if (!mm) { multiline = true; if (lastKey) { multiline = false; } continue; }
    lastKey = mm[1];
    multiline = false;
    const val = mm[2].trim();
    fm[lastKey] = val === '' && Array.isArray(fm[lastKey]) ? fm[lastKey] : val;
  }
  if (multiline) fm.__parse = 'malformed';
  return { fm, body: text.slice(m[0].length), frontRaw: m[1] };
}

function parseList(v) {
  if (Array.isArray(v)) return v;
  if (!v || v === '[]' || v === '""' || v === "''") return [];
  const inner = /^\[(.*)\]$/.exec(v);
  if (!inner) return [v.trim()];
  return inner[1].split(',').map((s) => s.trim()).filter(Boolean);
}

// Bilingual story-contract patterns (es|en). A story in EITHER valid language passes — the
// validator judges the contract, not the project language config.
const PATTERNS = {
  storyShape: [/Como\s.+?,\s*quiero\s+/i, /As\s+(a|an)\s.+,\s*I\s+want/i],
  forBenefit: [/para\s+/i, /so\s+that\s+/i],
  acHeading: [/##\s*Criterios de aceptación/i, /##\s*Acceptance Criteria/i],
  techProblem: [/##\s*(Problema técnico|Problema)/i, /##\s*(Technical problem|Problem)/i],
  techVerify: [/##\s*(Criterios de verificación|Solución propuesta)/i, /##\s*(Verification criteria|Proposed solution|Acceptance)/i],
};
const matchAny = (reList, s) => reList.some((re) => re.test(s));

export function validateState(root) {
  const errors = [];
  const warn = [];
  const err = (code, msg, file = '') => errors.push({ code, msg, file: file ? `${file}` : '' , detail: msg });

  const sdd = join(root, '.sdd');
  if (!existsSync(sdd)) return { ok: false, warn, errors: [{ code: 'no-state', msg: '.sdd/ not found' }] };

  // ---- config.yml ----
  const cfgPath = join(sdd, 'config.yml');
  if (!existsSync(cfgPath)) {
    err('config-missing', '.sdd/config.yml not found');
  } else {
    const cfg = parseFrontmatter(readFileSync(cfgPath, 'utf8'));
    const parsed = cfg.body.trim() + '\n';
    const vals = {};
    for (const line of parsed.split(/\r?\n/)) {
      const mm = /^([a-zA-Z_]+):\s*(.*)$/.exec(line);
      if (mm) vals[mm[1]] = mm[2].trim();
    }
    if (!(Number(vals.schema_version) > 0)) err('config-version', 'schema_version missing/invalid');
    if (!['es', 'en'].includes(vals.language)) err('config-language', 'language must be es|en');
    const mc = Number(vals.max_concurrency);
    if (!(mc >= 1 && mc <= 3)) err('config-concurrency', 'max_concurrency must be 1..3');
    if (!vals.branch_prefix) err('config-prefix', 'branch_prefix missing');
  }

  // ---- stories ----
  const storiesDir = join(sdd, 'stories');
  if (!existsSync(storiesDir)) { err('stories-missing', '.sdd/stories/ not found'); return { ok: false, warn, errors }; }
  const files = readdirSync(storiesDir).filter((f) => f.endsWith('.md'));
  if (files.length === 0) { err('stories-empty', 'no stories yet (a project starts with at least one story)'); }

  const stories = new Map();
  for (const f of files) {
    const path = join(storiesDir, f);
    const text = readFileSync(path, 'utf8');
    const { fm, frontRaw, body } = parseFrontmatter(text);
    const base = `${f}: `;

    if (!STORY_FILE.test(f)) err('filename', `${base}filename must be S###-slug.md`, f);
    if (!fm || 'malformed' === fm.__parse) { err('frontmatter', `${base}malformed frontmatter`, f); continue; }

    const req = ['id', 'title', 'status', 'type', 'priority', 'size', 'blocked-by', 'touches'];
    for (const k of req) {
      const absent = !(k in fm) || fm[k] === '' || (Array.isArray(fm[k]) && fm[k].length === 0);
      if (absent) err('missing-field', `${base}${k} missing`, f);
    }

    const id = fm.id;
    if (!id) { err('missing-field', `${base}id missing`, f); continue; }
    const num = /S(\d{3,})$/.exec(id);
    if (!num) err('id-format', `${base}id "${id}" is not S###`, f);
    else if (f.startsWith('S') && !f.startsWith(`${id}-`)) err('id-filename', `${base}id does not match filename`, f);
    if (stories.has(id)) err('dup-id', `${base}duplicate id ${id}`, f);
    stories.set(id, { fm, body, file: f });

    if (fm.status && !STATUSES.includes(fm.status)) err('status', `${base}bad status "${fm.status}"`, f);
    if (fm.type && !TYPES.includes(fm.type)) err('type', `${base}bad type "${fm.type}"`, f);
    if (fm.priority && !PRIOS.includes(fm.priority)) err('priority', `${base}bad priority "${fm.priority}"`, f);
    if (fm.size && !SIZES.includes(fm.size)) err('size', `${base}bad size "${fm.size}"`, f);
    if ('started' in fm && fm.status !== 'in-progress' && fm.started && fm.started !== '""') {
      warn.push(`${base}started set while status=${fm.status} (orphan check will catch it at build)`);
    }
    if ('blocked' in fm) {
      if (!['true', 'false'].includes(fm.blocked)) err('blocked-flag', `${base}blocked must be true|false`, f);
      if (fm.blocked === 'true') {
        if (!fm['blocked-why']) warn.push(`${base}blocked without blocked-why`);
        if (fm.status === 'done') warn.push(`${base}blocked and done is contradictory`);
      }
    }

    // ---- no AC without a test (mechanical) ----
    if (fm.type === 'feature') {
      if (!matchAny(PATTERNS.storyShape, body) || !matchAny(PATTERNS.forBenefit, body)) {
        err('story-shape', `${base}feature body must contain "Como X quiero Y para Z" (es) or "As a X, I want Y, so that Z" (en)`, f);
      }
      const acMatch = /##\s*(?:Criterios de aceptación|Acceptance Criteria)[^\n]*\r?\n([\s\S]*?)(?=\r?\n##\s+|$)/i.exec(body);
      if (!acMatch) {
        err('ac-missing', `${base}feature body needs "## Criterios de aceptación" (es) or "## Acceptance Criteria" (en)`, f);
      } else {
        const acSection = acMatch[1];
        const scenarios = acSection.split(/\r?\n/).filter((l) => /^\s*-\s+/.test(l));
        if (scenarios.length === 0) err('ac-empty', `${base}AC section has no scenarios`, f);
        for (const sc of scenarios) {
          if (!/\((test|manual):\s*[^)]+\)/i.test(sc)) {
            err('ac-test-ref', `${base}AC scenario without "(test: ...)" or "(manual: ...)": ${sc.trim().slice(0, 60)}…`, f);
          }
        }
        if (scenarios.length > 5) {
          err('ac-count', `${base}$ more than 5 scenarios → split the story`, f);
        }
      }
    } else {
      if (!matchAny(PATTERNS.techProblem, body)) err('tech-shape', `${base}${fm.type} needs "## Problema técnico" (es) or "## Technical problem" (en)`, f);
      if (!matchAny(PATTERNS.techVerify, body)) {
        err('tech-shape', `${base}${fm.type} needs "## Criterios de verificación" (es) or a verification heading (en)`, f);
      }
    }
  }

  // ---- graph: blocked-by + parent, exists & acyclic ----
  for (const [id, s] of stories) {
    for (const dep of parseList(s.fm['blocked-by'])) {
      if (!stories.has(dep)) err('dep-missing', `${s.file}: blocked-by ${dep} does not exist`);
    }
    const parent = s.fm.parent;
    if (parent && parent !== '""' && !stories.has(parent)) err('parent-missing', `${s.file}: parent ${parent} does not exist`);
  }
  const edges = (id) => [
    ...parseList(stories.get(id).fm['blocked-by']),
    ...[stories.get(id).fm.parent].filter((p) => p && p !== '""'),
  ].filter((d) => stories.has(d));
  const color = new Map();
  const dfs = (n) => {
    color.set(n, 1);
    for (const m of edges(n)) {
      if (color.get(m) === 1) { err('cycle', `dependency cycle through ${n} -> ${m}`); return; }
      if (!color.get(m)) dfs(m);
    }
    color.set(n, 2);
  };
  for (const id of stories.keys()) if (!color.get(id)) dfs(id);

  // ---- sprint file ----
  const sprintDir = join(sdd, 'sprints');
  if (existsSync(sprintDir)) {
    const cur = readdirSync(sprintDir).find((f) => f.startsWith('current'));
    if (cur) {
      const txt = readFileSync(join(sprintDir, cur), 'utf8');
      const idsInSprint = [...txt.matchAll(/\bS\d{3,}\b/g)].map((m) => m[0]);
      for (const sid of new Set(idsInSprint)) if (!stories.has(sid)) err('sprint-ref', `sprint lists ${sid} which does not exist`);
    }
  }

  return { ok: errors.length === 0, warn, errors };
}

function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const root = args[0] || process.cwd();
  const result = validateState(root);
  for (const w of result.warn) console.error(`WARN  ${w}`);
  for (const e of result.errors) console.error(`FAIL  [${e.code}] ${e.msg}`);
  if (result.ok) {
    console.error(`state ok: ${join(root, '.sdd')}`);
    process.exit(0);
  }
  console.error(`FAILED: ${result.errors.length} violation(s)`);
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
