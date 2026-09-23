import { initials } from '../lib/format';

export function Avatar({
  name,
  src,
  size = 24,
  className = '',
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const dim = { width: size, height: size };
  if (src) {
    return (
      <img
        src={src}
        alt=""
        style={dim}
        className={`shrink-0 rounded-full object-cover ring-1 ring-border ${className}`}
        loading="lazy"
      />
    );
  }
  return (
    <span
      style={{ ...dim, fontSize: Math.max(9, size * 0.38) }}
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full bg-muted font-medium text-muted-foreground ring-1 ring-border ${className}`}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({
  people,
  max = 3,
  size = 20,
}: {
  people: { id: string; name: string; avatarUrl?: string | null }[];
  max?: number;
  size?: number;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <span key={p.id} style={{ marginLeft: i === 0 ? 0 : -6 }} title={p.name}>
          <Avatar name={p.name} src={p.avatarUrl} size={size} className="ring-2 ring-background" />
        </span>
      ))}
      {extra > 0 && (
        <span
          style={{ marginLeft: -6, width: size, height: size, fontSize: Math.max(9, size * 0.36) }}
          className="inline-flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground ring-2 ring-background"
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
