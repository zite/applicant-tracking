import { Star } from 'lucide-react';

// Four points, matching the scorecard scale. Read-only unless onChange is given.
export function Rating({
  value,
  onChange,
  size = 13,
}: {
  value: number;
  onChange?: (next: number) => void;
  size?: number;
}) {
  const interactive = Boolean(onChange);
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4].map((n) => {
        const filled = n <= value;
        const star = (
          <Star
            style={{ width: size, height: size }}
            className={
              filled
                ? 'fill-tone-warning text-tone-warning'
                : 'text-muted-foreground/55'
            }
          />
        );
        return interactive ? (
          <button
            key={n}
            type="button"
            aria-label={`Rate ${n} of 4`}
            className="transition-transform hover:scale-110"
            onClick={(e) => {
              e.stopPropagation();
              // Clicking the current value clears it, so a misclick is undoable.
              onChange!(value === n ? 0 : n);
            }}
          >
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </span>
  );
}
