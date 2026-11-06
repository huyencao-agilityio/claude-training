#!/usr/bin/env node
// Builds the release notes for one release tag, written for clients: what is new, fixed and better, per ticket.
//
// 1. Finds the previous release tag with git (or takes PREVIOUS_TAG) and lists the commits between the two tags.
// 2. Asks the GitHub GraphQL API which merged pull requests those commits belong to. A PR counts when its merge
//    commit is in the range, so PRs merged before the previous tag are left out and each PR is kept once.
// 3. Finds each PR's tickets:
//    - TICKET_PATTERN set (Jira, Trello, Linear, ...): ticket IDs matched in the PR title, branch name and description,
//      linked with TICKET_URL.
//    - TICKET_PATTERN not set: the GitHub issues the PR closes ("Closes #12") or mentions ("Refs #12").
// 4. Sorts each ticket into New Features / Bug Fixes / Improvements by labels, then by the PR title or branch prefix
//    (feat, fix, perf). Technical PRs (chore, ci, test, refactor, docs, dependencies) are left out of the notes.
//    A PR with none of these goes to Improvements, flagged in the team table so it can be labelled.
// 5. Writes OUT_DIR/release-notes-<tag>.md. The job summary also gets a "For the team" table that shows where each PR went.
//
// Env: TAG (required), GITHUB_REPOSITORY (owner/name), GITHUB_TOKEN, PREVIOUS_TAG (optional override),
//      TICKET_PATTERN, TICKET_URL (optional, see above), OUT_DIR (default release-notes),
//      TAG_PATTERN (default v[0-9]*), EXCLUDE_LABELS (comma-separated, default skip-release-notes,ignore-for-release).
// Local run: TAG=v1.5.0 GITHUB_REPOSITORY=owner/name GITHUB_TOKEN=<token> node .github/scripts/release-notes.mjs

import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const COMMITS_PER_QUERY = 50;
const PRS_PER_QUERY = 20;
const ISSUES_PER_QUERY = 50;
const MAX_ATTEMPTS = 5;
const MAX_WAIT_MS = 5 * 60_000;
const REQUEST_TIMEOUT_MS = 30_000;

// Order matters: a PR goes to the first section whose labels match, and a ticket with several PRs goes to the
// earliest section among them (a ticket with a feat PR and a fix PR is a new feature).
// `enhancement` is GitHub's default label for "New feature or request", so it counts as a feature.
const SECTIONS = [
  { key: 'features', title: 'New Features', column: "What's new", client: true, labels: ['feature', 'feat', 'new feature', 'enhancement'], types: ['feat'] },
  { key: 'fixes', title: 'Bug Fixes', column: "What's fixed", client: true, labels: ['bug', 'bugfix', 'fix'], types: ['fix'] },
  { key: 'improvements', title: 'Improvements', column: "What's better", client: true, labels: ['improvement', 'performance', 'perf', 'ux'], types: ['perf'] },
  {
    key: 'technical',
    title: 'Technical (hidden)',
    client: false,
    labels: ['chore', 'ci', 'build', 'test', 'tests', 'refactor', 'documentation', 'docs', 'dependencies', 'infrastructure'],
    types: ['chore', 'ci', 'build', 'test', 'refactor', 'docs', 'style'],
  },
];
// Where a PR goes when no label, title or branch prefix says what it is.
const DEFAULT_SECTION = SECTIONS.find((section) => section.key === 'improvements');

const config = {
  tag: requireEnv('TAG'),
  repo: requireEnv('GITHUB_REPOSITORY'),
  token: requireEnv('GITHUB_TOKEN'),
  previousTagOverride: process.env.PREVIOUS_TAG?.trim() ?? '',
  ticketPattern: compileTicketPattern(process.env.TICKET_PATTERN?.trim()),
  ticketUrl: process.env.TICKET_URL?.trim() ?? '',
  outDir: process.env.OUT_DIR || 'release-notes',
  tagPattern: process.env.TAG_PATTERN || 'v[0-9]*',
  excludeLabels: (process.env.EXCLUDE_LABELS ?? 'skip-release-notes,ignore-for-release')
    .split(',')
    .map((label) => label.trim().toLowerCase())
    .filter(Boolean),
  serverUrl: process.env.GITHUB_SERVER_URL || 'https://github.com',
  graphqlUrl: process.env.GITHUB_GRAPHQL_URL || 'https://api.github.com/graphql',
};
if (config.ticketUrl && !config.ticketUrl.includes('{id}')) fatal('TICKET_URL must contain {id}, e.g. https://acme.atlassian.net/browse/{id}');
const [owner, name] = config.repo.split('/');
const repoUrl = `${config.serverUrl}/${config.repo}`;
const warnings = [];

