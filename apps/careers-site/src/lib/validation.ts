import { useCallback, useMemo, useState } from 'react';

// Form validation, done once.
//
// The rule this module exists to enforce: a primary action is never disabled
// without saying why. A greyed-out button with no message gives the user
// nothing to read, nothing to fix, and nothing for a screen reader to announce.
// So submit stays enabled, and pressing it reveals every problem at once and
// moves focus to the first one.

export type Validator = (value: string) => string | null;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// A hostname with a real dot and a plausible TLD. `new URL()` alone is not
// enough: it happily accepts "https://asdf".
const HOSTLIKE = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/|$|:|\?)/i;

/** People type "linkedin.com/in/me", not "https://linkedin.com/in/me". */
export function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

export const required =
  (label: string): Validator =>
  (v) =>
    v.trim().length > 0 ? null : `${label} is required`;

export const minLength =
  (n: number, label: string): Validator =>
  (v) =>
    v.trim().length === 0 || v.trim().length >= n
      ? null
      : `${label} needs at least ${n} characters`;

export const isEmail: Validator = (v) =>
  v.trim().length === 0 || EMAIL.test(v.trim())
    ? null
    : 'That does not look like an email address — try name@company.com';

/** Optional by default; an empty value passes. */
export const isUrl: Validator = (v) => {
  const t = v.trim();
  if (!t) return null;
  const withScheme = normalizeUrl(t);
  const host = withScheme.replace(/^https?:\/\//i, '');
  return HOSTLIKE.test(host)
    ? null
    : 'That does not look like a web address — try example.com/your-page';
};

export const all =
  (...validators: Validator[]): Validator =>
  (v) => {
    for (const check of validators) {
      const problem = check(v);
      if (problem) return problem;
    }
    return null;
  };

/**
 * Turns an endpoint failure into something a person can act on.
 * Endpoint errors arrive as `API call failed (400): {"message":"resumeUrl: Invalid url"}`
 * — a raw blob naming a field the user never saw. Pull out the message, and the
 * field name when there is one, so it can be attached to the right input.
 */
export function parseApiError(error: unknown): { field: string | null; message: string } {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  let message = raw;

  const jsonStart = raw.indexOf('{');
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart)) as { message?: string };
      if (parsed.message) message = parsed.message;
    } catch {
      // Leave the raw text; it is still better than nothing.
    }
  }

  const fieldMatch = message.match(/^([a-zA-Z0-9_.]+):\s*(.+)$/);
  if (fieldMatch) {
    return { field: fieldMatch[1], message: fieldMatch[2] };
  }
  return { field: null, message };
}

/** `resumeUrl` → "Resume link" reads better than the schema's field name. */
export function humanizeField(field: string, labels: Record<string, string>): string {
  if (labels[field]) return labels[field];
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/ Url$/i, ' link')
    .trim();
}

export function useFormValidation<T extends Record<string, string>>(
  values: T,
  validators: Partial<Record<keyof T, Validator>>,
) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  const errors = useMemo(() => {
    const next: Record<string, string> = {};
    for (const key of Object.keys(validators) as (keyof T)[]) {
      const check = validators[key];
      if (!check) continue;
      const problem = check(values[key] ?? '');
      if (problem) next[key as string] = problem;
    }
    return next;
  }, [values, validators]);

  const isValid = Object.keys(errors).length === 0;

  // A problem is only shown once the user has left the field, or once they have
  // tried to submit — nagging while someone is still typing their email is
  // worse than saying nothing.
  const errorFor = useCallback(
    (key: keyof T): string | null => {
      const k = key as string;
      if (serverErrors[k]) return serverErrors[k];
      if (!touched[k] && !submitted) return null;
      return errors[k] ?? null;
    },
    [errors, touched, submitted, serverErrors],
  );

  const onBlur = useCallback((key: keyof T) => {
    setTouched((t) => ({ ...t, [key as string]: true }));
  }, []);

  const clearServerError = useCallback((key: keyof T) => {
    setServerErrors((s) => {
      if (!s[key as string]) return s;
      const next = { ...s };
      delete next[key as string];
      return next;
    });
  }, []);

  /** Call on submit. Returns false and reveals the problems when invalid. */
  const revealProblems = useCallback((): boolean => {
    setSubmitted(true);
    if (isValid) return true;
    const first = Object.keys(errors)[0];
    if (first) {
      const el = document.querySelector<HTMLElement>(`[name="${first}"]`);
      el?.focus();
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    return false;
  }, [errors, isValid]);

  const applyServerError = useCallback((field: string, message: string) => {
    setServerErrors((s) => ({ ...s, [field]: message }));
    const el = document.querySelector<HTMLElement>(`[name="${field}"]`);
    el?.focus();
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, []);

  const reset = useCallback(() => {
    setTouched({});
    setSubmitted(false);
    setServerErrors({});
  }, []);

  return {
    errors, isValid, errorFor, onBlur, revealProblems,
    applyServerError, clearServerError, reset,
    problemCount: Object.keys(errors).length,
  };
}
