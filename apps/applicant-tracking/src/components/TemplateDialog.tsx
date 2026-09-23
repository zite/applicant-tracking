import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { upsertEmailTemplate } from 'zitejs/api';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@project/components/ui/dialog';
import { Field, DialogActions } from './Field';
import { parseApiError, required, useFormValidation } from '../lib/validation';

const CATEGORIES = ['Outreach', 'Screening', 'Scheduling', 'Rejection', 'Offer', 'Follow-up'] as const;

export type TemplateRow = {
  id: string;
  name: string;
  subject: string | null;
  body: string | null;
  category: string | null;
};

export function TemplateDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  template: TemplateRow | null;
}) {
  const queryClient = useQueryClient();
  const [d, setD] = useState({ name: '', subject: '', body: '', category: 'Outreach' as (typeof CATEGORIES)[number] });
  const [formError, setFormError] = useState<string | null>(null);
  const v = useFormValidation(d, {
    name: required('A name'),
    subject: required('A subject'),
    body: required('A message'),
  });

  useEffect(() => {
    if (!open) return;
    setD({
      name: template?.name ?? '',
      subject: template?.subject ?? '',
      body: template?.body ?? '',
      category: (CATEGORIES as readonly string[]).includes(template?.category ?? '')
        ? (template!.category as (typeof CATEGORIES)[number])
        : 'Outreach',
    });
  }, [open, template]);

  const save = useMutation({
    mutationFn: () =>
      upsertEmailTemplate({
        templateId: template?.id,
        name: d.name.trim(),
        subject: d.subject.trim(),
        body: d.body.trim(),
        category: d.category,
      }),
    onSuccess: () => {
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ['emailTemplates'] });
      toast.success(template ? 'Template updated' : 'Template created');
    },
    onError: (e) => {
      const { field, message } = parseApiError(e);
      if (field && field in d) v.applyServerError(field, message);
      else setFormError(message || 'Could not save');
    },
  });

  const onSubmit = () => {
    setFormError(null);
    if (!v.revealProblems()) return;
    save.mutate();
  };

  const input = 'w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-[12.5px] outline-none focus:border-primary/60';
  const lbl = 'mb-1 block text-[11px] text-muted-foreground';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[14px]">{template ? 'Edit template' : 'New template'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="name" label="Name" required error={v.errorFor('name')}>
            {(p) => <input {...p} autoFocus placeholder="Recruiter screen invite" value={d.name} onChange={(e) => { v.clearServerError('name'); setD({ ...d, name: e.target.value }); }} onBlur={() => v.onBlur('name')} />}
          </Field>
          <Field id="category" label="Category">
            {(p) => <select {...p} value={d.category} onChange={(e) => setD({ ...d, category: e.target.value as (typeof CATEGORIES)[number] })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>}
          </Field>
          <Field id="subject" label="Subject" required error={v.errorFor('subject')} className="sm:col-span-2">
            {(p) => <input {...p} value={d.subject} onChange={(e) => { v.clearServerError('subject'); setD({ ...d, subject: e.target.value }); }} onBlur={() => v.onBlur('subject')} />}
          </Field>
          <Field id="body" label="Body" required error={v.errorFor('body')} className="sm:col-span-2">
            {(p) => <textarea {...p} rows={12} className={`${p.className} resize-none leading-relaxed`} value={d.body} onChange={(e) => { v.clearServerError('body'); setD({ ...d, body: e.target.value }); }} onBlur={() => v.onBlur('body')} />}
          </Field>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Placeholders filled in when the template is used:{' '}
          <code className="kbd">{'{{firstName}}'}</code>{' '}
          <code className="kbd">{'{{job}}'}</code>{' '}
          <code className="kbd">{'{{recruiter}}'}</code>{' '}
          <code className="kbd">{'{{company}}'}</code>
        </p>
        <DialogActions
          onCancel={() => onOpenChange(false)}
          onSubmit={onSubmit}
          submitLabel="Save template"
          pending={save.isPending}
          problemCount={v.problemCount}
          error={formError}
        />
      </DialogContent>
    </Dialog>
  );
}
