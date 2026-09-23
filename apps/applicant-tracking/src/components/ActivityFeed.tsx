import { useState } from 'react';
import {
  CalendarPlus, CircleDot, FileText, Mail, MessageSquare, Star, UserPlus, Workflow,
} from 'lucide-react';
import { Avatar } from './Avatar';
import { relativeDate } from '../lib/format';
import type { TeamMember } from '../lib/queries';

type Activity = {
  id: string;
  type: string | null;
  summary: string | null;
  body: string | null;
  occurredAt: string | null;
  authorId: string | null;
};

const ICON: Record<string, typeof Mail> = {
  Note: MessageSquare,
  'Stage Change': Workflow,
  Email: Mail,
  'Interview Scheduled': CalendarPlus,
  Scorecard: FileText,
  'Application Created': UserPlus,
  'Status Change': CircleDot,
  Offer: FileText,
  Rating: Star,
};

export function ActivityFeed({
  activities,
  members,
  onAddNote,
  pending,
}: {
  activities: Activity[];
  members: Map<string, TeamMember>;
  onAddNote: (body: string) => void;
  pending: boolean;
}) {
  const [note, setNote] = useState('');

  const submit = () => {
    const trimmed = note.trim();
    if (!trimmed) return;
    onAddNote(trimmed);
    setNote('');
  };

  return (
    <div>
      <div className="mb-4 rounded-lg border border-border bg-card p-2.5">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            // Cmd/Ctrl-Enter submits, matching every other comment box worth using.
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
          placeholder="Leave a note for the hiring team…"
          className="w-full resize-none bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
        />
        <div className="mt-1.5 flex items-center justify-end gap-2">
          <span className="text-[10.5px] text-muted-foreground">
            <span className="kbd">⌘</span> <span className="kbd">↵</span> to post
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={!note.trim() || pending}
            className="rounded-md bg-primary px-2.5 py-1 text-[12px] font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            Post
          </button>
        </div>
      </div>

      <ol className="relative space-y-0">
        {activities.map((a, i) => {
          const Icon = ICON[a.type ?? ''] ?? CircleDot;
          const author = a.authorId ? members.get(a.authorId) : undefined;
          const last = i === activities.length - 1;
          return (
            <li key={a.id} className="relative flex gap-3 pb-4">
              {!last && (
                <span className="absolute left-[11px] top-6 h-full w-px bg-border" aria-hidden />
              )}
              <span className="relative z-10 mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
                <Icon className="h-3 w-3" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-1.5">
                  {author && (
                    <span className="inline-flex items-center gap-1.5">
                      <Avatar name={author.name} src={author.avatarUrl} size={16} />
                      <span className="text-[12.5px] font-medium">{author.name}</span>
                    </span>
                  )}
                  <span className="text-[12.5px] text-muted-foreground">{a.summary}</span>
                  <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                    {relativeDate(a.occurredAt)}
                  </span>
                </div>
                {a.body && (
                  <p className="mt-1.5 whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-2 text-[12.5px] leading-relaxed">
                    {a.body}
                  </p>
                )}
              </div>
            </li>
          );
        })}
        {activities.length === 0 && (
          <li className="py-6 text-center text-[12.5px] text-muted-foreground">
            Nothing has happened on this application yet.
          </li>
        )}
      </ol>
    </div>
  );
}
