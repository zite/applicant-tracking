import { AlertCircle } from 'lucide-react';

// One label, one control, one message. The error is tied to the input with
// aria-describedby and aria-invalid so it is announced rather than merely seen.
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
  label: string;
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
  const base =
    'w-full rounded-lg border bg-card px-3 py-2.5 text-[14.5px] outline-none transition';
  const tone = error
    ? 'border-destructive focus:border-destructive'
    : 'border-input focus:border-primary';

  return (
    <div className={className}>
      <label className="mb-1.5 block text-[13px] font-medium" htmlFor={id}>
        {label} {required && <span className="text-primary">*</span>}
      </label>
      {children({
        id,
        name: id,
        'aria-invalid': Boolean(error),
        'aria-describedby': describedBy,
        className: `${base} ${tone}`,
      })}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 flex items-start gap-1.5 text-[13px] text-destructive">
          <AlertCircle className="mt-[2px] h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[12.5px] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
