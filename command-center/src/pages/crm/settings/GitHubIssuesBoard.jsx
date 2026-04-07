import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, ExternalLink, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { githubIssuesBoardService } from '@/services/githubIssuesBoardService';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

const COLUMN_LABELS = {
  backlog: 'Backlog',
  active: 'Active',
  blocked: 'Blocked',
  done: 'Done',
};

const BUILD_STATUS_LABELS = {
  active: 'Active',
  blocked: 'Blocked',
  backlog: 'Backlog',
  done: 'Done',
};

const badgeClass = (key) => {
  switch (key) {
    case 'active':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'blocked':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'done':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    default:
      return 'bg-amber-50 text-amber-800 border-amber-200';
  }
};

const buildStatusBadgeClass = (key) => {
  switch (key) {
    case 'active':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'blocked':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'done':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    default:
      return 'bg-amber-50 text-amber-800 border-amber-200';
  }
};

const IssueCard = ({ issue, columnKey }) => {
  const updated = issue.updated_at ? formatDistanceToNow(new Date(issue.updated_at), { addSuffix: true }) : null;
  const missingNext = !issue.next;
  const missingBlockedBy = columnKey === 'blocked' && !issue.blocked_by;

  return (
    <div className="rounded border bg-white p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-slate-500">#{issue.number}</span>
            <div className="font-medium text-slate-900 truncate">{issue.title}</div>
          </div>
          <div className="mt-1 text-xs text-slate-600">
            {issue.next ? <><span className="text-slate-400">NEXT:</span> {issue.next}</> : <span className="text-red-700">Missing NEXT:</span>}
          </div>
          {columnKey === 'blocked' ? (
            <div className="mt-1 text-xs text-slate-600">
              {issue.blocked_by ? (
                <>
                  <span className="text-slate-400">BLOCKED BY:</span> {issue.blocked_by}
                </>
              ) : (
                <span className="text-red-700">Missing BLOCKED BY:</span>
              )}
            </div>
          ) : null}
        </div>
        <a
          href={issue.url}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 inline-flex items-center gap-1 text-xs text-blue-700 hover:underline"
          title="Open in GitHub"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {missingNext ? (
          <Badge variant="destructive" className="text-[10px]">
            NEXT?
          </Badge>
        ) : null}
        {missingBlockedBy ? (
          <Badge variant="destructive" className="text-[10px]">
            BLOCKED BY?
          </Badge>
        ) : null}
        {(issue.labels || []).slice(0, 6).map((l) => (
          <Badge key={l} variant="secondary" className="text-[10px]">
            {l}
          </Badge>
        ))}
        {Array.isArray(issue.labels) && issue.labels.length > 6 ? (
          <span className="text-[10px] text-slate-400">+{issue.labels.length - 6}</span>
        ) : null}
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <div className="truncate">
          {(issue.assignees || []).length ? `@${issue.assignees.join(', @')}` : 'Unassigned'}
        </div>
        <div>{updated || '-'}</div>
      </div>
    </div>
  );
};

