import { Check } from 'lucide-react';

type Stage = { id: string; name: string; order: number; kind: string | null };

// The pipeline rendered as a horizontal path. Clicking a step moves the
// candidate there, which is the fastest way to advance someone from the detail
// view without going back to the board.
export function StageStepper({
  stages,
  currentStageId,
  status,
  onMove,
  disabled,
}: {
  stages: Stage[];
  currentStageId: string | null;
  status: string;
  onMove: (stageId: string) => void;
  disabled?: boolean;
}) {
  const currentIndex = stages.findIndex((s) => s.id === currentStageId);
  const closed = status === 'Rejected' || status === 'Withdrawn';

  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {stages.map((s, i) => {
        const done = currentIndex >= 0 && i < currentIndex;
        const current = s.id === currentStageId;
        return (
          <button
            key={s.id}
            type="button"
            disabled={disabled}
            onClick={() => !current && onMove(s.id)}
            title={current ? `Currently in ${s.name}` : `Move to ${s.name}`}
            className={`group flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] transition disabled:cursor-not-allowed ${
              current
                ? closed
                  ? 'bg-tone-danger/10 font-medium text-tone-danger'
                  : 'bg-primary/15 font-medium text-primary'
                : done
                  ? 'text-muted-foreground hover:bg-accent'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {done ? (
              <Check className="h-3 w-3" />
            ) : (
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  current ? (closed ? 'bg-tone-danger' : 'bg-primary') : 'bg-muted-foreground/40'
                }`}
              />
            )}
            {s.name}
          </button>
        );
      })}
    </div>
  );
}