async function main() {
  const tagSha = commitOf(config.tag);
  if (!tagSha) {
    throw new Error(`Tag ${config.tag} not found. Check the tag name and that tags are fetched (checkout with fetch-depth: 0).`);
  }
  const previousTag = findPreviousTag(tagSha);
  const previousSha = previousTag ? commitOf(previousTag) : null;
  if (!previousTag) {
    warn(`No release tag matching "${config.tagPattern}" before ${config.tag}: the notes cover the whole history up to ${config.tag}.`);
  }

  const commits = listCommits(previousSha, tagSha);
  console.log(`Range ${previousTag ?? '(start)'}..${config.tag}: ${commits.length} commits`);
  if (commits.length === 0) warn(`No commits between ${previousTag} and ${config.tag}.`);

  const { prNumbers, commitsWithoutPr, duplicatesRemoved } = await findMergedPullRequests(commits);
  console.log(`Merged pull requests in range: ${prNumbers.length} (${duplicatesRemoved} duplicate references removed)`);

  const prs = await fetchPullRequests(prNumbers);
  const issuesByNumber = config.ticketPattern ? null : await resolveMentionedIssues(prs);
  const changes = prs
    .map((pr) => describePullRequest(pr, issuesByNumber))
    .sort((a, b) => a.mergedAt.localeCompare(b.mergedAt) || a.number - b.number);
  const rows = groupByTicket(changes.filter((change) => change.section.client && !change.excludedBy));

  const releaseNotes = renderReleaseNotes(rows, previousTag);
  const teamNotes = renderTeamNotes({ changes, rows, previousTag, commits, commitsWithoutPr });
  writeOutputs(releaseNotes, teamNotes);
}

// ---------- git ----------

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }).trim();
}

function commitOf(tag) {
  try {
    return git('rev-parse', '--verify', '--quiet', `refs/tags/${tag}^{commit}`);
  } catch {
    return null;
  }
}

function findPreviousTag(tagSha) {
  if (config.previousTagOverride) {
    const sha = commitOf(config.previousTagOverride);
    if (!sha) throw new Error(`PREVIOUS_TAG ${config.previousTagOverride} not found.`);
    try {
      git('merge-base', '--is-ancestor', sha, tagSha);
    } catch {
      warn(`${config.previousTagOverride} is not an ancestor of ${config.tag}: the range may hold unexpected commits.`);
    }
    return config.previousTagOverride;
  }
  // Tags reachable from this tag that are not on its own commit, highest version first.
  // versionsort.suffix=- sorts v1.5.0-rc.1 before v1.5.0. A stable release skips pre-release tags,
  // so v1.5.0 is compared with v1.4.0, not with v1.5.0-rc.2.
  const isPrerelease = config.tag.includes('-');
  const candidates = git(
    '-c', 'versionsort.suffix=-',
    'tag', '--list', config.tagPattern, '--merged', tagSha, '--no-contains', tagSha, '--sort=-v:refname',
  )
    .split('\n')
    .filter(Boolean)
    .filter((tag) => isPrerelease || !tag.includes('-'));
  return candidates[0] ?? null;
}

function listCommits(fromSha, toSha) {
  const range = fromSha ? `${fromSha}..${toSha}` : toSha;
  const out = git('log', '--format=%H%x1f%h%x1f%s', range);
  if (!out) return [];
  return out.split('\n').map((line) => {
    const [sha, shortSha, subject] = line.split('\x1f');
    return { sha, shortSha, subject };
  });
}

