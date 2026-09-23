import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { upsertJob } from 'zitejs/api';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@project/components/ui/dialog';
import { Field, DialogActions } from './Field';
import { parseApiError } from '../lib/validation';
import type { JobSummary, TeamMember } from '../lib/queries';

const DEPARTMENTS = ['Engineering', 'Product', 'Design', 'Sales', 'Marketing', 'Operations', 'Finance', 'People'];
const WORKPLACE = ['Remote', 'Hybrid', 'On-site'] as const;
const EMPLOYMENT = ['Full-time', 'Part-time', 'Contract', 'Internship'] as const;
const STATUS = ['Draft', 'Open', 'Paused', 'Closed', 'Filled'] as const;
const PRIORITY = ['Low', 'Medium', 'High', 'Critical'] as const;

type Draft = {
  title: string;
  department: string;
  team: string;
  location: string;
  workplaceType: (typeof WORKPLACE)[number];
  employmentType: (typeof EMPLOYMENT)[number];
  status: (typeof STATUS)[number];
  priority: (typeof PRIORITY)[number];
  published: boolean;
  openings: number;
  salaryMin: string;
  salaryMax: string;
  description: string;
  requirements: string;
  benefits: string;
  hiringManagerId: string;
  recruiterId: string;
};

const blank = (): Draft => ({
  title: '', department: 'Engineering', team: '', location: 'Remote (US)',
  workplaceType: 'Remote', employmentType: 'Full-time', status: 'Draft',
  priority: 'Medium', published: false, openings: 1, salaryMin: '', salaryMax: '',
  description: '', requirements: '', benefits: '', hiringManagerId: '', recruiterId: '',
});

