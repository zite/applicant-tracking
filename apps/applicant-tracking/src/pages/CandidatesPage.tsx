import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from 'use-debounce';
import { toast } from 'sonner';
import { Download, Search, UserPlus, X } from 'lucide-react';
import {
  bulkUpdateApplications, getApplication, listCandidates, listPipeline,
} from 'zitejs/api';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@project/components/ui/dropdown-menu';
import { Avatar } from '../components/Avatar';
import { Rating } from '../components/Rating';
import { PageHeader } from '../components/PageHeader';
import { RejectDialog } from '../components/RejectDialog';
import { useBootstrap, memberMap } from '../lib/queries';
import { useAppActions } from '../lib/appActions';
import { dayLabel, statusTone } from '../lib/format';

const SORTS = [
  ['recent', 'Recent'], ['stage', 'Stage'], ['rating', 'Rating'], ['name', 'Name'],
] as const;

// Columns drop away as the viewport narrows rather than compressing into an
// unreadable smear; name and status survive to the smallest size.
const GRID =
  'grid items-center gap-3 grid-cols-[28px_minmax(0,1fr)_86px] ' +
  'sm:grid-cols-[28px_minmax(0,2fr)_110px_86px] ' +
  'lg:grid-cols-[28px_minmax(180px,2fr)_minmax(120px,1.3fr)_110px_86px_74px_84px]';

