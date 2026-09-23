import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { upsertTeamMember } from 'zitejs/api';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@project/components/ui/dialog';
import { Field, DialogActions } from './Field';
import { all, isEmail, minLength, parseApiError, required, useFormValidation } from '../lib/validation';
import type { TeamMember } from '../lib/queries';

const ROLES = ['Admin', 'Recruiter', 'Hiring Manager', 'Interviewer', 'Coordinator'] as const;
const DEPARTMENTS = ['Engineering', 'Product', 'Design', 'Sales', 'Marketing', 'Operations', 'Finance', 'People'];

export function TeamMemberDialog({
  open, onOpenChange, member,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  member: TeamMember | null;
}) {
  const queryClient = useQueryClient();
  const [d, setD] = useState({ name: '', email: '', title: '', role: 'Interviewer', department: 'Engineering' });
  const [formError, setFormError] = useState<string | null>(null);

  const v = useFormValidation(d, {
    name: all(required('Name'), minLength(2, 'Name')),
    email: all(required('Email'), isEmail),
  });

  useEffect(() => {
    if (!open) return;
    setD({
      name: member?.name ?? '',
      email: member?.email ?? '',
      title: member?.title ?? '',
      role: (ROLES as readonly string[]).includes(member?.role ?? '') ? member!.role! : 'Interviewer',
      department: member?.department ?? 'Engineering',
    });
    setFormError(null);
    v.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, member]);

  const set = (k: keyof typeof d) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    v.clearServerError(k);
    setFormError(null);
    setD((prev) => ({ ...prev, [k]: e.target.value }));
  };

  const save = useMutation({
    mutationFn: () =>
      upsertTeamMember({
        memberId: member?.id,
        name: d.name.trim(),
        email: d.email.trim(),
        title: d.title.trim() || undefined,
        role: d.role as (typeof ROLES)[number],
        department: d.department || undefined,
      }),
    onSuccess: () => {
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ['bootstrap'] });
      toast.success(member ? 'Team member updated' : `${d.name.trim()} added to the team`);
    },
    onError: (error) => {
      const { field, message } = parseApiError(error);
      if (field && field in d) v.applyServerError(field, message);
      else setFormError(message || 'Could not save');
    },
  });

  const onSubmit = () => {
    setFormError(null);
    if (!v.revealProblems()) return;
    save.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[14px]">{member ? 'Edit team member' : 'Add a team member'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2" onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
            e.preventDefault();
            onSubmit();
          }
        }}>
          <Field id="name" label="Name" required error={v.errorFor('name')} className="sm:col-span-2">
            {(p) => <input {...p} autoFocus value={d.name} onChange={set('name')} onBlur={() => v.onBlur('name')} />}
          </Field>
          <Field id="email" label="Email" required error={v.errorFor('email')} hint="Used to match this person to whoever is signed in." className="sm:col-span-2">
            {(p) => <input {...p} type="email" inputMode="email" value={d.email} onChange={set('email')} onBlur={() => v.onBlur('email')} />}
          </Field>
          <Field id="title" label="Title" error={v.errorFor('title')}>
            {(p) => <input {...p} value={d.title} onChange={set('title')} />}
          </Field>
          <Field id="department" label="Department" error={v.errorFor('department')}>
            {(p) => <select {...p} value={d.department} onChange={set('department')}>
              {DEPARTMENTS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>}
          </Field>
          <Field id="role" label="Role" error={v.errorFor('role')} className="sm:col-span-2">
            {(p) => <select {...p} value={d.role} onChange={set('role')}>
              {ROLES.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>}
          </Field>
        </div>
        <DialogActions
          onCancel={() => onOpenChange(false)}
          onSubmit={onSubmit}
          submitLabel={member ? 'Save' : 'Add to team'}
          pending={save.isPending}
          problemCount={v.problemCount}
          error={formError}
        />
      </DialogContent>
    </Dialog>
  );
}
