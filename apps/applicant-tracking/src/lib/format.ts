export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

export const money = (n: number | null | undefined) =>
  n == null ? '—' : `$${Math.round(n).toLocaleString('en-US')}`;

export const compactMoney = (n: number | null | undefined) =>
  n == null ? '—' : n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;

export const salaryRange = (min: number | null, max: number | null) => {
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${compactMoney(min)} – ${compactMoney(max)}`;
  return compactMoney(min ?? max);
};

export function relativeDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Date.now() - then;
  const future = diff < 0;
  const mins = Math.round(Math.abs(diff) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return future ? `in ${mins}m` : `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return future ? `in ${hours}h` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return future ? `in ${days}d` : `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return future ? `in ${months}mo` : `${months}mo ago`;
  return `${Math.round(months / 12)}y ${future ? 'out' : 'ago'}`;
}

export function dayLabel(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function dateTimeLabel(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function dayHeading(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (isSameDay(d, now)) return 'Today';
  if (isSameDay(d, tomorrow)) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

// Stage colour is derived from kind, so a renamed stage keeps its meaning.
export const stageTone = (kind: string | null | undefined) => {
  switch (kind) {
    case 'Applied':
      return 'text-tone-neutral';
    case 'Screen':
      return 'text-tone-info';
    case 'Interview':
      return 'text-tone-accent';
    case 'Offer':
      return 'text-tone-warning';
    case 'Hired':
      return 'text-tone-success';
    case 'Rejected':
      return 'text-tone-danger';
    default:
      return 'text-muted-foreground';
  }
};

export const statusTone = (status: string) => {
  switch (status) {
    case 'Hired':
      return 'bg-tone-success/10 text-tone-success border-tone-success/30';
    case 'Rejected':
      return 'bg-tone-danger/10 text-tone-danger border-tone-danger/30';
    case 'Withdrawn':
      return 'bg-tone-neutral/10 text-tone-neutral border-tone-neutral/30';
    case 'On Hold':
      return 'bg-tone-warning/10 text-tone-warning border-tone-warning/30';
    default:
      return 'bg-tone-info/10 text-tone-info border-tone-info/30';
  }
};

export const recommendationTone = (rec: string | null | undefined) => {
  switch (rec) {
    // Four distinct tones, because collapsing "Strong Yes" and "Yes" into one
    // colour throws away the distinction the scale exists to make. The label is
    // always rendered alongside, so colour is never the only signal.
    case 'Strong Yes':
      return 'text-tone-success';
    case 'Yes':
      return 'text-tone-info';
    case 'No':
      return 'text-tone-warning';
    case 'Strong No':
      return 'text-tone-danger';
    default:
      return 'text-muted-foreground';
  }
};

export const priorityTone = (p: string | null | undefined) => {
  switch (p) {
    case 'Critical':
      return 'text-tone-danger';
    case 'High':
      return 'text-tone-warning';
    case 'Medium':
      return 'text-tone-info';
    default:
      return 'text-muted-foreground';
  }
};
