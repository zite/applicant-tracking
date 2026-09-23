import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  closestCorners, DndContext, DragOverlay, PointerSensor, pointerWithin,
  useDroppable, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { CandidateCard, DraggableCandidateCard, type Card } from './CandidateCard';
import { stageTone } from '../lib/format';
import type { ListPipelineOutputType } from 'zitejs/api';

type Stage = ListPipelineOutputType['stages'][number];

function Column({
  stage,
  cards,
  onOpen,
}: {
  stage: Stage;
  cards: Card[];
  onOpen: (c: Card) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  // The droppable is the whole column, not just the scrollable card list.
  // Hanging it on the inner list left the header strip as a dead zone where a
  // drop silently did nothing.
  return (
    <div ref={setNodeRef} className="flex h-full w-[272px] shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className={`text-[15px] leading-none ${stageTone(stage.kind)}`}>•</span>
        <span className="text-[12.5px] font-medium">{stage.name}</span>
        <span className="rounded bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">
          {cards.length}
        </span>
        {stage.targetDays ? (
          <span className="ml-auto text-[10.5px] text-muted-foreground" title="Target time in stage">
            {stage.targetDays}d target
          </span>
        ) : null}
      </div>

      <div
        className={`min-h-0 flex-1 space-y-2 overflow-y-auto rounded-lg p-1.5 transition-colors ${
          isOver ? 'bg-primary/8 ring-1 ring-inset ring-primary/30' : 'bg-muted/25'
        }`}
      >
        {cards.map((c) => (
          <DraggableCandidateCard key={c.id} card={c} targetDays={stage.targetDays} onOpen={onOpen} />
        ))}
        {cards.length === 0 && (
          <div className="grid h-20 place-items-center rounded-md border border-dashed border-border text-[11.5px] text-muted-foreground">
            Nobody here yet
          </div>
        )}
      </div>
    </div>
  );
}

export function PipelineBoard({
  stages,
  cards,
  onOpen,
  onMove,
}: {
  stages: Stage[];
  cards: Card[];
  onOpen: (c: Card) => void;
  onMove: (applicationId: string, stageId: string) => void;
}) {
  const [active, setActive] = useState<Card | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const pointerX = useRef<number | null>(null);

  // Edge scrolling, done by hand so it is predictable.
  //
  // It keys off the pointer's distance from the board's edge rather than the
  // dragged card's rect, so it only ever engages when the cursor is genuinely at
  // the edge, and the speed is proportional to how far into the zone it is.
  // Scrolling the board does not move the pointer, so this cannot run away.
  useEffect(() => {
    if (!active) return;

    const EDGE = 72;      // px from the board edge where scrolling begins
    const MAX_SPEED = 9;  // px per tick at the very edge (~560px/s), fast
                          // enough to cross the board but slow enough to aim

    const onPointerMove = (e: PointerEvent) => {
      pointerX.current = e.clientX;
    };
    window.addEventListener('pointermove', onPointerMove);

    // An interval rather than requestAnimationFrame: rAF is tied to the
    // compositor and is starved when the tab is not painting, which also makes
    // this impossible to test headlessly. A 16ms tick behaves identically for a
    // few pixels of scroll and keeps working either way.
    const timer = window.setInterval(() => {
      const board = boardRef.current;
      const x = pointerX.current;
      if (!board || x == null) return;
      const rect = board.getBoundingClientRect();
      const intoLeft = EDGE - (x - rect.left);
      const intoRight = EDGE - (rect.right - x);
      if (intoLeft > 0) {
        board.scrollLeft -= Math.min(intoLeft / EDGE, 1) * MAX_SPEED;
      } else if (intoRight > 0) {
        board.scrollLeft += Math.min(intoRight / EDGE, 1) * MAX_SPEED;
      }
    }, 16);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.clearInterval(timer);
      pointerX.current = null;
    };
  }, [active]);

  // A small activation distance keeps a click from registering as a drag, which
  // is what makes cards feel clickable and draggable at the same time.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Follow the cursor, not the dragged rectangle.
  //
  // dnd-kit's default is rectIntersection, which picks whichever droppable the
  // dragged card *overlaps most*. On a board of 272px columns with a 260px card
  // that is routinely not the column under the pointer: grabbing a card 40px in
  // and dropping at x=489 (inside Applied, 244-516) put the overlay at 449-709,
  // which overlaps the next column by 181px versus 67px — so the card landed one
  // column to the right of where it was dropped. Measured, not theorised.
  //
  // pointerWithin resolves to the column the cursor is actually in. It returns
  // nothing when the pointer is outside every droppable — over a gap, or past
  // the last column — so closestCorners picks up those cases instead of the
  // drop silently doing nothing.
  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const underPointer = pointerWithin(args);
    return underPointer.length > 0 ? underPointer : closestCorners(args);
  }, []);

  const byStage = useMemo(() => {
    const map = new Map<string, Card[]>();
    for (const s of stages) map.set(s.id, []);
    for (const c of cards) {
      if (c.stageId && map.has(c.stageId)) map.get(c.stageId)!.push(c);
    }
    return map;
  }, [stages, cards]);

  const handleStart = (e: DragStartEvent) => {
    setActive((e.active.data.current as { card?: Card } | undefined)?.card ?? null);
  };

  const handleEnd = (e: DragEndEvent) => {
    setActive(null);
    const overId = e.over?.id ? String(e.over.id) : null;
    const card = (e.active.data.current as { card?: Card } | undefined)?.card;
    if (!overId || !card || card.stageId === overId) return;
    onMove(card.id, overId);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      // dnd-kit's own auto-scroll is off; see the edge-scroll effect below for
      // why. Its threshold is measured against the dragged card's rect, and once
      // triggered it keeps scrolling, which slides the board under the pointer
      // and keeps it in the zone — a runaway that measured anywhere from 189px
      // to 600px of unasked-for scroll on a single ordinary drag.
      autoScroll={false}
      onDragStart={handleStart}
      onDragEnd={handleEnd}
      onDragCancel={() => setActive(null)}
    >
      <div ref={boardRef} className="board-scroll flex h-full gap-3 overflow-x-auto px-4 pb-4">
        {stages.map((s) => (
          <Column key={s.id} stage={s} cards={byStage.get(s.id) ?? []} onOpen={onOpen} />
        ))}
      </div>

      {/* No drop animation: the move applies optimistically, so the card is
          already in its new column and animating the overlay back to the old
          position reads as a glitch. Dropping instantly is cleaner. */}
      <DragOverlay dropAnimation={null}>
        {active ? (
          <div className="w-[260px] cursor-grabbing">
            <CandidateCard card={active} targetDays={null} dragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