export function CandidatesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const boot = useBootstrap();
  const members = memberMap(boot.data?.team);
  const { openAddCandidate } = useAppActions();

  const [search, setSearch] = useState('');
  const [debounced] = useDebounce(search, 200);
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<number | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const rowsRef = useRef<HTMLDivElement>(null);

  const jobId = params.get('jobId') ?? undefined;
  const status = params.get('status') ?? undefined;
  const sort = (params.get('sort') ?? 'recent') as (typeof SORTS)[number][0];

  const setParam = (k: string, v?: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  const list = useQuery({
    queryKey: ['candidates', { debounced, jobId, status, sort }],
    queryFn: () =>
      listCandidates({ search: debounced || undefined, jobId, status, sort, limit: 100 }),
    staleTime: 15_000,
  });
  const rows = useMemo(() => list.data?.rows ?? [], [list.data]);

  // Bulk stage moves only make sense inside one pipeline — stages belong to a
  // job, so "move to Onsite" is meaningless across a mixed selection.
  const pipeline = useQuery({
    queryKey: ['pipeline', jobId, 'active'],
    queryFn: () => listPipeline({ jobId: jobId!, include: 'active' }),
    enabled: Boolean(jobId),
    staleTime: 30_000,
  });

  useEffect(() => {
    setCursor(0);
    setSelected(new Set());
    setAnchor(null);
  }, [debounced, jobId, status, sort]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectRange = useCallback(
    (from: number, to: number) => {
      const [lo, hi] = from < to ? [from, to] : [to, from];
      setSelected((prev) => {
        const next = new Set(prev);
        for (let i = lo; i <= hi; i++) {
          const r = rows[i];
          if (r) next.add(r.applicationId);
        }
        return next;
      });
    },
    [rows],
  );

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.applicationId));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (rows.length === 0) return;

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, rows.length - 1));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (e.key === 'x') {
        e.preventDefault();
        const row = rows[cursor];
        if (row) {
          toggle(row.applicationId);
          setAnchor(cursor);
        }
      } else if (e.key === 'Escape') {
        if (selected.size > 0) {
          e.preventDefault();
          setSelected(new Set());
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const row = rows[cursor];
        if (row) navigate(`/candidate/${row.applicationId}`);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rows, cursor, navigate, toggle, selected.size]);

  useEffect(() => {
    rowsRef.current
      ?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const prefetch = (applicationId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['application', applicationId],
      queryFn: () => getApplication({ applicationId }),
      staleTime: 30_000,
    });
  };

  const bulk = useMutation({
    mutationFn: (vars: Parameters<typeof bulkUpdateApplications>[0] & { undo?: () => void }) =>
      bulkUpdateApplications(vars),
    onSuccess: (r, vars) => {
      queryClient.invalidateQueries();
      setSelected(new Set());
      const noun = `${r.updated} candidate${r.updated === 1 ? '' : 's'}`;
      if (r.failed > 0) {
        // A partial batch is not a success — say so rather than burying it.
        toast.warning(`${noun} updated, ${r.failed} could not be`, {
          description: 'The ones that failed were left unchanged.',
        });
      } else {
        toast.success(`${noun} updated`, {
          action: vars.undo ? { label: 'Undo', onClick: vars.undo } : undefined,
        });
      }
    },
    onError: () => toast.error('Could not apply that change'),
  });

  // Bulk changes apply instantly, so each one hands back the way out. A move can
  // span several original stages, so the undo replays one call per stage rather
  // than dumping everyone into a single column.
  const snapshot = (field: 'stageId' | 'ownerId' | 'rating') =>
    rows
      .filter((r) => selected.has(r.applicationId))
      .reduce<Map<string | number | null, string[]>>((acc, r) => {
        const key = r[field] ?? null;
        acc.set(key, [...(acc.get(key) ?? []), r.applicationId]);
        return acc;
      }, new Map());

  const undoGrouped = (
    groups: Map<string | number | null, string[]>,
    build: (key: string | number | null, ids: string[]) => Parameters<typeof bulkUpdateApplications>[0],
  ) => () => {
    groups.forEach((ids, key) => bulk.mutate(build(key, ids)));
  };

  const ids = [...selected];

  // Export what is on screen — the current filter and sort, not the whole table.
  // A recruiter exporting "engineering, rejected, last month" wants exactly that.
  const exportCsv = () => {
    const source = selected.size > 0 ? rows.filter((r) => selected.has(r.applicationId)) : rows;
    if (source.length === 0) {
      toast('Nothing to export');
      return;
    }
    const headers = ['Name', 'Email', 'Title', 'Company', 'Location', 'Role', 'Stage', 'Status', 'Rating', 'Days in stage', 'Source', 'Owner', 'Applied'];
    const cell = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      headers.join(','),
      ...source.map((r) =>
        [
          r.name, r.email, r.headline, r.company, r.location, r.jobTitle, r.stageName,
          r.status, r.rating, r.daysInStage, r.source,
          r.ownerId ? members.get(r.ownerId)?.name ?? '' : '', r.appliedDate,
        ].map(cell).join(','),
      ),
    ];
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `candidates-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${source.length} row${source.length === 1 ? '' : 's'}`);
  };
  const selectCls =
    'rounded-md border border-input bg-transparent px-2 py-1 text-[11.5px] text-muted-foreground outline-none transition hover:bg-accent focus:border-primary/60';

  return (
    <>
      <PageHeader title="Candidates" subtitle={list.data ? `${list.data.total} matching` : undefined}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, company, email…"
            aria-label="Search candidates"
            className="w-56 rounded-md border border-input bg-transparent py-1 pl-7 pr-7 text-[12px] outline-none focus:border-primary/60"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Clear search"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <select value={jobId ?? ''} onChange={(e) => setParam('jobId', e.target.value || undefined)} className={selectCls} aria-label="Filter by job">
          <option value="">All jobs</option>
          {(boot.data?.jobs ?? []).map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select>

        <select value={status ?? ''} onChange={(e) => setParam('status', e.target.value || undefined)} className={selectCls} aria-label="Filter by status">
          <option value="">Any status</option>
          {['Active', 'Hired', 'Rejected', 'Withdrawn', 'On Hold'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={sort} onChange={(e) => setParam('sort', e.target.value)} className={selectCls} aria-label="Sort">
          {SORTS.map(([v, label]) => <option key={v} value={v}>Sort: {label}</option>)}
        </select>

        <button
          type="button"
          onClick={exportCsv}
          aria-label="Export to CSV"
          title="Export the current view to CSV"
          className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11.5px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
        <button
          type="button"
          onClick={() => openAddCandidate(jobId)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-[12px] font-medium text-primary-foreground transition hover:opacity-90"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Add
        </button>
      </PageHeader>

      <div className="min-h-0 flex-1 overflow-y-auto" ref={rowsRef}>
        <div className={`sticky top-0 z-[1] border-b border-border bg-background px-4 py-2 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground ${GRID}`}>
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() =>
              setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.applicationId)))
            }
            aria-label="Select all"
            className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
          />
          <span>Candidate</span>
          <span className="hidden lg:block">Role</span>
          <span className="hidden sm:block">Stage</span>
          <span>Status</span>
          <span className="hidden lg:block">Rating</span>
          <span className="hidden text-right lg:block">Applied</span>
        </div>

        {list.isPending ? (
          <div className="space-y-px p-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-11 rounded skeleton-shimmer" style={{ opacity: 1 - i * 0.06 }} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="grid place-items-center py-20 text-center">
            <div className="max-w-xs">
              <div className="mb-1 text-[13.5px] font-medium">No candidates match</div>
              <p className="mb-4 text-[12.5px] text-muted-foreground">
                Try clearing the filters, or add someone you have sourced.
              </p>
              <button
                type="button"
                onClick={() => openAddCandidate(jobId)}
                className="rounded-md bg-primary px-3 py-1.5 text-[12.5px] font-medium text-primary-foreground transition hover:opacity-90"
              >
                Add a candidate
              </button>
            </div>
          </div>
        ) : (
          rows.map((r, i) => {
            const isSelected = selected.has(r.applicationId);
            return (
              <div
                key={r.applicationId}
                data-index={i}
                role="button"
                tabIndex={-1}
                aria-selected={isSelected}
                onMouseEnter={() => {
                  setCursor(i);
                  prefetch(r.applicationId);
                }}
                onClick={(e) => {
                  // Shift-click extends from the last checkbox touched — the
                  // standard list-triage gesture.
                  if (e.shiftKey && anchor !== null) {
                    e.preventDefault();
                    selectRange(anchor, i);
                    return;
                  }
                  navigate(`/candidate/${r.applicationId}`);
                }}
                className={`row-hover cursor-pointer border-b border-border/60 px-4 py-2 ${GRID} ${
                  isSelected ? 'bg-primary/8' : i === cursor ? 'bg-accent/60' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  aria-label={`Select ${r.name}`}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => {
                    toggle(r.applicationId);
                    setAnchor(i);
                  }}
                  className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
                />
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={r.name} src={r.avatarUrl} size={26} />
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium leading-tight">{r.name}</div>
                    <div className="truncate text-[11.5px] text-muted-foreground">
                      {r.headline ?? '—'}{r.company ? ` · ${r.company}` : ''}
                    </div>
                  </div>
                </div>
                <div className="hidden truncate text-[12.5px] text-muted-foreground lg:block">{r.jobTitle ?? '—'}</div>
                <div className="hidden truncate text-[12.5px] sm:block">
                  {r.stageName ?? '—'}
                  <span className="ml-1.5 text-[11px] text-muted-foreground">{r.daysInStage}d</span>
                </div>
                <div>
                  <span className={`rounded border px-1.5 py-px text-[10.5px] font-medium ${statusTone(r.status)}`}>
                    {r.status}
                  </span>
                </div>
                <div className="hidden lg:block"><Rating value={r.rating} size={11} /></div>
                <div className="hidden text-right text-[11.5px] tabular-nums text-muted-foreground lg:block">
                  {dayLabel(r.appliedDate)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {selected.size > 0 ? (
        <div className="flex h-12 shrink-0 items-center gap-2 border-t border-border bg-card px-4 animate-fade-rise">
          <span className="text-[12.5px] font-medium">
            {selected.size} selected
          </span>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="rounded-md px-2 py-1 text-[11.5px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            Clear
          </button>

          <div className="ml-auto flex items-center gap-2">
            {jobId && (pipeline.data?.stages.length ?? 0) > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger className="rounded-md border border-border px-2 py-1 text-[11.5px] text-muted-foreground transition hover:bg-accent hover:text-foreground">
                  Move to stage
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {pipeline.data!.stages.map((s) => (
                    <DropdownMenuItem
                      key={s.id}
                      onSelect={() => {
                        const before = snapshot('stageId');
                        bulk.mutate({
                          applicationIds: ids,
                          op: 'move',
                          stageId: s.id,
                          undo: undoGrouped(before, (stageId, group) => ({
                            applicationIds: group,
                            op: 'move',
                            stageId: String(stageId ?? s.id),
                          })),
                        });
                      }}
                    >
                      {s.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger className="rounded-md border border-border px-2 py-1 text-[11.5px] text-muted-foreground transition hover:bg-accent hover:text-foreground">
                Assign
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                <DropdownMenuLabel className="text-[11px]">Owner</DropdownMenuLabel>
                <DropdownMenuItem
                  onSelect={() => {
                    const before = snapshot('ownerId');
                    bulk.mutate({
                      applicationIds: ids, op: 'assign', ownerId: null,
                      undo: undoGrouped(before, (ownerId, group) => ({
                        applicationIds: group, op: 'assign',
                        ownerId: ownerId ? String(ownerId) : null,
                      })),
                    });
                  }}
                >
                  Unassigned
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {[...members.values()].map((m) => (
                  <DropdownMenuItem
                    key={m.id}
                    onSelect={() => {
                      const before = snapshot('ownerId');
                      bulk.mutate({
                        applicationIds: ids, op: 'assign', ownerId: m.id,
                        undo: undoGrouped(before, (ownerId, group) => ({
                          applicationIds: group, op: 'assign',
                          ownerId: ownerId ? String(ownerId) : null,
                        })),
                      });
                    }}
                  >
                    {m.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger className="rounded-md border border-border px-2 py-1 text-[11.5px] text-muted-foreground transition hover:bg-accent hover:text-foreground">
                Rate
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {[4, 3, 2, 1, 0].map((n) => (
                  <DropdownMenuItem
                    key={n}
                    onSelect={() => {
                      const before = snapshot('rating');
                      bulk.mutate({
                        applicationIds: ids, op: 'rate', rating: n,
                        undo: undoGrouped(before, (rating, group) => ({
                          applicationIds: group, op: 'rate', rating: Number(rating ?? 0),
                        })),
                      });
                    }}
                  >
                    {n === 0 ? 'Clear rating' : `${n} of 4`}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              type="button"
              onClick={exportCsv}
              className="rounded-md border border-border px-2 py-1 text-[11.5px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              Export
            </button>
            <button
              type="button"
              onClick={() => setRejectOpen(true)}
              className="rounded-md border border-destructive/40 px-2 py-1 text-[11.5px] text-destructive transition hover:bg-destructive/10"
            >
              Reject
            </button>
          </div>
        </div>
      ) : (
        <div className="flex h-8 shrink-0 items-center gap-3 border-t border-border px-4 text-[10.5px] text-muted-foreground">
          <span><span className="kbd">J</span> <span className="kbd">K</span> navigate</span>
          <span><span className="kbd">X</span> select</span>
          <span><span className="kbd">↵</span> open</span>
          <span><span className="kbd">⌘K</span> search everything</span>
        </div>
      )}

      <RejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        applicationIds={ids}
        candidateName={ids.length === 1 ? rows.find((r) => r.applicationId === ids[0])?.name : undefined}
        jobTitle={ids.length === 1 ? rows.find((r) => r.applicationId === ids[0])?.jobTitle : undefined}
        onDone={() => setSelected(new Set())}
      />
    </>
  );
}
