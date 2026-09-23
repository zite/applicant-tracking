import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { updateCandidate } from 'zitejs/api';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@project/components/ui/dialog';
import { Field, DialogActions } from './Field';
import {
  all, isEmail, isUrl, minLength, normalizeUrl, parseApiError, required, useFormValidation,
} from '../lib/validation';

const TAGS = ['Top Prospect', 'Referral', 'Silver Medalist', 'Needs Visa', 'Senior', 'Re-engage Later'];
const SKILLS = [
  'TypeScript', 'React', 'Python', 'Go', 'Rust', 'Kubernetes', 'AWS', 'Postgres',
  'Machine Learning', 'Product Strategy', 'Figma', 'Design Systems', 'User Research',
  'Enterprise Sales', 'Demand Gen', 'Analytics',
];

type Candidate = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  headline: string | null;
  currentCompany: string | null;
  location: string | null;
  linkedInUrl: string | null;
  gitHubUrl: string | null;
  portfolioUrl: string | null;
  resumeUrl: string | null;
  yearsExperience: number | null;
  tags: string[];
  skills: string[];
};

export function EditCandidateDialog({
  open,
  onOpenChange,
  candidate,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  candidate: Candidate;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const [d, setD] = useState(candidate);
  const [formError, setFormError] = useState<string | null>(null);
  const v = useFormValidation(
    {
      fullName: d.fullName ?? '', email: d.email ?? '',
      linkedInUrl: d.linkedInUrl ?? '', gitHubUrl: d.gitHubUrl ?? '',
      portfolioUrl: d.portfolioUrl ?? '', resumeUrl: d.resumeUrl ?? '',
    },
    {
      fullName: all(required('Name'), minLength(2, 'Name')),
      email: all(required('Email'), isEmail),
      linkedInUrl: isUrl, gitHubUrl: isUrl, portfolioUrl: isUrl, resumeUrl: isUrl,
    },
  );
  const blurUrl = (k: 'linkedInUrl' | 'gitHubUrl' | 'portfolioUrl' | 'resumeUrl') => () => {
    setD((prev) => ({ ...prev, [k]: prev[k] ? normalizeUrl(prev[k]!) : null }));
    v.onBlur(k);
  };

  useEffect(() => {
    if (open) setD(candidate);
  }, [open, candidate]);

  const save = useMutation({
    mutationFn: () =>
      updateCandidate({
        candidateId: candidate.id,
        fullName: d.fullName.trim(),
        email: d.email?.trim() || undefined,
        phone: d.phone?.trim() || null,
        headline: d.headline?.trim() || null,
        currentCompany: d.currentCompany?.trim() || null,
        location: d.location?.trim() || null,
        linkedInUrl: d.linkedInUrl?.trim() || null,
        gitHubUrl: d.gitHubUrl?.trim() || null,
        portfolioUrl: d.portfolioUrl?.trim() || null,
        resumeUrl: d.resumeUrl?.trim() || null,
        yearsExperience: d.yearsExperience ?? null,
        tags: d.tags,
        skills: d.skills,
      }),
    onSuccess: () => {
      onOpenChange(false);
      queryClient.invalidateQueries();
      onSaved();
      toast.success('Profile updated');
    },
    onError: (err) => {
      const { field, message } = parseApiError(err);
      if (field) v.applyServerError(field, message);
      else setFormError(message || 'Could not save');
    },
  });

  const onSubmit = () => {
    setFormError(null);
    if (!v.revealProblems()) return;
    save.mutate();
  };

  const input =
    'w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-[12.5px] outline-none focus:border-primary/60';
  const lbl = 'mb-1 block text-[11px] text-muted-foreground';

  const chip = (list: string[], value: string, onToggle: () => void) => (
    <button
      key={value}
      type="button"
      onClick={onToggle}
      className={`rounded border px-1.5 py-0.5 text-[11px] transition ${
        list.includes(value)
          ? 'border-primary bg-primary/12 text-primary'
          : 'border-border text-muted-foreground hover:bg-accent'
      }`}
    >
      {value}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[14px]">Edit {candidate.fullName}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="fullName" label="Full name" required error={v.errorFor('fullName')}>
            {(p) => <input {...p} autoFocus value={d.fullName} onChange={(e) => { v.clearServerError('fullName'); setD({ ...d, fullName: e.target.value }); }} onBlur={() => v.onBlur('fullName')} />}
          </Field>
          <Field id="email" label="Email" required error={v.errorFor('email')}>
            {(p) => <input {...p} type="email" inputMode="email" value={d.email ?? ''} onChange={(e) => { v.clearServerError('email'); setD({ ...d, email: e.target.value }); }} onBlur={() => v.onBlur('email')} />}
          </Field>
          <label><span className={lbl}>Current title</span>
            <input value={d.headline ?? ''} onChange={(e) => setD({ ...d, headline: e.target.value })} className={input} /></label>
          <label><span className={lbl}>Company</span>
            <input value={d.currentCompany ?? ''} onChange={(e) => setD({ ...d, currentCompany: e.target.value })} className={input} /></label>
          <label><span className={lbl}>Phone</span>
            <input value={d.phone ?? ''} onChange={(e) => setD({ ...d, phone: e.target.value })} className={input} /></label>
          <label><span className={lbl}>Location</span>
            <input value={d.location ?? ''} onChange={(e) => setD({ ...d, location: e.target.value })} className={input} /></label>
          <label><span className={lbl}>Years of experience</span>
            <input type="number" min={0} value={d.yearsExperience ?? ''} onChange={(e) => setD({ ...d, yearsExperience: e.target.value ? Number(e.target.value) : null })} className={input} /></label>
          <Field id="linkedInUrl" label="LinkedIn" error={v.errorFor('linkedInUrl')}>
            {(p) => <input {...p} type="url" inputMode="url" value={d.linkedInUrl ?? ''} onChange={(e) => { v.clearServerError('linkedInUrl'); setD({ ...d, linkedInUrl: e.target.value }); }} onBlur={blurUrl('linkedInUrl')} />}
          </Field>
          <Field id="gitHubUrl" label="GitHub" error={v.errorFor('gitHubUrl')}>
            {(p) => <input {...p} type="url" inputMode="url" value={d.gitHubUrl ?? ''} onChange={(e) => { v.clearServerError('gitHubUrl'); setD({ ...d, gitHubUrl: e.target.value }); }} onBlur={blurUrl('gitHubUrl')} />}
          </Field>
          <Field id="portfolioUrl" label="Portfolio" error={v.errorFor('portfolioUrl')}>
            {(p) => <input {...p} type="url" inputMode="url" value={d.portfolioUrl ?? ''} onChange={(e) => { v.clearServerError('portfolioUrl'); setD({ ...d, portfolioUrl: e.target.value }); }} onBlur={blurUrl('portfolioUrl')} />}
          </Field>
          <Field id="resumeUrl" label="Resume link" error={v.errorFor('resumeUrl')} className="sm:col-span-2">
            {(p) => <input {...p} type="url" inputMode="url" placeholder="drive.google.com/…" value={d.resumeUrl ?? ''} onChange={(e) => { v.clearServerError('resumeUrl'); setD({ ...d, resumeUrl: e.target.value }); }} onBlur={blurUrl('resumeUrl')} />}
          </Field>
        </div>

        <div>
          <span className={lbl}>Tags</span>
          <div className="flex flex-wrap gap-1.5">
            {TAGS.map((v) => chip(d.tags, v, () =>
              setD({ ...d, tags: d.tags.includes(v) ? d.tags.filter((x) => x !== v) : [...d.tags, v] })))}
          </div>
        </div>

        <div>
          <span className={lbl}>Skills</span>
          <div className="flex flex-wrap gap-1.5">
            {SKILLS.map((v) => chip(d.skills, v, () =>
              setD({ ...d, skills: d.skills.includes(v) ? d.skills.filter((x) => x !== v) : [...d.skills, v] })))}
          </div>
        </div>

        <DialogActions
          onCancel={() => onOpenChange(false)}
          onSubmit={onSubmit}
          submitLabel="Save profile"
          pending={save.isPending}
          problemCount={v.problemCount}
          error={formError}
        />
      </DialogContent>
    </Dialog>
  );
}
