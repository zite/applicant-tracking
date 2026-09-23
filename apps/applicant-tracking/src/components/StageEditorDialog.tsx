import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from 'lucide-react';
import { upsertStages } from 'zitejs/api';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@project/components/ui/dialog';

const KINDS = ['Lead', 'Applied', 'Screen', 'Interview', 'Offer', 'Hired', 'Rejected'] as const;

type Row = {
  id?: string;
  name: string;
  kind: (typeof KINDS)[number];
  targetDays: number;
  interviewKit: string;
};

export function StageEditorDialog({
  open,
  onOpenChange,
  jobId,
  jobTitle,
  stages,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  jobId: string;
  jobTitle: string;
  stages: { id: string; name: string; kind: string | null; targetDays: number | null; interviewKit: string | null }[];
}) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showProblems, setShowProblems] = useState(false);
  const emptyRows = rows.map((r, i) => (r.name.trim() ? -1 : i)).filter((i) => i >= 0);

  useEffect(() => {
    if (!open) return;
    setRows(
      stages.map((s) => ({
        id: s.id,
        name: s.name,
        kind: (KINDS as readonly string[]).includes(s.kind ?? '') ? (s.kind as Row['kind']) : 'Interview',
        targetDays: s.targetDays ?? 0,
        interviewKit: s.interviewKit ?? '',
      })),
    );
    setExpanded(null);
  }, [open, stages]);

  const save = useMutation({
    mutationFn: () =>
      upsertStages({
        jobId,
        stages: rows.map((r) => ({
          id: r.id,
          name: r.name.trim(),
          kind: r.kind,
          targetDays: r.targetDays,
          interviewKit: r.interviewKit.trim() || null,
        })),
      }),
    onSuccess: (r) => {
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['application'] });
      toast.success(
        [
          r.created ? `${r.created} added` : null,
          r.updated ? `${r.updated} updated` : null,
          r.removed ? `${r.removed} removed` : null,
        ].filter(Boolean).join(' · ') || 'Pipeline saved',
      );
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'Could not save the pipeline'),
  });

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
    setExpanded(expanded === i ? j : expanded === j ? i : expanded);
  };

  const input =
    'w-full rounded-md border border-input bg-transparent px-2 py-1 text-[12.5px] outline-none focus:border-primary/60';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[14px]">Pipeline for {jobTitle}</DialogTitle>
        </DialogHeader>

        <p className="text-[12px] text-muted-foreground">
          Order here is the order on the board. Stage <em>kind</em> is what the app keys
          behaviour off — moving someone into an <em>Offer</em> or <em>Hired</em> stage updates
          their status — so a renamed stage keeps working.
        </p>

        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div key={r.id ?? `new-${i}`} className="rounded-md border border-border">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                <span className="w-5 shrink-0 text-center text-[11px] tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <input
                  value={r.name}
                  onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  className={`${input} flex-1 ${showProblems && !r.name.trim() ? 'border-destructive' : ''}`}
                  aria-label={`Stage ${i + 1} name`}
                  aria-invalid={showProblems && !r.name.trim()}
                  placeholder="Name this stage"
                />
                <select
                  value={r.kind}
                  onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, kind: e.target.value as Row['kind'] } : x)))}
                  className={`${input} w-[104px] shrink-0`}
                  aria-label={`Stage ${i + 1} kind`}
                >
                  {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
                <input
                  type="number"
                  min={0}
                  value={r.targetDays}
                  onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, targetDays: Number(e.target.value) } : x)))}
                  className={`${input} w-[58px] shrink-0`}
                  aria-label={`Stage ${i + 1} target days`}
                  title="Target days in stage"
                />
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"
                  className="rounded p-1 text-muted-foreground transition hover:bg-accent disabled:opacity-25">
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down"
                  className="rounded p-1 text-muted-foreground transition hover:bg-accent disabled:opacity-25">
                  <ArrowDown className="h-3 w-3" />
                </button>
                <button type="button" onClick={() => setExpanded(expanded === i ? null : i)}
                  className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground">
                  Kit
                </button>
                <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))}
                  disabled={rows.length <= 1} aria-label="Remove stage"
                  className="rounded p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-25">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              {expanded === i && (
                <div className="border-t border-border p-2">
                  <textarea
                    rows={3}
                    value={r.interviewKit}
                    onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, interviewKit: e.target.value } : x)))}
                    placeholder="What this stage is actually for, and what the interviewer should probe."
                    className={`${input} resize-none leading-relaxed`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setRows([...rows, { name: 'New stage', kind: 'Interview', targetDays: 5, interviewKit: '' }])}
          className="flex items-center gap-1.5 rounded-md border border-dashed border-border px-2.5 py-1.5 text-[12px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Add a stage
        </button>

        <p className="text-[11px] text-muted-foreground">
          A stage that still has candidates on it cannot be removed — move them first.
        </p>

        {showProblems && emptyRows.length > 0 && (
          <p role="alert" className="text-[11.5px] text-destructive">
            {emptyRows.length === 1
              ? `Stage ${emptyRows[0] + 1} needs a name.`
              : `Stages ${emptyRows.map((i) => i + 1).join(', ')} need names.`}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className="rounded-md px-2.5 py-1.5 text-[12px] text-muted-foreground transition hover:bg-accent">Cancel</button>
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => {
              setShowProblems(true);
              if (emptyRows.length > 0) return;
              save.mutate();
            }}
            className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            {save.isPending ? 'Saving…' : 'Save pipeline'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
