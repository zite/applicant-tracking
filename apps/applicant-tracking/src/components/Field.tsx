import { AlertCircle } from 'lucide-react';

// The internal app's field wrapper — same contract as the careers one, tuned to
// this app's density. Errors are tied to the control with aria-describedby and
// aria-invalid so they are announced, not just seen.
export function Field({
  id,
  label,
  error,
  hint,
  required,
  className = '',
  children,
}: {
  id: string;
  label?: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  className?: string;
  children: (props: {
    id: string;
    name: string;
    'aria-invalid': boolean;
    'aria-describedby': string | undefined;
    className: string;
  }) => React.ReactNode;
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const base = 'w-full rounded-md border bg-transparent px-2.5 py-1.5 text-[12.5px] outline-none transition';
  const tone = error ? 'border-destructive focus:border-destructive' : 'border-input focus:border-primary/60';

  return (
    <div className={className}>
      {label && (
        <label className="mb-1 block text-[11px] text-muted-foreground" htmlFor={id}>
          {label} {required && <span className="text-primary">*</span>}
        </label>
      )}
      {children({
        id,
        name: id,
        'aria-invalid': Boolean(error),
        'aria-describedby': describedBy,
        className: `${base} ${tone}`,
      })}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 flex items-start gap-1 text-[11.5px] text-destructive">
          <AlertCircle className="mt-[1px] h-3 w-3 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * A dialog's action row. The primary action is never disabled for validation
 * reasons — only while the request is in flight — so there is always something
 * to press and always a reason shown when it does not go through.
 */
export function DialogActions({
  onCancel,
  onSubmit,
  submitLabel,
  pendingLabel,
  pending,
  problemCount = 0,
  destructive,
  error,
}: {
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  pendingLabel?: string;
  pending?: boolean;
  problemCount?: number;
  destructive?: boolean;
  error?: string | null;
}) {
  return (
    <>
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/8 px-2.5 py-2 text-[12px] text-destructive">
          <AlertCircle className="mt-[2px] h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
      <div className="flex items-center justify-end gap-2">
        <span aria-live="polite" className="mr-auto text-[11.5px] text-muted-foreground">
          {problemCount > 0
            ? `${problemCount} field${problemCount === 1 ? '' : 's'} need${problemCount === 1 ? 's' : ''} attention`
            : ''}
        </span>
        <button type="button" onClick={onCancel} className="rounded-md px-2.5 py-1.5 text-[12px] text-muted-foreground transition hover:bg-accent">
          Cancel
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onSubmit}
          className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition hover:opacity-90 disabled:opacity-60 ${
            destructive
              ? 'bg-destructive text-destructive-foreground'
              : 'bg-primary text-primary-foreground'
          }`}
        >
          {pending ? (pendingLabel ?? 'Saving…') : submitLabel}
        </button>
      </div>
    </>
  );
}
