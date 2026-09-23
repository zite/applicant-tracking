import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';
import { createCandidate } from 'zitejs/api';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@project/components/ui/dialog';
import { Field, DialogActions } from './Field';
import {
  all, isEmail, isUrl, minLength, normalizeUrl, parseApiError, required, useFormValidation,
} from '../lib/validation';
import type { JobSummary } from '../lib/queries';

const SOURCES = ['Sourced', 'Referral', 'Agency', 'Event', 'Inbound', 'Applied'] as const;

type Draft = {
  jobId: string; fullName: string; email: string; phone: string; headline: string;
  currentCompany: string; location: string; linkedInUrl: string; resumeUrl: string;
  source: string; sourceDetail: string; note: string;
};

const blank = (jobId: string): Draft => ({
  jobId, fullName: '', email: '', phone: '', headline: '', currentCompany: '',
  location: '', linkedInUrl: '', resumeUrl: '', source: 'Sourced', sourceDetail: '', note: '',
});

export function AddCandidateDialog({
  open, onOpenChange, jobs, defaultJobId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  jobs: JobSummary[];
  defaultJobId?: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const openJobs = jobs.filter((j) => j.status === 'Open' || j.status === 'Paused');
  const [d, setD] = useState<Draft>(() => blank(defaultJobId ?? openJobs[0]?.id ?? ''));
  const [formError, setFormError] = useState<string | null>(null);

  const v = useFormValidation(d, {
    jobId: required('A pipeline'),
    fullName: all(required('Name'), minLength(2, 'Name')),
    email: all(required('Email'), isEmail),
    linkedInUrl: isUrl,
    resumeUrl: isUrl,
  });

  useEffect(() => {
    if (!open) return;
    setD(blank(defaultJobId ?? openJobs[0]?.id ?? ''));
    setFormError(null);
    v.reset();
    // Re-seeding only on open keeps a half-typed entry from being wiped by a
    // background refetch of the job list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultJobId]);

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    v.clearServerError(k);
    setFormError(null);
    setD((prev) => ({ ...prev, [k]: e.target.value }));
  };
  const blurUrl = (k: keyof Draft) => () => {
    setD((prev) => ({ ...prev, [k]: prev[k] ? normalizeUrl(prev[k]) : '' }));
    v.onBlur(k);
  };

  const save = useMutation({
    mutationFn: () =>
      createCandidate({
        jobId: d.jobId,
        fullName: d.fullName.trim(),
        email: d.email.trim(),
        phone: d.phone.trim() || undefined,
        headline: d.headline.trim() || undefined,
        currentCompany: d.currentCompany.trim() || undefined,
        location: d.location.trim() || undefined,
        linkedInUrl: d.linkedInUrl.trim() ? normalizeUrl(d.linkedInUrl) : undefined,
        resumeUrl: d.resumeUrl.trim() ? normalizeUrl(d.resumeUrl) : undefined,
        source: d.source as (typeof SOURCES)[number],
        sourceDetail: d.sourceDetail.trim() || undefined,
        note: d.note.trim() || undefined,
      }),
    onSuccess: (r) => {
      onOpenChange(false);
      queryClient.invalidateQueries();
      toast.success(
        r.reusedExistingCandidate
          ? 'Added to this pipeline — we already had this person on file'
          : `${d.fullName.trim()} added`,
        { action: { label: 'Open', onClick: () => navigate(`/candidate/${r.applicationId}`) } },
      );
    },
    onError: (error) => {
      const { field, message } = parseApiError(error);
      if (field && field in d) v.applyServerError(field, message);
      else setFormError(message || 'Could not add that candidate');
    },
  });

  const onSubmit = () => {
    setFormError(null);
    if (!v.revealProblems()) return;
    save.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[14px]">
            <UserPlus className="h-4 w-4" /> Add a candidate
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2" onKeyDown={(e) => {
          // Enter submits from any single-line input, as it would in a real form.
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
            e.preventDefault();
            onSubmit();
          }
        }}>
          <Field id="jobId" label="Pipeline" required error={v.errorFor('jobId')} className="sm:col-span-2">
            {(p) => (
              <select {...p} value={d.jobId} onChange={set('jobId')} onBlur={() => v.onBlur('jobId')}>
                {openJobs.length === 0 && <option value="">No open jobs — create one first</option>}
                {openJobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            )}
          </Field>

          <Field id="fullName" label="Full name" required error={v.errorFor('fullName')}>
            {(p) => <input {...p} autoFocus value={d.fullName} onChange={set('fullName')} onBlur={() => v.onBlur('fullName')} />}
          </Field>

          <Field id="email" label="Email" required error={v.errorFor('email')}>
            {(p) => <input {...p} type="email" inputMode="email" value={d.email} onChange={set('email')} onBlur={() => v.onBlur('email')} />}
          </Field>

          <Field id="headline" label="Current title" error={v.errorFor('headline')}>
            {(p) => <input {...p} placeholder="Senior Engineer" value={d.headline} onChange={set('headline')} />}
          </Field>

          <Field id="currentCompany" label="Company" error={v.errorFor('currentCompany')}>
            {(p) => <input {...p} value={d.currentCompany} onChange={set('currentCompany')} />}
          </Field>

          <Field id="location" label="Location" error={v.errorFor('location')}>
            {(p) => <input {...p} value={d.location} onChange={set('location')} />}
          </Field>

          <Field id="phone" label="Phone" error={v.errorFor('phone')}>
            {(p) => <input {...p} type="tel" inputMode="tel" value={d.phone} onChange={set('phone')} />}
          </Field>

          <Field id="linkedInUrl" label="LinkedIn" error={v.errorFor('linkedInUrl')} hint="linkedin.com/in/them">
            {(p) => <input {...p} type="url" inputMode="url" value={d.linkedInUrl} onChange={set('linkedInUrl')} onBlur={blurUrl('linkedInUrl')} />}
          </Field>

          <Field id="resumeUrl" label="Resume link" error={v.errorFor('resumeUrl')}>
            {(p) => <input {...p} type="url" inputMode="url" value={d.resumeUrl} onChange={set('resumeUrl')} onBlur={blurUrl('resumeUrl')} />}
          </Field>

          <Field id="source" label="Source" error={v.errorFor('source')}>
            {(p) => (
              <select {...p} value={d.source} onChange={set('source')}>
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
          </Field>

          <Field id="sourceDetail" label="Source detail" error={v.errorFor('sourceDetail')}>
            {(p) => <input {...p} placeholder={d.source === 'Referral' ? 'Referred by…' : 'Where you found them'} value={d.sourceDetail} onChange={set('sourceDetail')} />}
          </Field>

          <Field id="note" label="Opening note" error={v.errorFor('note')} className="sm:col-span-2">
            {(p) => <textarea {...p} rows={3} className={`${p.className} resize-none`} placeholder="Why they are worth talking to." value={d.note} onChange={set('note')} />}
          </Field>
        </div>

        <DialogActions
          onCancel={() => onOpenChange(false)}
          onSubmit={onSubmit}
          submitLabel="Add to pipeline"
          pendingLabel="Adding…"
          pending={save.isPending}
          problemCount={v.problemCount}
          error={formError}
        />
      </DialogContent>
    </Dialog>
  );
}
