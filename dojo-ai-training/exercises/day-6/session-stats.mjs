#!/usr/bin/env node
// Token and effort stats per Claude Code session, read from the local transcripts
// in ~/.claude/projects/. Used for the ultrathink / effort comparison exercise.
//
//   node session-stats.mjs                    list the 10 latest sessions of this repo
//   node session-stats.mjs --last 20          list the 20 latest
//   node session-stats.mjs low=1a2b medium=3c4d ultra=5e6f
//                                             compare sessions (id or id prefix), as a markdown table
//
// Token totals include the session's subagents. Output includes thinking tokens.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const PROJECTS_DIR = join(homedir(), '.claude', 'projects');

// Claude Code names each project folder after its cwd, with every non-alphanumeric char as '-'.
// Sessions started in a subfolder (e.g. task-tracker/) get their own folder with a longer name.
function projectDirs() {
  const prefix = REPO_ROOT.replace(/[^a-zA-Z0-9]/g, '-');
  return readdirSync(PROJECTS_DIR)
    .filter((name) => name === prefix || name.startsWith(`${prefix}-`))
    .map((name) => join(PROJECTS_DIR, name));
}

function sessionFiles() {
  return projectDirs()
    .flatMap((dir) => readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => join(dir, f)))
    .map((file) => ({ file, mtime: statSync(file).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .map(({ file }) => file);
}

function readJsonl(file) {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

// The text the user typed. IDE context (<ide_selection>, <ide_opened_file>, ...) and slash
// commands come as separate blocks that start with '<', so they are skipped.
function userText(entry) {
  const content = entry.message?.content;
  const blocks = typeof content === 'string' ? [content] : Array.isArray(content) ? content : [];
  return blocks
    .map((block) => (typeof block === 'string' ? block : block.type === 'text' ? block.text : ''))
    .filter((text) => text && !text.trimStart().startsWith('<'))
    .join('\n');
}

// One assistant message is written as several lines (one per content block) that repeat the same usage.
function tokenStats(entries) {
  const messages = new Map();
  const toolIds = new Set();
  for (const entry of entries) {
    if (entry.type !== 'assistant' || !entry.message?.usage) continue;
    messages.set(entry.message.id, entry.message.usage);
    for (const block of entry.message.content ?? []) {
      if (block.type === 'tool_use') toolIds.add(block.id);
    }
  }
  const usages = [...messages.values()];
  const sum = (pick) => usages.reduce((total, u) => total + (pick(u) ?? 0), 0);
  return {
    requests: usages.length,
    toolCalls: toolIds.size,
    input: sum((u) => u.input_tokens),
    cacheWrite: sum((u) => u.cache_creation_input_tokens),
    cacheRead: sum((u) => u.cache_read_input_tokens),
    output: sum((u) => u.output_tokens),
    thinking: sum((u) => u.output_tokens_details?.thinking_tokens),
  };
}

function addStats(a, b) {
  return Object.fromEntries(Object.keys(a).map((key) => [key, a[key] + b[key]]));
}

function analyze(file) {
  const entries = readJsonl(file);
  const id = basename(file, '.jsonl');

  const subagentDir = join(dirname(file), id, 'subagents');
  const subagentFiles = existsSync(subagentDir)
    ? readdirSync(subagentDir).filter((f) => f.endsWith('.jsonl'))
    : [];
  const transcriptStats = subagentFiles
    .map((f) => tokenStats(readJsonl(join(subagentDir, f))))
    .reduce(addStats, tokenStats(entries));

  // Claude Code saves its own totals (all models, subagents included) when a session ends.
  // Prefer them: subagent transcripts often log usage before the reply finishes streaming.
  const costState = entries.findLast((e) => e.type === 'cost-state');
  const finalUsage = Object.values(costState?.modelUsage ?? {});
  const sumFinal = (key) => finalUsage.reduce((total, u) => total + (u[key] ?? 0), 0);
  const stats = costState
    ? {
        ...transcriptStats,
        input: sumFinal('inputTokens'),
        cacheWrite: sumFinal('cacheCreationInputTokens'),
        cacheRead: sumFinal('cacheReadInputTokens'),
        output: sumFinal('outputTokens'),
        thinking: sumFinal('thinkingTokens'),
      }
    : transcriptStats;

  // The effort actually sent to the API, per request. ultrathink does not change it.
  const efforts = [];
  const models = new Set();
  for (const entry of entries) {
    if (entry.type !== 'api-request') continue;
    const effort = entry.params?.output_config?.effort ?? 'none';
    if (efforts.at(-1) !== effort) efforts.push(effort);
    if (entry.params?.model) models.add(entry.params.model);
  }

  const prompts = entries
    .filter((e) => e.type === 'user' && !e.isMeta)
    .map(userText)
    .filter(Boolean);
  const timestamps = entries.map((e) => e.timestamp).filter(Boolean).sort();
  const title = entries.findLast((e) => e.type === 'ai-title')?.aiTitle ?? prompts[0] ?? '';

  return {
    id,
    started: timestamps[0] ?? '',
    source: costState ? 'final' : 'transcript',
    wallMinutes: timestamps.length ? (Date.parse(timestamps.at(-1)) - Date.parse(timestamps[0])) / 60000 : 0,
    apiMinutes: costState ? costState.totalAPIDuration / 60000 : undefined,
    title: title.replace(/\s+/g, ' ').slice(0, 50),
    model: [...models].join(', ') || '?',
    effort: efforts.join(' → ') || '?',
    ultrathinkPrompts: prompts.filter((text) => /\bultrathink\b/i.test(text)).length,
    subagents: subagentFiles.length,
    costUsd: costState?.totalCostUSD,
    ...stats,
    // Input-token equivalents at Anthropic's relative prices (same formula as the day 5 exercise).
    costUnits: stats.input + 1.25 * stats.cacheWrite + 0.1 * stats.cacheRead + 5 * stats.output,
  };
}

const num = (n) => Math.round(n).toLocaleString('en-US');
const localTime = (iso) => (iso ? new Date(iso).toLocaleString('sv-SE').slice(0, 16) : '');

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `|${headers.map(() => '---').join('|')}|`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

function listSessions(limit) {
  const rows = sessionFiles()
    .slice(0, limit)
    .map(analyze)
    .map((s) => [s.id.slice(0, 8), localTime(s.started), s.effort, s.ultrathinkPrompts ? 'yes' : '', num(s.output), s.title]);
  console.log(table(['Session', 'Started', 'Effort', 'ultrathink', 'Output', 'Title'], rows));
}

function compareSessions(args) {
  const files = sessionFiles();
  const rows = args.map((arg) => {
    const [label, prefix] = arg.includes('=') ? arg.split('=') : [arg.slice(0, 8), arg];
    const matches = files.filter((file) => basename(file).startsWith(prefix));
    if (matches.length !== 1) {
      console.error(`${prefix}: ${matches.length ? 'matches several sessions, use a longer prefix' : 'no such session'}`);
      process.exit(1);
    }
    const s = analyze(matches[0]);
    return [
      label,
      s.id.slice(0, 8),
      s.model,
      s.effort,
      s.ultrathinkPrompts ? `yes (${s.ultrathinkPrompts})` : 'no',
      s.requests,
      s.toolCalls,
      s.subagents,
      s.apiMinutes === undefined ? '—' : s.apiMinutes.toFixed(1),
      s.wallMinutes.toFixed(1),
      num(s.thinking),
      num(s.output),
      num(s.input),
      num(s.cacheWrite),
      num(s.cacheRead),
      num(s.costUnits),
      s.costUsd === undefined ? '—' : `$${s.costUsd.toFixed(2)}`,
      s.source,
    ];
  });
  console.log(
    table(
      ['Run', 'Session', 'Model', 'Effort', 'ultrathink', 'Requests', 'Tool calls', 'Subagents', 'API min', 'Wall min',
        'Thinking', 'Output', 'Input', 'Cache write', 'Cache read', 'Cost units', 'Cost (est.)', 'Source'],
      rows,
    ),
  );
  console.log('\nTokens include subagents. Output includes thinking. Cost units = input + 1.25×cache write + 0.1×cache read + 5×output.');
  console.log('Source "final" = totals Claude Code saved when the session ended (with Cost and API min).');
  console.log('Source "transcript" = session still open: summed from the transcript, subagent output may be undercounted.');
}

const args = process.argv.slice(2);
if (args[0] === '--last') {
  listSessions(Number(args[1]) || 10);
} else if (args.length === 0) {
  listSessions(10);
} else {
  compareSessions(args);
}
