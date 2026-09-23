import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { upsertInterview } from 'zitejs/api';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@project/components/ui/dialog';
import { Avatar } from './Avatar';
import type { TeamMember } from '../lib/queries';

const TYPES = [
  'Recruiter Screen', 'Phone Screen', 'Technical', 'System Design',
  'Behavioral', 'Hiring Manager', 'Onsite', 'Culture', 'Final',
];
const DURATIONS = [30, 45, 60, 90, 120, 180];

// Defaults to the next working hour rather than an empty field — scheduling is
// usually "soon", and a prefilled sensible time is one less thing to type.
function defaultSlot() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ScheduleInterviewDialog({
  open,
  onOpenChange,
  applicationId,
  candidateName,
  team,
  onScheduled,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  applicationId: string;
  candidateName: string;
  team: TeamMember[];
  onScheduled: () => void;
}) {
  const [type, setType] = useState('Technical');
  const [at, setAt] = useState(defaultSlot);
  const [duration, setDuration] = useState(60);
  const [link, setLink] = useState('https://meet.google.com/');
  const [panel, setPanel] = useState<string[]>([]);
  const [showProblems, setShowProblems] = useState(false);
  const missingTime = !at;
  // A past time is legitimate — people log interviews after the fact — so this
  // informs rather than blocks.
  const inPast = Boolean(at) && new Date(at).getTime() < Date.now();

  const save = useMutation({
    mutationFn: () =>
      upsertInterview({
        applicationId,
        title: `${type} — ${candidateName}`,
        type,
        // datetime-local has no zone; treat it as the viewer's local time.
        scheduledAt: new Date(at).toISOString(),
        durationMinutes: duration,
        interviewerIds: panel,
        meetingLink: link.trim() || undefined,
        status: 'Scheduled',
      }),
    onSuccess: () => {
      onOpenChange(false);
      onScheduled();
      toast.success('Interview scheduled');
    },
    onError: () => toast.error('Could not schedule that interview'),
  });

  const toggle = (id: string) =>
    setPanel((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const input =
    'w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-[12.5px] outline-none focus:border-primary/60';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[14px]">Schedule an interview</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11px] text-muted-foreground">Type</span>
            <select value={type} onChange={(e) => setType(e.target.value)} className={input}>
              {TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-muted-foreground">Duration</span>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className={input}
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>{d} minutes</option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[11px] text-muted-foreground">When</span>
            <input
              type="datetime-local"
              name="scheduledAt"
              value={at}
              onChange={(e) => setAt(e.target.value)}
              aria-invalid={showProblems && missingTime}
              className={`${input} ${showProblems && missingTime ? 'border-destructive' : ''}`}
            />
            {showProblems && missingTime ? (
              <span role="alert" className="mt-1 block text-[11.5px] text-destructive">
                Pick a date and time for this interview
              </span>
            ) : inPast ? (
              <span className="mt-1 block text-[11.5px] text-tone-warning">
                That time is in the past — this will be logged as an interview that already happened.
              </span>
            ) : null}
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[11px] text-muted-foreground">Meeting link</span>
            <input value={link} onChange={(e) => setLink(e.target.value)} className={input} />
          </label>
        </div>

        <div>
          <div className="mb-1.5 text-[11px] text-muted-foreground">
            Interviewers {panel.length > 0 ? `(${panel.length})` : ''}
            {panel.length === 0 && (
              <span className="ml-1 text-muted-foreground">
                — nobody selected, so no scorecard will be opened
              </span>
            )}
          </div>
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {team.map((m) => {
              const on = panel.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m.id)}
                  className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11.5px] transition ${
                    on
                      ? 'border-primary bg-primary/12 text-primary'
                      : 'border-border text-muted-foreground hover:bg-accent'
                  }`}
                >
                  <Avatar name={m.name} src={m.avatarUrl} size={16} />
                  {m.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md px-2.5 py-1.5 text-[12px] text-muted-foreground transition hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => {
              setShowProblems(true);
              if (missingTime) {
                document.querySelector<HTMLElement>('[name="scheduledAt"]')?.focus();
                return;
              }
              save.mutate();
            }}
            className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            {save.isPending ? 'Scheduling…' : 'Schedule'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
