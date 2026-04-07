import { buildCorsHeaders, readJson } from '../_shared/publicUtils.ts';
import { getVerifiedClaims } from '../_shared/auth.ts';

type GitHubLabel = { name?: string | null } | string;
type GitHubIssue = {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: 'open' | 'closed';
  updated_at?: string;
  created_at?: string;
  labels?: GitHubLabel[];
  body?: string | null;
  pull_request?: unknown;
  assignee?: { login?: string | null } | null;
  assignees?: { login?: string | null }[] | null;
};

type BoardColumn = 'backlog' | 'active' | 'blocked' | 'done';
type BuildStatus = 'active' | 'blocked' | 'backlog' | 'done';

const respondJson = (body: Record<string, unknown>, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });

const asBool = (v: string | null) => v === '1' || v === 'true';

const normalizeLabel = (value: unknown) => String(value ?? '').trim().toLowerCase();

const issueLabels = (issue: GitHubIssue): string[] => {
  const labels = Array.isArray(issue.labels) ? issue.labels : [];
  return labels
    .map((l) => (typeof l === 'string' ? l : l?.name))
    .filter(Boolean)
    .map((name) => normalizeLabel(name));
};

const firstLabelWithPrefix = (labels: string[], prefix: string): string | null => {
  for (const label of labels) {
    if (label.startsWith(prefix)) return label;
  }
  return null;
};

const titleFromBuildLabel = (buildLabel: string): string => {
  const raw = buildLabel.replace(/^build:/, '').trim();
  if (!raw) return 'Unassigned';

  return raw
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
};

const columnFromLabels = (labels: string[]): BoardColumn => {
  const statuses: Record<string, BoardColumn> = {
    'status:backlog': 'backlog',
    'status:active': 'active',
    'status:blocked': 'blocked',
  };

  for (const label of labels) {
    if (label in statuses) return statuses[label];
  }

  return 'backlog';
};

const statusLabelFromLabels = (labels: string[]): BuildStatus | null => {
  if (labels.includes('status:active')) return 'active';
  if (labels.includes('status:blocked')) return 'blocked';
  if (labels.includes('status:backlog')) return 'backlog';
  return null;
};

const typeLabelFromLabels = (labels: string[]): 'build' | 'fix' | 'discovery' | 'audit' | null => {
  if (labels.includes('type:build')) return 'build';
  if (labels.includes('type:fix')) return 'fix';
  if (labels.includes('type:discovery')) return 'discovery';
  if (labels.includes('type:audit')) return 'audit';
  return null;
};

const looksLikePlaceholder = (value: string): boolean => {
  const v = value.trim().toLowerCase();
  if (!v) return true;
  return (
    v.includes('single next step') ||
    v.includes('≤60') ||
    v.includes('60 min') ||
    v.includes('e.g.') ||
    v.includes('example') ||
    v === '-' ||
    v === 'tbd'
  );
};

const parseSectionValue = (text: string, heading: RegExp): string | null => {
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (!heading.test(line)) continue;

    for (let j = i + 1; j < lines.length; j += 1) {
      const candidate = String(lines[j] ?? '').trim();
      if (!candidate) continue;
      if (/^#{1,6}\s+/.test(candidate)) break; // next section
      const cleaned = candidate.replace(/^[-*]\s+/, '').trim();
      if (!cleaned) continue;
      if (looksLikePlaceholder(cleaned)) return null;
      return cleaned;
    }

    break;
  }

  return null;
};

