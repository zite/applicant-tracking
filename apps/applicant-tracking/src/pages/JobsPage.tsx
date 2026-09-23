import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Globe, Lock, Pencil, Plus } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { PageHeader, EmptyState } from '../components/PageHeader';
import { JobFormDialog } from '../components/JobFormDialog';
import { useBootstrap, memberMap, type JobSummary } from '../lib/queries';
import { dayLabel, priorityTone, salaryRange } from '../lib/format';

const statusTone = (s: string | null) => {
  switch (s) {
    case 'Open': return 'border-tone-success/30 bg-tone-success/10 text-tone-success';
    case 'Paused': return 'border-tone-warning/30 bg-tone-warning/10 text-tone-warning';
    case 'Draft': return 'border-border bg-muted text-muted-foreground';
    case 'Filled': return 'border-tone-info/30 bg-tone-info/10 text-tone-info';
    default: return 'border-border bg-muted text-muted-foreground';
  }
};

export function JobsPage() {
  const navigate = useNavigate();
  const boot = useBootstrap();
  const members = memberMap(boot.data?.team);
  const jobs = boot.data?.jobs ?? [];
  const [editing, setEditing] = useState<JobSummary | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader title="Jobs" subtitle={`${jobs.filter((j) => j.status === 'Open').length} open`}>
        <button
          type="button"
          onClick={openNew}
          className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-[12px] font-medium text-primary-foreground transition hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          New job
        </button>
      </PageHeader>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {jobs.length === 0 ? (
          <EmptyState
            title="No jobs yet"
            body="Create your first job to open a pipeline. Each new job gets a seven-stage pipeline with interview kits you can edit."
            action={
              <button
                type="button"
                onClick={openNew}
                className="rounded-md bg-primary px-3 py-1.5 text-[12.5px] font-medium text-primary-foreground transition hover:opacity-90"
              >
                Create a job
              </button>
            }
          />
        ) : (
          <div className="mx-auto grid max-w-5xl gap-2.5 animate-fade-rise">
            {jobs.map((j) => {
              const hm = j.hiringManagerId ? members.get(j.hiringManagerId) : undefined;
              const rec = j.recruiterId ? members.get(j.recruiterId) : undefined;
              const pay = salaryRange(j.salaryMin, j.salaryMax);
              return (
                <div
                  key={j.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open the ${j.title} pipeline`}
                  onClick={() => navigate(`/pipeline/${j.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/pipeline/${j.id}`);
                    }
                  }}
                  className="card-hover cursor-pointer rounded-lg border border-border bg-card p-3.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[16px] leading-none ${priorityTone(j.priority)}`} title={`${j.priority} priority`}>
                      •
                    </span>
                    <span className="text-[13.5px] font-medium">{j.title}</span>
                    <span className={`rounded border px-1.5 py-px text-[10.5px] font-medium ${statusTone(j.status)}`}>
                      {j.status}
                    </span>
                    <span
                      className="flex items-center gap-1 text-[11px] text-muted-foreground"
                      title={j.published ? 'Live on the careers site' : 'Not published'}
                    >
                      {j.published ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                      {j.published ? 'Published' : 'Internal'}
                    </span>
                    <span className="ml-auto flex items-center gap-3 text-[11.5px] text-muted-foreground">
                      <span>
                        <span className="font-medium text-foreground">{j.activeCount}</span> active
                      </span>
                      <span>{j.totalCount} total</span>
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-muted-foreground">
                    <span>{j.department ?? '—'}</span>
                    <span>{j.location ?? '—'}</span>
                    <span>{j.workplaceType ?? '—'}</span>
                    <span>{j.employmentType ?? '—'}</span>
                    {pay && <span className="tabular-nums">{pay}</span>}
                    <span>
                      {j.openings} opening{j.openings === 1 ? '' : 's'}
                    </span>
                    <span>Opened {dayLabel(j.openedDate)}</span>
                    <span className="ml-auto flex items-center gap-3">
                      {hm && (
                        <span className="flex items-center gap-1.5" title={`Hiring manager: ${hm.name}`}>
                          <Avatar name={hm.name} src={hm.avatarUrl} size={18} />
                          {hm.name}
                        </span>
                      )}
                      {rec && (
                        <span className="flex items-center gap-1.5" title={`Recruiter: ${rec.name}`}>
                          <Avatar name={rec.name} src={rec.avatarUrl} size={18} />
                          {rec.name}
                        </span>
                      )}
                      <button
                        type="button"
                        aria-label={`Edit ${j.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(j);
                          setFormOpen(true);
                        }}
                        className="rounded p-1 transition hover:bg-accent hover:text-foreground"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <ExternalLink className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <JobFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        job={editing}
        team={boot.data?.team ?? []}
      />
    </>
  );
}
