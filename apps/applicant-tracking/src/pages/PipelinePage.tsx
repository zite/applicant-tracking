import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronDown, Filter, SlidersHorizontal, UserPlus, Users, X } from 'lucide-react';
import { listPipeline, moveApplication, type ListPipelineOutputType } from 'zitejs/api';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@project/components/ui/dropdown-menu';
import { PipelineBoard } from '../components/PipelineBoard';
import { PageHeader, EmptyState } from '../components/PageHeader';
import { useBootstrap, memberMap } from '../lib/queries';
import { useAppActions } from '../lib/appActions';
import { StageEditorDialog } from '../components/StageEditorDialog';
import { priorityTone } from '../lib/format';

export function PipelinePage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const include = params.get('include') === 'all' ? 'all' : 'active';

  const boot = useBootstrap();
  const jobs = boot.data?.jobs ?? [];
  const { openAddCandidate } = useAppActions();
  const [stagesOpen, setStagesOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [attentionOnly, setAttentionOnly] = useState(false);
  const members = memberMap(boot.data?.team);

  // Land on the busiest open pipeline rather than an empty chooser.
  useEffect(() => {
    if (!jobId && jobs.length > 0) {
      const first = jobs.find((j) => j.status === 'Open') ?? jobs[0];
      navigate(`/pipeline/${first.id}`, { replace: true });
    }
  }, [jobId, jobs, navigate]);

  const job = jobs.find((j) => j.id === jobId);
  const key = ['pipeline', jobId, include] as const;

  const pipeline = useQuery({
    queryKey: key,
    queryFn: () => listPipeline({ jobId: jobId!, include }),
    enabled: Boolean(jobId),
    staleTime: 15_000,
  });

  const move = useMutation({
    mutationFn: (vars: { applicationId: string; stageId: string; fromStageId?: string | null; silent?: boolean }) =>
      moveApplication({ applicationId: vars.applicationId, stageId: vars.stageId }),
    // Dragging is the highest-frequency action on this screen, so it applies
    // locally first and rolls back only if the write actually fails.
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ListPipelineOutputType>(key);
      queryClient.setQueryData<ListPipelineOutputType>(key, (old) =>
        old
          ? {
              ...old,
              cards: old.cards.map((c) =>
                c.id === vars.applicationId ? { ...c, stageId: vars.stageId, daysInStage: 0 } : c,
              ),
            }
          : old,
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      toast.error('Could not move that candidate');
    },
    onSuccess: (result, vars) => {
      if (result.status === 'Hired') toast.success('Marked as hired');
      else if (result.status === 'Rejected') toast('Moved to rejected');
      // A drag is easy to misfire, so offer the way back rather than making the
      // user find the original column again.
      if (!vars.silent && vars.fromStageId && vars.fromStageId !== vars.stageId) {
        const back = vars.fromStageId;
        toast('Moved', {
          action: {
            label: 'Undo',
            onClick: () =>
              move.mutate({ applicationId: vars.applicationId, stageId: back, silent: true }),
          },
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['bootstrap'] });
    },
  });

  // Filtering happens on the client: the board already has every card, so a
  // round trip per keystroke would make it feel slower, not faster.
  const needle = filter.trim().toLowerCase();
  const visibleCards = (pipeline.data?.cards ?? []).filter((c) => {
    if (ownerFilter && c.ownerId !== ownerFilter) return false;
    if (attentionOnly && c.scorecardsDue === 0 && c.daysInStage < 7) return false;
    if (!needle) return true;
    return (
      c.name.toLowerCase().includes(needle) ||
      (c.company ?? '').toLowerCase().includes(needle) ||
      (c.headline ?? '').toLowerCase().includes(needle)
    );
  });

  if (boot.isPending) return <div className="flex-1" />;

  if (jobs.length === 0) {
    return (
      <>
        <PageHeader title="Pipeline" />
        <EmptyState
          title="No jobs yet"
          body="Create a job to start a pipeline. Each job gets its own stages, interview kits and board."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1.5 rounded px-1 py-0.5 outline-none transition hover:bg-accent">
              <span className="truncate">{job?.title ?? 'Select a pipeline'}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              {jobs.map((j) => (
                <DropdownMenuItem
                  key={j.id}
                  onSelect={() => navigate(`/pipeline/${j.id}`)}
                  className="gap-2"
                >
                  <span className={`text-[15px] leading-none ${priorityTone(j.priority)}`}>•</span>
                  <span className="truncate">{j.title}</span>
                  <span className="ml-auto text-[11px] text-muted-foreground">{j.activeCount}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        }
        subtitle={
          job
            ? `${job.department ?? '—'} · ${job.location ?? '—'} · ${job.activeCount} active of ${job.totalCount} total`
            : undefined
        }
      >
        <div className="flex items-center rounded-md border border-border p-0.5">
          {(['active', 'all'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setParams(v === 'active' ? {} : { include: 'all' }, { replace: true })}
              className={`rounded px-2 py-1 text-[11.5px] capitalize transition ${
                include === v
                  ? 'bg-accent font-medium text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => navigate(`/candidates?jobId=${jobId}`)}
          className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11.5px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <Users className="h-3.5 w-3.5" />
          Table
        </button>
        <button
          type="button"
          onClick={() => setStagesOpen(true)}
          disabled={!pipeline.data}
          className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11.5px] text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-40"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Stages
        </button>
        <button
          type="button"
          onClick={() => openAddCandidate(jobId)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-[11.5px] font-medium text-primary-foreground transition hover:opacity-90"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Add
        </button>
      </PageHeader>

      {pipeline.data && pipeline.data.cards.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter this board…"
            aria-label="Filter the board"
            className="w-48 rounded-md border border-input bg-transparent px-2 py-1 text-[11.5px] outline-none focus:border-primary/60"
          />
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            aria-label="Filter by owner"
            className="rounded-md border border-input bg-transparent px-2 py-1 text-[11.5px] text-muted-foreground outline-none focus:border-primary/60"
          >
            <option value="">Any owner</option>
            {[...members.values()].map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setAttentionOnly((v) => !v)}
            className={`rounded-md border px-2 py-1 text-[11.5px] transition ${
              attentionOnly
                ? 'border-tone-warning/30 bg-tone-warning/10 text-tone-warning'
                : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            Needs attention
          </button>
          {(filter || ownerFilter || attentionOnly) && (
            <button
              type="button"
              onClick={() => { setFilter(''); setOwnerFilter(''); setAttentionOnly(false); }}
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11.5px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
          <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
            {visibleCards.length} of {pipeline.data.cards.length} shown
          </span>
        </div>
      )}

      {pipeline.isPending ? (
        <div className="flex gap-3 overflow-hidden px-4 pt-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-[272px] shrink-0 space-y-2">
              <div className="h-5 w-32 rounded skeleton-shimmer" />
              {Array.from({ length: 3 }).map((__, j) => (
                <div
                  key={j}
                  className="h-[88px] rounded-lg skeleton-shimmer"
                  style={{ opacity: 1 - j * 0.22 }}
                />
              ))}
            </div>
          ))}
        </div>
      ) : pipeline.data && pipeline.data.stages.length > 0 ? (
        <div className="min-h-0 flex-1 pt-3 animate-fade-rise">
          <PipelineBoard
            stages={pipeline.data.stages}
            cards={visibleCards}
            onOpen={(c) => navigate(`/candidate/${c.id}`)}
            onMove={(applicationId, stageId) => {
              const from = pipeline.data?.cards.find((c) => c.id === applicationId)?.stageId;
              move.mutate({ applicationId, stageId, fromStageId: from });
            }}
          />
        </div>
      ) : (
        <EmptyState
          title="This job has no stages"
          body="Add a pipeline so candidates have somewhere to go."
          action={
            <button
              type="button"
              onClick={() => setStagesOpen(true)}
              className="rounded-md bg-primary px-3 py-1.5 text-[12.5px] font-medium text-primary-foreground transition hover:opacity-90"
            >
              Set up stages
            </button>
          }
        />
      )}

      {jobId && (
        <StageEditorDialog
          open={stagesOpen}
          onOpenChange={setStagesOpen}
          jobId={jobId}
          jobTitle={job?.title ?? 'this job'}
          stages={pipeline.data?.stages ?? []}
        />
      )}
    </>
  );
}