const parseNextAction = (body: string | null | undefined): string | null => {
  const text = String(body ?? '');
  if (!text.trim()) return null;

  const match = text.match(/^\s*NEXT:\s*(.+)\s*$/im);
  if (!match?.[1]) return null;

  const next = match[1].trim();
  if (looksLikePlaceholder(next)) return null;
  if (next) return next;

  // Fallback: accept a markdown heading like "## NEXT" and read the first non-empty line below it.
  return parseSectionValue(text, /^#{2,6}\s*.*\bnext\b.*$/i);
};

const parseBlockedBy = (body: string | null | undefined): string | null => {
  const text = String(body ?? '');
  if (!text.trim()) return null;

  const match = text.match(/^\s*BLOCKED BY:\s*(.+)\s*$/im);
  if (!match?.[1]) return null;

  const blockedBy = match[1].trim();
  if (looksLikePlaceholder(blockedBy)) return null;
  if (blockedBy) return blockedBy;

  return parseSectionValue(text, /^#{2,6}\s*.*\bblocked\s+by\b.*$/i);
};

const fetchJson = async (url: string, token: string) => {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub API error (${res.status}): ${text || res.statusText}`);
  }

  const link = res.headers.get('link') || '';
  const data = (await res.json().catch(() => null)) as unknown;
  return { data, link };
};

const parseNextLink = (linkHeader: string): string | null => {
  const parts = linkHeader.split(',');
  for (const part of parts) {
    const m = part.match(/<([^>]+)>\s*;\s*rel="next"/i);
    if (m?.[1]) return m[1];
  }
  return null;
};

const fetchIssues = async (
  repo: string,
  token: string,
  trackLabel: string,
  maxIssues = 250,
): Promise<GitHubIssue[]> => {
  const base = `https://api.github.com/repos/${repo}/issues`;
  const labelParam = encodeURIComponent(trackLabel);
  let url = `${base}?state=all&per_page=100&sort=updated&direction=desc&labels=${labelParam}`;

  const issues: GitHubIssue[] = [];
  while (url && issues.length < maxIssues) {
    const { data, link } = await fetchJson(url, token);
    if (!Array.isArray(data)) break;

    for (const row of data) {
      if (issues.length >= maxIssues) break;
      issues.push(row as GitHubIssue);
    }

    url = parseNextLink(link);
  }

  return issues;
};

const isSuperuserFromClaims = (claims: Record<string, unknown>): boolean => {
  const app = (claims.app_metadata ?? {}) as Record<string, unknown>;
  const user = (claims.user_metadata ?? {}) as Record<string, unknown>;
  const role = normalizeLabel(claims.role);

  return (
    role === 'service_role' ||
    app?.is_superuser === true ||
    app?.superuser === true ||
    user?.is_superuser === true ||
    user?.superuser === true
  );
};

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const cors = buildCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors.headers });
  }

  if (req.method !== 'POST') {
    return respondJson({ error: 'Method not allowed' }, 405, cors.headers);
  }

  let claims;
  try {
    ({ claims } = await getVerifiedClaims(req));
  } catch (error) {
    return respondJson({ error: String(error?.message ?? error) }, 401, cors.headers);
  }

  const requireSuper = asBool(Deno.env.get('GITHUB_REQUIRE_SUPERUSER'));
  if (requireSuper && !isSuperuserFromClaims(claims as Record<string, unknown>)) {
    return respondJson({ error: 'Forbidden' }, 403, cors.headers);
  }

  const token = (Deno.env.get('GITHUB_TOKEN') ?? '').trim();
  if (!token) {
    return respondJson({ error: 'Missing GITHUB_TOKEN secret' }, 500, cors.headers);
  }

  const repo = (Deno.env.get('GITHUB_REPO') ?? 'faydog127/BHFOS').trim();
  if (!repo || !repo.includes('/')) {
    return respondJson({ error: 'Invalid GITHUB_REPO (expected owner/repo)' }, 500, cors.headers);
  }

  const trackLabel = (Deno.env.get('GITHUB_TRACK_LABEL') ?? 'track:ops').trim() || 'track:ops';

  const body = (await readJson(req)) as Record<string, unknown> | null;
  const action = String(body?.action ?? 'board').trim().toLowerCase();
  if (action !== 'board') {
    return respondJson({ error: 'Unknown action' }, 400, cors.headers);
  }

  try {
    const issues = await fetchIssues(repo, token, trackLabel);

    const columns: Record<BoardColumn, unknown[]> = {
      backlog: [],
      active: [],
      blocked: [],
      done: [],
    };

    const builds = new Map<
      string,
      {
        id: string;
        name: string;
        status: BuildStatus;
        counts: {
          total: number;
          open: number;
          blocked: number;
          countable_total: number;
          countable_closed: number;
        };
        next: string | null;
        resume_issue_number: number | null;
        updated_at: string | null;
      }
    >();

    for (const issue of issues) {
      if (issue.pull_request) continue; // exclude PRs

      const labels = issueLabels(issue);
      const column = columnFromLabels(labels);
      const statusLabel = statusLabelFromLabels(labels);
      const typeLabel = typeLabelFromLabels(labels);
      const buildLabel = firstLabelWithPrefix(labels, 'build:') || 'build:unassigned';

      const next = parseNextAction(issue.body);
      const blockedBy = parseBlockedBy(issue.body);

      const item = {
        id: issue.id,
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        state: issue.state,
        updated_at: issue.updated_at ?? null,
        labels,
        assignees: (issue.assignees || [])
          .map((a) => normalizeLabel(a?.login))
          .filter(Boolean),
        next,
        blocked_by: blockedBy,
      };

      // Build rollups (derived from build:* labels on issues)
      const existing = builds.get(buildLabel) ?? {
        id: buildLabel,
        name: titleFromBuildLabel(buildLabel),
        status: 'backlog' as BuildStatus,
        counts: {
          total: 0,
          open: 0,
          blocked: 0,
          countable_total: 0,
          countable_closed: 0,
        },
        next: null as string | null,
        resume_issue_number: null as number | null,
        updated_at: null as string | null,
      };

      existing.counts.total += 1;
      if (issue.state !== 'closed') {
        existing.counts.open += 1;
      }

      if (issue.state !== 'closed' && statusLabel === 'blocked') {
        existing.counts.blocked += 1;
      }

      const isCountable = typeLabel === 'build' || typeLabel === 'fix';
      if (isCountable) {
        existing.counts.countable_total += 1;
        if (issue.state === 'closed') {
          existing.counts.countable_closed += 1;
        }
      }

      const updatedAt = issue.updated_at ?? null;
      const isOpen = issue.state !== 'closed';
      const isResumeCandidate = isOpen && statusLabel === 'active' && !!next;
      const isBetterCandidate =
        isResumeCandidate &&
        (!existing.updated_at || (updatedAt && updatedAt > existing.updated_at));

      if (isBetterCandidate) {
        existing.next = next;
        existing.resume_issue_number = issue.number;
        existing.updated_at = updatedAt;
      } else if (!existing.next && isOpen && !!next) {
        // fallback: first open issue with NEXT
        existing.next = next;
        existing.resume_issue_number = issue.number;
        existing.updated_at = updatedAt;
      } else if (!existing.updated_at && updatedAt) {
        existing.updated_at = updatedAt;
      }

      // Derive build status: active beats blocked beats backlog beats done
      // - done: no open issues
      // - active: any open status:active issue
      // - blocked: no active, but any open status:blocked issue
      // - backlog: otherwise if any open issues
      if (existing.counts.open === 0) {
        existing.status = 'done';
      } else if (issue.state !== 'closed' && statusLabel === 'active') {
        existing.status = 'active';
      } else if (existing.status !== 'active' && issue.state !== 'closed' && statusLabel === 'blocked') {
        existing.status = 'blocked';
      } else if (existing.status === 'done') {
        existing.status = 'backlog';
      }

      builds.set(buildLabel, existing);

      // Treat closed issues as done regardless of label, but keep label-driven behavior for open issues.
      if (issue.state === 'closed') {
        columns.done.push(item);
      } else {
        columns[column].push(item);
      }
    }

    const buildList = Array.from(builds.values())
      .map((b) => {
        const total = b.counts.countable_total;
        const closed = b.counts.countable_closed;
        const percent_complete = total > 0 ? Math.round((closed / total) * 100) : null;
        return { ...b, percent_complete };
      })
      .sort((a, b) => {
        const order: Record<BuildStatus, number> = { active: 0, blocked: 1, backlog: 2, done: 3 };
        const ao = order[a.status] ?? 99;
        const bo = order[b.status] ?? 99;
        if (ao !== bo) return ao - bo;
        const au = a.updated_at ?? '';
        const bu = b.updated_at ?? '';
        return bu.localeCompare(au);
      });

    return respondJson(
      {
        ok: true,
        repo,
        track_label: trackLabel,
        columns,
        builds: buildList,
        build_rules: {
          label_prefix: 'build:',
          count_toward_percent: ['type:build', 'type:fix'],
          excluded_from_percent: ['type:discovery', 'type:audit'],
          done_means: 'closed issue',
        },
        meta: { fetched: issues.length, max: 250 },
      },
      200,
      cors.headers,
    );
  } catch (error) {
    return respondJson({ error: String(error?.message ?? error) }, 500, cors.headers);
  }
});