const GitHubIssuesBoard = () => {
  const [loading, setLoading] = useState(true);
  const [repo, setRepo] = useState(null);
  const [columns, setColumns] = useState({ backlog: [], active: [], blocked: [], done: [] });
  const [builds, setBuilds] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [trackLabel, setTrackLabel] = useState('track:ops');
  const { toast } = useToast();

  const refresh = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await githubIssuesBoardService.board();
      setRepo(data.repo || null);
      setColumns(data.columns || { backlog: [], active: [], blocked: [], done: [] });
      setBuilds(Array.isArray(data.builds) ? data.builds : []);
      setTrackLabel(data.track_label || 'track:ops');
    } catch (e) {
      const message = e?.message || 'Failed to load GitHub board.';
      setLoadError(message);
      toast({ variant: 'destructive', title: 'GitHub load failed', description: message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const counts = useMemo(() => {
    const by = {};
    for (const k of Object.keys(COLUMN_LABELS)) {
      by[k] = Array.isArray(columns?.[k]) ? columns[k].length : 0;
    }
    return by;
  }, [columns]);

  const buildGroups = useMemo(() => {
    const list = Array.isArray(builds) ? builds : [];
    const active = list.filter((b) => b.status === 'active');
    const blocked = list.filter((b) => b.status === 'blocked');
    const backlog = list.filter((b) => b.status === 'backlog');
    const done = list.filter((b) => b.status === 'done');
    return { active, blocked, backlog, done, total: list.length };
  }, [builds]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900">GitHub Work Board</h2>
            {repo ? (
              <Badge variant="secondary" className="font-mono text-xs">
                {repo}
              </Badge>
            ) : null}
          </div>
          <p className="text-slate-500 text-sm">
            Only issues labeled <span className="font-mono">{trackLabel}</span> appear here. Columns are driven by labels:{' '}
            <span className="font-mono">status:backlog</span>,{' '}
            <span className="font-mono">status:active</span>, <span className="font-mono">status:blocked</span>,{' '}
            and Done = closed issues.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {repo ? (
            <Button asChild>
              <a href={`https://github.com/${repo}/issues/new/choose`} target="_blank" rel="noreferrer">
                New Issue
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Setup Checklist</CardTitle>
          <CardDescription>Do these first (in order). Until then, this board will error.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-700">
          <div>
            1) Supabase Edge Runtime running (local) + `github-issues-board` deployed (hosted)
          </div>
          <div>
            2) Set Edge Function secrets: <span className="font-mono">GITHUB_TOKEN</span> (+ optional{' '}
            <span className="font-mono">GITHUB_REPO</span>)
          </div>
          <div>
            3) Create GitHub label: <span className="font-mono">{trackLabel}</span> (required to appear on the board)
          </div>
          <div>
            4) Create GitHub labels: <span className="font-mono">status:backlog</span>,{' '}
            <span className="font-mono">status:active</span>, <span className="font-mono">status:blocked</span>,{' '}
            (optional: <span className="font-mono">status:done</span> is not required if you close issues to mark done)
          </div>
          <div>
            5) Issue body rules: <span className="font-mono">NEXT:</span> is mandatory; blocked issues require{' '}
            <span className="font-mono">BLOCKED BY:</span>
          </div>
          {loadError ? (
            <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-red-800 text-xs">
              <div className="font-semibold">Current error</div>
              <div className="mt-1 font-mono break-words">{loadError}</div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Builds</CardTitle>
          <CardDescription>
            Rollups are derived from issue labels prefixed with <span className="font-mono">build:</span>. Completion only counts{' '}
            <span className="font-mono">type:build</span> and <span className="font-mono">type:fix</span>; Done = closed issues.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {buildGroups.total === 0 ? (
            <div className="text-sm text-slate-600">
              No builds found. Add a <span className="font-mono">build:&lt;id&gt;</span> label to issues (and ensure they are labeled{' '}
              <span className="font-mono">{trackLabel}</span>).
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {[...buildGroups.active, ...buildGroups.blocked, ...buildGroups.backlog].slice(0, 12).map((b) => (
                <div key={b.id} className="rounded border bg-white p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">{b.name}</div>
                      <div className="mt-1 text-xs text-slate-600 truncate">
                        {b.next ? (
                          <>
                            <span className="text-slate-400">NEXT:</span> {b.next}
                          </>
                        ) : (
                          <span className="text-slate-400">No NEXT found (open issue missing NEXT:)</span>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className={buildStatusBadgeClass(b.status)}>
                      {BUILD_STATUS_LABELS[b.status] || b.status}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className="font-mono">{b.id}</span>
                    <span>Open: {b.counts?.open ?? 0}</span>
                    <span>Blocked: {b.counts?.blocked ?? 0}</span>
                    <span>
                      %: {typeof b.percent_complete === 'number' ? `${b.percent_complete}%` : '-'}
                    </span>
                    {repo && b.resume_issue_number ? (
                      <a
                        href={`https://github.com/${repo}/issues/${b.resume_issue_number}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-700 hover:underline"
                      >
                        Resume #{b.resume_issue_number}
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}

          {buildGroups.done.length ? (
            <details className="text-sm">
              <summary className="cursor-pointer text-slate-700">
                Done builds ({buildGroups.done.length})
              </summary>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {buildGroups.done.slice(0, 12).map((b) => (
                  <div key={b.id} className="rounded border bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-slate-900 truncate">{b.name}</div>
                      <Badge variant="outline" className={buildStatusBadgeClass(b.status)}>
                        {BUILD_STATUS_LABELS[b.status] || b.status}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-slate-600 font-mono truncate">{b.id}</div>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.keys(COLUMN_LABELS).map((k) => (
          <Card key={k} className="bg-slate-50 border-slate-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500">{COLUMN_LABELS[k]}</div>
                <div className="text-2xl font-bold text-slate-900">{counts[k]}</div>
              </div>
              <Badge variant="outline" className={badgeClass(k)}>
                {k}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Object.keys(COLUMN_LABELS).map((k) => (
          <Card key={k}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>{COLUMN_LABELS[k]}</span>
                <Badge variant="outline" className={badgeClass(k)}>
                  {counts[k]}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                {k === 'blocked' ? (
                  <span className="inline-flex items-center gap-1 text-red-700">
                    <AlertTriangle className="h-3 w-3" /> Requires explicit reason in issue body.
                  </span>
                ) : (
                  <span>Resume point is parsed from the first <span className="font-mono">NEXT:</span> line.</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(columns?.[k] || []).length === 0 ? (
                <div className="text-sm text-slate-500">No issues.</div>
              ) : (
                (columns[k] || []).slice(0, 25).map((issue) => (
                  <IssueCard key={issue.id} issue={issue} columnKey={k} />
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default GitHubIssuesBoard;