export function JobFormDialog({
  open,
  onOpenChange,
  job,
  team,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  job: JobSummary | null;
  team: TeamMember[];
}) {
  const queryClient = useQueryClient();
  const [d, setD] = useState<Draft>(blank);
  const [showProblems, setShowProblems] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Cross-field rules the server also enforces — checked here so the user is
  // told before a round trip, not after one.
  const min = d.salaryMin ? Number(d.salaryMin) : null;
  const max = d.salaryMax ? Number(d.salaryMax) : null;
  const problems: Partial<Record<keyof Draft, string>> = {};
  if (d.title.trim().length < 2) problems.title = 'A job needs a title of at least 2 characters';
  if (min != null && max != null && min > max) {
    problems.salaryMax = 'The top of the range must be at least the bottom';
  }
  const problemCount = Object.keys(problems).length;
  const errorFor = (k: keyof Draft) => (showProblems ? problems[k] ?? null : null);

  // Editing only exposes what the bootstrap summary carries; the long-form copy
  // is left untouched rather than being blanked by a partial save.
  useEffect(() => {
    if (!open) return;
    setD(
      job
        ? {
            ...blank(),
            title: job.title,
            department: job.department ?? 'Engineering',
            location: job.location ?? '',
            workplaceType: (job.workplaceType as Draft['workplaceType']) ?? 'Remote',
            employmentType: (job.employmentType as Draft['employmentType']) ?? 'Full-time',
            status: (job.status as Draft['status']) ?? 'Draft',
            priority: (job.priority as Draft['priority']) ?? 'Medium',
            published: job.published,
            openings: job.openings,
            salaryMin: job.salaryMin != null ? String(job.salaryMin) : '',
            salaryMax: job.salaryMax != null ? String(job.salaryMax) : '',
            hiringManagerId: job.hiringManagerId ?? '',
            recruiterId: job.recruiterId ?? '',
          }
        : blank(),
    );
  }, [open, job]);

  const save = useMutation({
    mutationFn: () =>
      upsertJob({
        jobId: job?.id,
        title: d.title.trim(),
        department: d.department,
        team: d.team.trim() || undefined,
        location: d.location.trim() || undefined,
        workplaceType: d.workplaceType,
        employmentType: d.employmentType,
        status: d.status,
        priority: d.priority,
        published: d.published,
        openings: d.openings,
        salaryMin: d.salaryMin ? Number(d.salaryMin) : undefined,
        salaryMax: d.salaryMax ? Number(d.salaryMax) : undefined,
        description: d.description.trim() || undefined,
        requirements: d.requirements.trim() || undefined,
        benefits: d.benefits.trim() || undefined,
        hiringManagerId: d.hiringManagerId || null,
        recruiterId: d.recruiterId || null,
      }),
    onSuccess: (r) => {
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ['bootstrap'] });
      queryClient.invalidateQueries({ queryKey: ['publicJobs'] });
      toast.success(
        job ? 'Job updated' : `Job created with ${r.stagesCreated} pipeline stages`,
      );
    },
    onError: (e) => setFormError(parseApiError(e).message || 'Could not save that job'),
  });

  const onSubmit = () => {
    setFormError(null);
    setShowProblems(true);
    if (problemCount > 0) {
      const first = Object.keys(problems)[0];
      const el = document.querySelector<HTMLElement>(`[name="${first}"]`);
      el?.focus();
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    save.mutate();
  };

  const input =
    'w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-[12.5px] outline-none focus:border-primary/60';
  const lbl = 'mb-1 block text-[11px] text-muted-foreground';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[14px]">{job ? 'Edit job' : 'New job'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="title" label="Title" required error={errorFor('title')} className="sm:col-span-2">
            {(p) => (
              <input {...p} autoFocus placeholder="Senior Full-Stack Engineer"
                value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
            )}
          </Field>
          <label>
            <span className={lbl}>Department</span>
            <select value={d.department} onChange={(e) => setD({ ...d, department: e.target.value })} className={input}>
              {DEPARTMENTS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </label>
          <label>
            <span className={lbl}>Team</span>
            <input value={d.team} onChange={(e) => setD({ ...d, team: e.target.value })} className={input} placeholder="Core Product" />
          </label>
          <label>
            <span className={lbl}>Location</span>
            <input value={d.location} onChange={(e) => setD({ ...d, location: e.target.value })} className={input} />
          </label>
          <label>
            <span className={lbl}>Workplace</span>
            <select value={d.workplaceType} onChange={(e) => setD({ ...d, workplaceType: e.target.value as Draft['workplaceType'] })} className={input}>
              {WORKPLACE.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </label>
          <label>
            <span className={lbl}>Employment</span>
            <select value={d.employmentType} onChange={(e) => setD({ ...d, employmentType: e.target.value as Draft['employmentType'] })} className={input}>
              {EMPLOYMENT.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </label>
          <label>
            <span className={lbl}>Openings</span>
            <input type="number" min={1} value={d.openings} onChange={(e) => setD({ ...d, openings: Number(e.target.value) })} className={input} />
          </label>
          <label>
            <span className={lbl}>Status</span>
            <select value={d.status} onChange={(e) => setD({ ...d, status: e.target.value as Draft['status'] })} className={input}>
              {STATUS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </label>
          <label>
            <span className={lbl}>Priority</span>
            <select value={d.priority} onChange={(e) => setD({ ...d, priority: e.target.value as Draft['priority'] })} className={input}>
              {PRIORITY.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </label>
          <label>
            <span className={lbl}>Salary min</span>
            <input type="number" value={d.salaryMin} onChange={(e) => setD({ ...d, salaryMin: e.target.value })} className={input} placeholder="180000" />
          </label>
          <Field id="salaryMax" label="Salary max" error={errorFor('salaryMax')}>
            {(p) => (
              <input {...p} type="number" inputMode="numeric" placeholder="230000"
                value={d.salaryMax} onChange={(e) => setD({ ...d, salaryMax: e.target.value })} />
            )}
          </Field>
          <label>
            <span className={lbl}>Hiring manager</span>
            <select value={d.hiringManagerId} onChange={(e) => setD({ ...d, hiringManagerId: e.target.value })} className={input}>
              <option value="">Unassigned</option>
              {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <label>
            <span className={lbl}>Recruiter</span>
            <select value={d.recruiterId} onChange={(e) => setD({ ...d, recruiterId: e.target.value })} className={input}>
              <option value="">Unassigned</option>
              {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>

          {!job && (
            <>
              <label className="sm:col-span-2">
                <span className={lbl}>Description</span>
                <textarea rows={4} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} className={`${input} resize-none`} placeholder="What the role is, and what the first six months look like." />
              </label>
              <label className="sm:col-span-2">
                <span className={lbl}>Requirements — one per line, starting with “-”</span>
                <textarea rows={3} value={d.requirements} onChange={(e) => setD({ ...d, requirements: e.target.value })} className={`${input} resize-none`} placeholder={'- 6+ years building production web applications\n- Deep TypeScript and React experience'} />
              </label>
              <label className="sm:col-span-2">
                <span className={lbl}>Benefits — one per line, starting with “-”</span>
                <textarea rows={3} value={d.benefits} onChange={(e) => setD({ ...d, benefits: e.target.value })} className={`${input} resize-none`} />
              </label>
            </>
          )}
        </div>

        <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
          <input
            type="checkbox"
            checked={d.published}
            onChange={(e) => setD({ ...d, published: e.target.checked })}
            className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
          />
          <span className="text-[12.5px]">Publish to the careers site</span>
          <span className="ml-auto text-[11px] text-muted-foreground">
            Only Open and Paused jobs appear publicly
          </span>
        </label>

        <DialogActions
          onCancel={() => onOpenChange(false)}
          onSubmit={onSubmit}
          submitLabel={job ? 'Save job' : 'Create job'}
          pending={save.isPending}
          problemCount={showProblems ? problemCount : 0}
          error={formError}
        />
      </DialogContent>
    </Dialog>
  );
}