// The tag's date: the tagger date for an annotated tag, the commit date for a lightweight one.
function releaseDate() {
  const iso = git('for-each-ref', '--format=%(creatordate:iso-strict)', `refs/tags/${config.tag}`);
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso));
}

// ---------- GitHub GraphQL ----------

async function graphql(query, variables = {}, { allowNotFound = false } = {}) {
  for (let attempt = 1; ; attempt++) {
    let response;
    let body;
    try {
      response = await fetch(config.graphqlUrl, {
        method: 'POST',
        headers: {
          authorization: `bearer ${config.token}`,
          'content-type': 'application/json',
          'user-agent': 'release-notes-workflow',
        },
        body: JSON.stringify({ query, variables: { owner, name, ...variables } }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      body = await response.text();
    } catch (error) {
      // Network errors carry a `cause`; timeouts are TimeoutError. Anything else is a bad request (e.g. an invalid
      // token header): don't retry, and don't print error.message, which can quote the header value.
      if (error.name !== 'TimeoutError' && !error.cause) {
        throw new Error(`GitHub API request could not be sent (${error.name}). Check GITHUB_TOKEN and GITHUB_GRAPHQL_URL.`);
      }
      const reason = error.cause?.code ?? error.cause?.errors?.[0]?.code ?? error.cause?.message ?? error.name;
      await retryOrThrow(attempt, `request failed (${reason})`);
      continue;
    }

    if (response.ok) {
      let json;
      try {
        json = JSON.parse(body);
      } catch {
        await retryOrThrow(attempt, 'response is not JSON');
        continue;
      }
      const errors = json.errors ?? [];
      if (errors.some((error) => error.type === 'RATE_LIMITED')) {
        await retryOrThrow(attempt, 'GraphQL rate limit', rateLimitWaitMs(response));
        continue;
      }
      const fatalErrors = errors.filter((error) => !(allowNotFound && error.type === 'NOT_FOUND'));
      if (fatalErrors.length > 0 || !json.data) {
        throw new Error(`GitHub GraphQL error: ${fatalErrors.map((error) => error.message).join('; ') || 'no data returned'}`);
      }
      return json.data;
    }

    const rateLimited =
      response.status === 429 ||
      (response.status === 403 &&
        (response.headers.has('retry-after') ||
          response.headers.get('x-ratelimit-remaining') === '0' ||
          /rate limit/i.test(body)));
    if (response.status >= 500 || rateLimited) {
      await retryOrThrow(attempt, `HTTP ${response.status}`, rateLimitWaitMs(response));
      continue;
    }
    const hint = response.status === 401 ? ' Check GITHUB_TOKEN.' : '';
    throw new Error(`GitHub API returned HTTP ${response.status}: ${body.slice(0, 300)}${hint}`);
  }
}

function rateLimitWaitMs(response) {
  const retryAfter = Number(response.headers.get('retry-after'));
  if (retryAfter > 0) return retryAfter * 1000;
  if (response.headers.get('x-ratelimit-remaining') === '0') {
    const reset = Number(response.headers.get('x-ratelimit-reset'));
    if (reset > 0) return Math.max(reset * 1000 - Date.now(), 1000);
  }
  return 0;
}

async function retryOrThrow(attempt, reason, waitMs = 0) {
  if (attempt >= MAX_ATTEMPTS) throw new Error(`GitHub API ${reason}: gave up after ${attempt} attempts.`);
  const delay = waitMs || Math.min(1000 * 2 ** (attempt - 1), 30_000) + Math.floor(Math.random() * 500);
  if (delay > MAX_WAIT_MS) {
    throw new Error(`GitHub API ${reason}: the rate limit resets in ${Math.ceil(delay / 60_000)} min, too long to wait.`);
  }
  console.log(`::warning::GitHub API ${reason}, retrying in ${Math.ceil(delay / 1000)}s (attempt ${attempt + 1}/${MAX_ATTEMPTS})`);
  await sleep(delay);
}

// Fetches the pages after the first one of a connection. `query` takes $after; `pick` returns the connection.
async function fetchRemainingPages(query, pick, endCursor, variables = {}) {
  const nodes = [];
  let after = endCursor;
  while (after) {
    const connection = pick(await graphql(query, { ...variables, after }));
    nodes.push(...connection.nodes);
    after = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null;
  }
  return nodes;
}

// ---------- pull requests ----------

const ASSOCIATED_PR_FIELDS = 'number merged mergeCommit { oid }';

async function findMergedPullRequests(commits) {
  const shasInRange = new Set(commits.map((commit) => commit.sha));
  const prNumbers = new Set();
  const commitsWithoutPr = [];
  let duplicatesRemoved = 0;

  for (const batch of chunk(commits, COMMITS_PER_QUERY)) {
    const fields = batch
      .map(
        (commit, i) => `c${i}: object(oid: "${commit.sha}") { ... on Commit {
          associatedPullRequests(first: 10) { pageInfo { hasNextPage endCursor } nodes { ${ASSOCIATED_PR_FIELDS} } }
        } }`,
      )
      .join('\n');
    const data = await graphql(`query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { ${fields} } }`);

    for (const [i, commit] of batch.entries()) {
      const object = data.repository[`c${i}`];
      if (!object) {
        warn(`Commit ${commit.shortSha} is not on GitHub (not pushed?); it is not part of any PR in the notes.`);
        commitsWithoutPr.push(commit);
        continue;
      }
      const connection = object.associatedPullRequests;
      const candidates = connection.pageInfo.hasNextPage
        ? connection.nodes.concat(
            await fetchRemainingPages(
              `query($owner: String!, $name: String!, $oid: GitObjectID!, $after: String) {
                repository(owner: $owner, name: $name) { object(oid: $oid) { ... on Commit {
                  associatedPullRequests(first: 50, after: $after) { pageInfo { hasNextPage endCursor } nodes { ${ASSOCIATED_PR_FIELDS} } }
                } } } }`,
              (page) => page.repository.object.associatedPullRequests,
              connection.pageInfo.endCursor,
              { oid: commit.sha },
            ),
          )
        : connection.nodes;

      // Only PRs merged inside the range. This drops PRs that are still open or merged before the previous tag.
      const merged = candidates.filter((pr) => pr.merged && pr.mergeCommit && shasInRange.has(pr.mergeCommit.oid));
      if (merged.length === 0) {
        commitsWithoutPr.push(commit);
        continue;
      }
      for (const pr of merged) {
        if (prNumbers.has(pr.number)) duplicatesRemoved++;
        prNumbers.add(pr.number);
      }
    }
  }
  return { prNumbers: [...prNumbers], commitsWithoutPr, duplicatesRemoved };
}

const ISSUE_FRAGMENT = `fragment IssueFields on Issue {
  number title url repository { nameWithOwner } labels(first: 20) { nodes { name } }
}`;
const PR_FIELDS = `number title body url mergedAt headRefName
  labels(first: 50) { pageInfo { hasNextPage endCursor } nodes { name } }
  closingIssuesReferences(first: 25) { pageInfo { hasNextPage endCursor } nodes { ...IssueFields } }`;

async function fetchPullRequests(numbers) {
  const prs = [];
  for (const batch of chunk(numbers, PRS_PER_QUERY)) {
    const fields = batch.map((number) => `pr${number}: pullRequest(number: ${number}) { ${PR_FIELDS} }`).join('\n');
    const data = await graphql(
      `query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { ${fields} } } ${ISSUE_FRAGMENT}`,
    );
    for (const number of batch) {
      const pr = data.repository[`pr${number}`];
      const { labels, closingIssuesReferences: closing } = pr;
      if (labels.pageInfo.hasNextPage) {
        labels.nodes.push(...(await fetchRemainingPrPages(number, 'labels', 'name', labels.pageInfo.endCursor)));
      }
      if (closing.pageInfo.hasNextPage) {
        closing.nodes.push(
          ...(await fetchRemainingPrPages(number, 'closingIssuesReferences', '...IssueFields', closing.pageInfo.endCursor, ISSUE_FRAGMENT)),
        );
      }
      prs.push(pr);
    }
  }
  return prs;
}

// Pages 2+ of a PR's `labels` or `closingIssuesReferences` connection.
function fetchRemainingPrPages(number, field, nodeFields, endCursor, fragment = '') {
  return fetchRemainingPages(
    `query($owner: String!, $name: String!, $number: Int!, $after: String) {
      repository(owner: $owner, name: $name) { pullRequest(number: $number) {
        ${field}(first: 100, after: $after) { pageInfo { hasNextPage endCursor } nodes { ${nodeFields} } }
      } } } ${fragment}`,
    (page) => page.repository.pullRequest[field],
    endCursor,
    { number },
  );
}

// ---------- tickets ----------

function compileTicketPattern(source) {
  if (!source) return null;
  try {
    return new RegExp(source, 'g');
  } catch (error) {
    fatal(`TICKET_PATTERN is not a valid regular expression: ${error.message}`);
  }
}

// PR descriptions without HTML comments (PR templates) and code, where ticket-like text is not a reference.
function descriptionText(body) {
  return (body ?? '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ');
}

// Ticket IDs in the PR title, branch name and description, in that order. The first capture group is the ID
// when the pattern has one (e.g. trello\.com/c/(\w+)), otherwise the whole match.
function findTicketIds(pr) {
  const ids = new Set();
  for (const text of [pr.title, pr.headRefName, descriptionText(pr.body)]) {
    for (const match of text.matchAll(config.ticketPattern)) ids.add(match[1] ?? match[0]);
  }
  return [...ids];
}

// GitHub issue numbers a PR description mentions in this repository.
function parseIssueReferences(body) {
  const numbers = new Set();
  const repoPattern = escapeRegExp(config.repo);
  const reference = new RegExp(
    String.raw`${escapeRegExp(config.serverUrl)}/${repoPattern}/(?:issues|pull)/(\d+)\b|\b${repoPattern}#(\d+)\b|(?<![\w/&#])#(\d+)\b`,
    'gi',
  );
  for (const match of descriptionText(body).matchAll(reference)) numbers.add(Number(match[1] ?? match[2] ?? match[3]));
  return numbers;
}

// Looks up the issue numbers mentioned in PR descriptions that GitHub has not already linked to a PR.
// Numbers that turn out to be pull requests or do not exist are dropped.
async function resolveMentionedIssues(prs) {
  const issuesByNumber = new Map();
  for (const pr of prs) {
    for (const issue of pr.closingIssuesReferences.nodes) {
      if (issue.repository.nameWithOwner === config.repo) issuesByNumber.set(issue.number, issue);
    }
  }
  const prNumbers = new Set(prs.map((pr) => pr.number));
  const unknown = new Set();
  for (const pr of prs) {
    for (const number of parseIssueReferences(pr.body)) {
      if (!issuesByNumber.has(number) && !prNumbers.has(number)) unknown.add(number);
    }
  }

  for (const batch of chunk([...unknown], ISSUES_PER_QUERY)) {
    const fields = batch
      .map((number) => `i${number}: issueOrPullRequest(number: ${number}) { __typename ... on Issue { ...IssueFields } }`)
      .join('\n');
    const data = await graphql(
      `query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { ${fields} } } ${ISSUE_FRAGMENT}`,
      {},
      { allowNotFound: true },
    );
    for (const number of batch) {
      const item = data.repository[`i${number}`];
      if (!item) warn(`#${number} is mentioned in a PR description but does not exist; skipped.`);
      else if (item.__typename === 'Issue') issuesByNumber.set(number, item);
    }
  }
  return issuesByNumber;
}

// The GitHub issues a PR closes, then the ones its description mentions.
function linkedGithubIssues(pr, issuesByNumber) {
  const issues = new Map();
  for (const issue of pr.closingIssuesReferences.nodes) issues.set(`${issue.repository.nameWithOwner}#${issue.number}`, issue);
  for (const number of parseIssueReferences(pr.body)) {
    const issue = issuesByNumber.get(number);
    if (issue) issues.set(`${config.repo}#${number}`, issue);
  }
  return [...issues.values()];
}

function describePullRequest(pr, issuesByNumber) {
  const issues = issuesByNumber ? linkedGithubIssues(pr, issuesByNumber) : [];
  const tickets = config.ticketPattern
    ? findTicketIds(pr).map((id) => ({
        id,
        label: /^\d+$/.test(id) ? `#${id}` : id,
        url: config.ticketUrl ? config.ticketUrl.replaceAll('{id}', encodeURIComponent(id)) : null,
        title: null,
      }))
    : issues.map((issue) => {
        const sameRepo = issue.repository.nameWithOwner === config.repo;
        return {
          id: `${issue.repository.nameWithOwner}#${issue.number}`,
          label: sameRepo ? `#${issue.number}` : `${issue.repository.nameWithOwner}#${issue.number}`,
          url: issue.url,
          title: issue.title,
        };
      });
  const prLabels = pr.labels.nodes.map((label) => label.name);
  const issueLabels = issues.flatMap((issue) => issue.labels.nodes.map((label) => label.name));
  const section = sectionOf(pr, [...prLabels, ...issueLabels]);
  return {
    number: pr.number,
    title: pr.title,
    url: pr.url,
    mergedAt: pr.mergedAt,
    tickets,
    section: section ?? DEFAULT_SECTION,
    guessed: !section,
    excludedBy: prLabels.find((label) => config.excludeLabels.includes(label.toLowerCase())) ?? null,
  };
}

// Labels first (the PR's and its GitHub issues'), then a Conventional Commits title ("feat(tasks): ..."),
// then the branch prefix ("fix/...").
function sectionOf(pr, labels) {
  const lowerLabels = labels.map((label) => label.toLowerCase());
  const byLabel = SECTIONS.find((section) => section.labels.some((label) => lowerLabels.includes(label)));
  if (byLabel) return byLabel;
  const title = pr.title.match(/^(?:\[[^\]]*\]\s*|[A-Z][A-Z0-9]+-\d+:?\s+)*(\w+)(?:\([^)]*\))?!?:/);
  const type = title?.[1].toLowerCase() ?? pr.headRefName.match(/^(\w+)\//)?.[1].toLowerCase();
  return SECTIONS.find((section) => section.types.includes(type)) ?? null;
}

// One row per ticket: PRs with the same tickets are merged into one row. A PR without a ticket is its own row.
function groupByTicket(changes) {
  const rows = new Map();
  for (const change of changes) {
    const key = change.tickets.length ? change.tickets.map((ticket) => ticket.id).sort().join(' ') : `pr:${change.number}`;
    const row = rows.get(key);
    if (!row) {
      rows.set(key, { tickets: change.tickets, changes: [change], section: change.section });
      continue;
    }
    row.changes.push(change);
    if (SECTIONS.indexOf(change.section) < SECTIONS.indexOf(row.section)) row.section = change.section;
  }
  return [...rows.values()].map((row) => ({ ...row, title: rowTitle(row) }));
}

// A GitHub issue's title when the row has one issue; otherwise the first PR's title without ticket IDs
// and the Conventional Commits prefix: "[PROJ-12] feat(tasks): export tasks" -> "Export tasks".
function rowTitle(row) {
  if (row.tickets.length === 1 && row.tickets[0].title) return row.tickets[0].title;
  let title = row.changes[0].title;
  for (const { id } of row.tickets) {
    const escaped = escapeRegExp(id);
    title = title
      .replace(new RegExp(String.raw`[\[(]\s*${escaped}\s*[\])]`, 'g'), ' ')
      .replace(new RegExp(String.raw`^\s*${escaped}\s*[:\-–|]?\s*`), '')
      .replace(new RegExp(String.raw`\s*[\-–|]?\s*${escaped}\s*$`), '');
  }
  title = title.trim().replace(/^\w+(?:\([^)]*\))?!?:\s*/, '').replace(/\s{2,}/g, ' ');
  return title.charAt(0).toUpperCase() + title.slice(1);
}

// ---------- output ----------

function renderReleaseNotes(rows, previousTag) {
  const lines = [`# Release Notes – ${config.tag}`, '', `**Release date:** ${releaseDate()}`, '', '## Overview', '', overview(rows, previousTag), ''];
  for (const section of SECTIONS.filter((s) => s.client)) {
    const sectionRows = rows.filter((row) => row.section === section);
    if (sectionRows.length === 0) continue;
    lines.push(`## ${section.title}`, '', `| Task | ${section.column} |`, '|---|---|');
    for (const row of sectionRows) lines.push(`| ${ticketCell(row.tickets)} | ${escapeMarkdown(row.title)} |`);
    lines.push('');
  }
  return lines.join('\n');
}

function overview(rows, previousTag) {
  const count = (key) => rows.filter((row) => row.section.key === key).length;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const parts = [
    count('features') && plural(count('features'), 'new feature', 'new features'),
    count('fixes') && plural(count('fixes'), 'bug fix', 'bug fixes'),
    count('improvements') && plural(count('improvements'), 'improvement', 'improvements'),
  ].filter(Boolean);
  const since = previousTag ? ` since ${previousTag}` : '';
  if (rows.length === 0) return 'This release contains internal maintenance only. Nothing changes in how the product works.';

  return `This release brings ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0]}${since}.`;
}

function ticketCell(tickets) {
  if (tickets.length === 0) return '—';
  return tickets.map((ticket) => (ticket.url ? `[${escapeMarkdown(ticket.label)}](${ticket.url})` : escapeMarkdown(ticket.label))).join(', ');
}

// Shown only in the workflow run summary: where each PR went, so the team can fix labels or missing tickets.
function renderTeamNotes({ changes, rows, previousTag, commits, commitsWithoutPr }) {
  const range = previousTag ? `[${previousTag}...${config.tag}](${repoUrl}/compare/${previousTag}...${config.tag})` : `whole history up to ${config.tag}`;
  const ticketSource = config.ticketPattern ? `\`${config.ticketPattern.source}\` in PR titles, branches and descriptions` : 'GitHub issues linked to the PRs';
  const lines = [
    '---',
    '',
    '## For the team (not part of the release notes)',
    '',
    `- **Range:** ${range} · ${commits.length} commits, ${commitsWithoutPr.length} of them not in a PR`,
    `- **Tickets from:** ${ticketSource}`,
    `- **Pull requests:** ${changes.length} merged, ${rows.length} ${rows.length === 1 ? 'row' : 'rows'} in the release notes`,
    '',
  ];
  if (changes.length > 0) {
    const rowOf = new Map(rows.flatMap((row) => row.changes.map((change) => [change.number, row])));
    lines.push('| PR | Title | Tickets | In the notes as |', '|---|---|---|---|');
    for (const change of changes) {
      const row = rowOf.get(change.number);
      let placement;
      if (change.excludedBy) placement = `left out (label \`${change.excludedBy}\`)`;
      else if (!change.section.client) placement = 'left out (technical)';
      else if (change.guessed) placement = `${row.section.title} (guessed: add a feature, bug or improvement label)`;
      else placement = row.section.title;
      lines.push(`| [#${change.number}](${change.url}) | ${escapeMarkdown(change.title)} | ${ticketCell(change.tickets)} | ${placement} |`);
    }
    lines.push('');
  }
  if (warnings.length > 0) {
    lines.push('**Warnings**', '');
    for (const warning of warnings) lines.push(`- ${escapeMarkdown(warning)}`);
    lines.push('');
  }
  return lines.join('\n');
}

function writeOutputs(releaseNotes, teamNotes) {
  const safeTag = config.tag.replace(/[^\w.-]/g, '-');
  const file = join(config.outDir, `release-notes-${safeTag}.md`);
  mkdirSync(config.outDir, { recursive: true });
  writeFileSync(file, releaseNotes);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${releaseNotes}\n${teamNotes}\n`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `artifact_name=release-notes-${safeTag}\n`);
  console.log(`Wrote ${file}`);
}

// ---------- helpers ----------

function requireEnv(key) {
  const value = process.env[key]?.trim();
  if (!value) fatal(`Missing environment variable ${key}`);
  return value;
}

function fatal(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

function warn(message) {
  warnings.push(message);
  console.log(`::warning::${message}`);
}

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeMarkdown(text) {
  return String(text).replace(/([\\`*_[\]<>|])/g, '\\$1');
}

main().catch((error) => {
  console.error(`::error::${error.message}`);
  process.exit(1);
});
