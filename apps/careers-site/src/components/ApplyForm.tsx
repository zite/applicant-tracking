import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { submitApplication } from 'zitejs/api';
import { Field } from './Field';
import {
  all, humanizeField, isEmail, isUrl, minLength, normalizeUrl, parseApiError,
  required, useFormValidation,
} from '../lib/validation';

type Form = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  currentCompany: string;
  headline: string;
  linkedInUrl: string;
  portfolioUrl: string;
  resumeUrl: string;
  note: string;
  website: string; // honeypot
};

const EMPTY: Form = {
  fullName: '', email: '', phone: '', location: '', currentCompany: '',
  headline: '', linkedInUrl: '', portfolioUrl: '', resumeUrl: '', note: '', website: '',
};

// Endpoint field names are not what the form calls them, so a server-side
// complaint about `resumeUrl` can still point at the right box.
const LABELS: Record<string, string> = {
  fullName: 'Full name',
  email: 'Email',
  linkedInUrl: 'LinkedIn',
  portfolioUrl: 'Portfolio or GitHub',
  resumeUrl: 'Link to your resume',
  note: 'Anything you want us to know',
  jobSlug: 'This role',
};

export function ApplyForm({ jobSlug, jobTitle }: { jobSlug: string; jobTitle: string }) {
  const [form, setForm] = useState<Form>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);

  const v = useFormValidation(form, {
    fullName: all(required('Your name'), minLength(2, 'Your name')),
    email: all(required('Email'), isEmail),
    linkedInUrl: isUrl,
    portfolioUrl: isUrl,
    resumeUrl: isUrl,
  });

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    v.clearServerError(k);
    setFormError(null);
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  // Tidy the URL when the user leaves the field, so what they see is what gets
  // sent and the address they typed without a scheme still works.
  const blurUrl = (k: keyof Form) => () => {
    setForm((f) => ({ ...f, [k]: f[k] ? normalizeUrl(f[k]) : '' }));
    v.onBlur(k);
  };

  const submit = useMutation({
    mutationFn: () =>
      submitApplication({
        jobSlug,
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        location: form.location.trim() || undefined,
        currentCompany: form.currentCompany.trim() || undefined,
        headline: form.headline.trim() || undefined,
        linkedInUrl: form.linkedInUrl.trim() ? normalizeUrl(form.linkedInUrl) : undefined,
        portfolioUrl: form.portfolioUrl.trim() ? normalizeUrl(form.portfolioUrl) : undefined,
        resumeUrl: form.resumeUrl.trim() ? normalizeUrl(form.resumeUrl) : undefined,
        note: form.note.trim() || undefined,
        website: form.website,
      }),
    onError: (error) => {
      const { field, message } = parseApiError(error);
      if (field && field in form) {
        // Attach it to the input it belongs to instead of dumping JSON.
        v.applyServerError(field, message);
        setFormError(null);
      } else {
        setFormError(
          field
            ? `${humanizeField(field, LABELS)}: ${message}`
            : message || 'Something went wrong. Please try again.',
        );
      }
    },
  });

  if (submit.isSuccess) {
    return (
      <div className="rounded-xl border border-primary/25 bg-primary/5 p-8 text-center">
        <CheckCircle2 className="mx-auto mb-3 h-7 w-7 text-primary" />
        <h3 className="text-[17px] font-medium">
          {submit.data.duplicate ? 'You have already applied' : 'Application received'}
        </h3>
        <p className="mx-auto mt-1.5 max-w-sm text-[14px] leading-relaxed text-muted-foreground">
          {submit.data.duplicate
            ? 'We already have your application for this role — no need to send another.'
            : `Thanks for applying to ${jobTitle}. A recruiter reviews every application, and you will hear from us either way.`}
        </p>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="rounded-xl border border-border bg-card p-6"
      onSubmit={(e) => {
        e.preventDefault();
        setFormError(null);
        // The button is always live; pressing it is what reveals the problems.
        if (!v.revealProblems()) return;
        submit.mutate();
      }}
    >
      <h3 className="mb-5 text-[17px] font-medium">Apply for this role</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="fullName" label="Full name" required error={v.errorFor('fullName')} className="sm:col-span-2">
          {(p) => <input {...p} autoComplete="name" value={form.fullName} onChange={set('fullName')} onBlur={() => v.onBlur('fullName')} />}
        </Field>

        <Field id="email" label="Email" required error={v.errorFor('email')}>
          {(p) => <input {...p} type="email" inputMode="email" autoComplete="email" value={form.email} onChange={set('email')} onBlur={() => v.onBlur('email')} />}
        </Field>

        <Field id="phone" label="Phone" error={v.errorFor('phone')}>
          {(p) => <input {...p} type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />}
        </Field>

        <Field id="currentCompany" label="Current company" error={v.errorFor('currentCompany')}>
          {(p) => <input {...p} autoComplete="organization" value={form.currentCompany} onChange={set('currentCompany')} />}
        </Field>

        <Field id="headline" label="Current title" error={v.errorFor('headline')}>
          {(p) => <input {...p} autoComplete="organization-title" value={form.headline} onChange={set('headline')} />}
        </Field>

        <Field id="location" label="Location" error={v.errorFor('location')}>
          {(p) => <input {...p} autoComplete="address-level2" value={form.location} onChange={set('location')} />}
        </Field>

        <Field id="linkedInUrl" label="LinkedIn" error={v.errorFor('linkedInUrl')} hint="linkedin.com/in/you">
          {(p) => <input {...p} type="url" inputMode="url" autoComplete="url" value={form.linkedInUrl} onChange={set('linkedInUrl')} onBlur={blurUrl('linkedInUrl')} />}
        </Field>

        <Field id="portfolioUrl" label="Portfolio or GitHub" error={v.errorFor('portfolioUrl')} className="sm:col-span-2">
          {(p) => <input {...p} type="url" inputMode="url" value={form.portfolioUrl} onChange={set('portfolioUrl')} onBlur={blurUrl('portfolioUrl')} />}
        </Field>

        <Field
          id="resumeUrl"
          label="Link to your resume"
          error={v.errorFor('resumeUrl')}
          hint="A public link — Google Drive, Dropbox, or your own site."
          className="sm:col-span-2"
        >
          {(p) => <input {...p} type="url" inputMode="url" value={form.resumeUrl} onChange={set('resumeUrl')} onBlur={blurUrl('resumeUrl')} />}
        </Field>

        <Field id="note" label="Anything you want us to know" error={v.errorFor('note')} className="sm:col-span-2">
          {(p) => (
            <textarea
              {...p}
              rows={4}
              className={`${p.className} resize-none`}
              placeholder="Optional. What drew you to this role?"
              value={form.note}
              onChange={set('note')}
            />
          )}
        </Field>
      </div>

      {/* Honeypot. Off-screen rather than display:none — a hidden input is easy
          for a bot to skip, an off-screen one reads as real. */}
      <div aria-hidden style={{ position: 'absolute', left: '-9999px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor="website">Website</label>
        <input id="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
      </div>

      {formError && (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-[13.5px] text-destructive">
          <AlertCircle className="mt-[2px] h-4 w-4 shrink-0" />
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={submit.isPending}
        className="mt-6 w-full rounded-lg bg-primary px-4 py-3 text-[15px] font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        {submit.isPending ? 'Sending…' : 'Submit application'}
      </button>

      <p aria-live="polite" className="mt-3 text-center text-[12.5px] text-muted-foreground">
        {v.problemCount > 0 && (v.errorFor('fullName') || v.errorFor('email') || v.errorFor('resumeUrl') || v.errorFor('linkedInUrl') || v.errorFor('portfolioUrl'))
          ? `${v.problemCount} field${v.problemCount === 1 ? '' : 's'} need${v.problemCount === 1 ? 's' : ''} attention above.`
          : 'We only use what you send here to consider you for this role.'}
      </p>
    </form>
  );
}
