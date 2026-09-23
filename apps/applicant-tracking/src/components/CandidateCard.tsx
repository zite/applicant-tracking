import { useDraggable } from '@dnd-kit/core';
import { CalendarClock, MessageSquareWarning } from 'lucide-react';
import { Avatar } from './Avatar';
import { Rating } from './Rating';
import { relativeDate } from '../lib/format';
import type { ListPipelineOutputType } from 'zitejs/api';

export type Card = ListPipelineOutputType['cards'][number];

// Presentation only. Deliberately not draggable itself: the DragOverlay renders
// a copy of this, and if the card owned the useDraggable hook that copy would
// register a second draggable under the same id.
export function CandidateCard({
  card,
  targetDays,
  onOpen,
  dragging = false,
}: {
  card: Card;
  targetDays: number | null;
  onOpen?: (card: Card) => void;
  dragging?: boolean;
}) {
  // A card past its stage's target is the single most useful signal on the
  // board, so it gets a colour rather than being buried in a tooltip.
  const stale = targetDays != null && targetDays > 0 && card.daysInStage > targetDays;

  return (
    <div
      onClick={onOpen ? () => onOpen(card) : undefined}
      onKeyDown={(e) => {
        // dnd-kit owns the pointer, so the keyboard path has to open the card
        // itself or the board is mouse-only.
        if (onOpen && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          e.stopPropagation();
          onOpen(card);
        }
      }}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      aria-label={onOpen ? `Open ${card.name}` : undefined}
      className={`card-hover group select-none rounded-lg border border-border bg-card p-2.5 ${
        onOpen ? 'cursor-grab active:cursor-grabbing' : ''
      } ${dragging ? 'rotate-[1.5deg] cursor-grabbing shadow-xl ring-1 ring-primary/40' : ''}`}
    >
      <div className="flex items-start gap-2">
        <Avatar name={card.name} src={card.avatarUrl} size={26} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium leading-tight">{card.name}</div>
          <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
            {card.headline ?? '—'}
            {card.company ? ` · ${card.company}` : ''}
          </div>
        </div>
      </div>

      {card.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {card.tags.slice(0, 2).map((t) => (
            <span
              key={t}
              className="rounded border border-border bg-muted px-1.5 py-px text-[10px] text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2.5 flex items-center gap-2">
        <Rating value={card.rating} size={11} />
        <span className="ml-auto flex items-center gap-1.5 text-[11px]">
          {card.scorecardsDue > 0 && (
            <span
              className="flex items-center gap-0.5 text-tone-warning"
              title={`${card.scorecardsDue} scorecard${card.scorecardsDue > 1 ? 's' : ''} outstanding`}
            >
              <MessageSquareWarning className="h-3 w-3" />
              {card.scorecardsDue}
            </span>
          )}
          {card.upcomingInterviewAt && (
            <span
              className="flex items-center gap-0.5 text-tone-info"
              title={`Interview ${relativeDate(card.upcomingInterviewAt)}`}
            >
              <CalendarClock className="h-3 w-3" />
              {relativeDate(card.upcomingInterviewAt)}
            </span>
          )}
          <span className={stale ? 'font-medium text-tone-danger' : 'text-muted-foreground'}>
            {card.daysInStage}d
          </span>
        </span>
      </div>
    </div>
  );
}

/**
 * The board's draggable wrapper.
 *
 * Note there is no transform here. With a DragOverlay in play the overlay is
 * what follows the pointer; translating the source as well moves the card the
 * user grabbed out from under their cursor, which is what made dragging feel
 * broken. The source just dims in place.
 */
export function DraggableCandidateCard({
  card,
  targetDays,
  onOpen,
}: {
  card: Card;
  targetDays: number | null;
  onOpen: (card: Card) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
    data: { card },
  });

  return (
    <div
      ref={setNodeRef}
      // Without this a touch drag scrolls the column instead of picking the card up.
      style={{ touchAction: 'none' }}
      className={isDragging ? 'opacity-40' : undefined}
      {...listeners}
      {...attributes}
    >
      <CandidateCard card={card} targetDays={targetDays} onOpen={onOpen} />
    </div>
  );
}
