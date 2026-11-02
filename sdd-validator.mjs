#!/usr/bin/env node
// sdd state validator — mechanical enforcement of the .sdd/ state contract.
// Usage: node validate-sdd-state.mjs <project-root> [--quiet]
// Exit 0 = valid state. Exit 1 = violations (or absent/broken .sdd).
// Also exported as validateState(dir) for tests.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const STATUSES = ['backlog', 'ready', 'in-progress', 'blocked', 'in-review', 'done', 'cancelled'];
const SPRINT_STATUSES = ['planned', 'in-progress', 'done', 'cancelled', 'blocked'];
const TYPES = ['feature', 'chore', 'refactor', 'spike'];
const PRIOS = ['P0', 'P1', 'P2', 'P3'];
const SIZES = ['S', 'M', 'L'];
const STORY_FILE = /^[AS](\d{3})-[a-z0-9-]+\((backlog|ready|in-progress|blocked|in-review|done|cancelled)\)\.md$/;

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
    let val = mm[2].trim().replace(/\s+#.*$/, '');
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (lastKey in fm) fm.__duplicate = [...(fm.__duplicate ?? []), lastKey];
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
  techVerify: [/##\s*Criterios de verificación/i, /##\s*Verification criteria/i],
};
const matchAny = (reList, s) => reList.some((re) => re.test(s));

export function validateState(root) {
  const errors = [];
  const warn = [];
  let lang = 'es';
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
      if (mm) vals[mm[1]] = mm[2].trim().replace(/\s+#.*$/, '').replace(/^(['"])(.*)\1$/, '$2');
    }
    if (['es', 'en'].includes(vals.language)) lang = vals.language;
    if (!(Number(vals.schema_version) > 0)) err('config-version', 'schema_version missing/invalid');
    if (!['es', 'en'].includes(vals.language)) err('config-language', 'language must be es|en');
    const mc = Number(vals.max_concurrency);
    if (!(mc >= 1 && mc <= 3)) err('config-concurrency', 'max_concurrency must be 1..3');
    if (!vals.branch_prefix) err('config-prefix', 'branch_prefix missing');
  }

  // ---- quick micro-stories (.sdd/quick/) ----
  const quickDir = join(sdd, 'quick');
  const hasQuickDir = existsSync(quickDir);
  const qFiles = hasQuickDir ? readdirSync(quickDir).filter((f) => f.endsWith('.md')) : [];
  const QUICK_FILE = /^Q(\d{3,})-[a-z0-9-]+\.md$/;
  for (const qf of qFiles) {
    const qPath = join(quickDir, qf);
    const qText = readFileSync(qPath, 'utf8');
    const { fm } = parseFrontmatter(qText);
    const qBase = `${qf}: `;
    if (!QUICK_FILE.test(qf)) err('quick-filename', `${qBase}filename must be Q###-slug.md`, qf);
    if (!fm || 'malformed' === fm.__parse) { err('quick-frontmatter', `${qBase}malformed frontmatter`, qf); continue; }
    for (const k of ['id', 'title', 'status', 'touches']) {
      const val = fm[k];
      const isList = k === 'touches';
      const absent = !(k in fm) || val === '' || (isList ? parseList(val).length === 0 : (Array.isArray(val) && val.length === 0));
      if (absent) err('quick-missing-field', `${qBase}${k} missing`, qf);
    }
    if (fm.id && !/^Q\d{3,}$/.test(fm.id)) err('quick-id-format', `${qBase}id "${fm.id}" is not Q###`, qf);
    if (fm.status && !['in-progress', 'done'].includes(fm.status)) {
      err('quick-status', `${qBase}bad quick status "${fm.status}" (must be in-progress|done)`, qf);
    }
  }

  // ---- stories ----
  const storiesDir = join(sdd, 'stories');
  if (!existsSync(storiesDir)) {
    if (qFiles.length === 0) {
      err('stories-missing', '.sdd/stories/ not found');
      return { ok: false, warn, errors };
    }
    return { ok: errors.length === 0, warn, errors };
  }
  const files = readdirSync(storiesDir).filter((f) => f.endsWith('.md'));
  if (files.length === 0 && qFiles.length === 0) {
    err('stories-empty', 'no stories yet (a project starts with at least one story)');
  }

  const stories = new Map();
  for (const f of files) {
    const path = join(storiesDir, f);
    if (!statSync(path).isFile()) { err('story-unreadable', `${f}: expected a story file`, f); continue; }
    const text = readFileSync(path, 'utf8');
    const { fm, frontRaw, body } = parseFrontmatter(text);
    const base = `${f}: `;

    const storyFilename = STORY_FILE.exec(f);
    if (!storyFilename) err('filename', `${base}filename must be S###-slug(status).md`, f);
    if (!fm || 'malformed' === fm.__parse) { err('frontmatter', `${base}malformed frontmatter`, f); continue; }
    for (const key of fm.__duplicate ?? []) err('dup-key', `${base}duplicate frontmatter key ${key}`, f);

    const req = ['id', 'title', 'status', 'type', 'priority', 'size', 'blocked-by', 'touches'];
    for (const k of req) {
      const absent = !(k in fm) || (fm[k] === '' && k !== 'blocked-by') || (Array.isArray(fm[k]) && fm[k].length === 0);
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
    if (storyFilename && fm.status && storyFilename[2] !== fm.status) err('filename-status', `${base}filename status does not match frontmatter`, f);
    if (fm.type && !TYPES.includes(fm.type)) err('type', `${base}bad type "${fm.type}"`, f);
    if (fm.priority && !PRIOS.includes(fm.priority)) err('priority', `${base}bad priority "${fm.priority}"`, f);
    if (fm.size && !SIZES.includes(fm.size)) err('size', `${base}bad size "${fm.size}"`, f);
    if (fm.status === 'in-progress' && (!fm.started || fm.started === '""')) err('started-missing', `${base}in-progress story needs started`, f);
    if (fm.status === 'blocked' && !fm['blocked-why']) err('blocked-why-missing', `${base}blocked story needs blocked-why`, f);
    if (fm['spec-ref'] && !existsSync(join(root, fm['spec-ref'].split('#')[0]))) err('spec-ref-missing', `${base}spec-ref does not exist`, f);

    // ---- no AC without a test (mechanical) ----
    if (fm.type === 'feature' && !files.some((child) => {
      if (!statSync(join(storiesDir, child)).isFile()) return false;
      const childText = readFileSync(join(storiesDir, child), 'utf8');
      return new RegExp(`^parent:\\s*${id}\\s*$`, 'm').test(childText);
    })) {
      if (!matchAny(PATTERNS.storyShape, body) || !matchAny(PATTERNS.forBenefit, body)) {
        err('story-shape', `${base}feature body must contain "Como X quiero Y para Z" (es) or "As a X, I want Y, so that Z" (en)`, f);
      }
      const acSections = [...body.matchAll(/^##\s*(?:Criterios de aceptación|Acceptance Criteria)[^\n]*\r?\n([\s\S]*?)(?=^##\s+|(?![\s\S]))/gim)].map((m) => m[1]);
      if (acSections.length === 0) {
        err('ac-missing', `${base}feature body needs "## Criterios de aceptación" (es) or "## Acceptance Criteria" (en)`, f);
      } else {
        const scenarios = acSections.flatMap((section) => section.split(/\r?\n/).reduce((items, line) => {
          if (/^\s*-\s+/.test(line)) items.push(line);
          else if (/^\s+\((test|manual):/i.test(line) && items.length) items[items.length - 1] += ` ${line.trim()}`;
          return items;
        }, []));
        if (scenarios.length === 0) err('ac-empty', `${base}AC section has no scenarios`, f);
        for (let i = 0; i < scenarios.length; i++) {
          const sc = scenarios[i];
          if (!/\((test|manual):\s*[^)]+\)/i.test(sc)) {
            err('ac-test-ref', `${base}${lang === 'es' ? 'escenario de AC sin' : 'AC scenario without'} "(test: ...)" or "(manual: ...)": ${sc.trim().slice(0, 60)}…`, f);
          }
        }
        if (scenarios.length > 5) {
          err('ac-count', `${base}$ more than 5 scenarios → split the story`, f);
        }
      }
    } else if (fm.type !== 'feature') {
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
    const sprintFiles = readdirSync(sprintDir).filter((f) => f.endsWith('.md'));
    for (const sprintFile of sprintFiles) {
      const sprintName = /^(S\d{2,})-[a-z0-9-]+\((planned|in-progress|done|cancelled|blocked)\)\.md$/.exec(sprintFile);
      if (!sprintName) err('sprint-filename', `${sprintFile}: filename must be S##-slug(status).md`, sprintFile);
      const txt = readFileSync(join(sprintDir, sprintFile), 'utf8');
      const idsInSprint = [...txt.matchAll(/\b[Ss]\d{3,}\b/g)].map((m) => m[0]);
      for (const sid of new Set(idsInSprint)) if (!stories.has(sid)) err('sprint-ref', `${sprintFile} lists ${sid} which does not exist`);
      const ordered = [...txt.matchAll(/^\s*\d+\.\s+(S\d{3,})\s*$/gm)].map((m) => m[1]);
      for (let i = 0; i < ordered.length; i++) {
        const deps = parseList(stories.get(ordered[i])?.fm['blocked-by']);
        if (deps.some((dep) => ordered.indexOf(dep) > i)) err('sprint-dep-order', `${sprintFile} places ${ordered[i]} before its dependency`);
      }
    }
  }

  return { ok: errors.length === 0, warn, errors, lang };
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
