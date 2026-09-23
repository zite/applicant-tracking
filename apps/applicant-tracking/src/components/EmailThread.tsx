import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Mail, Send, Sparkles, TriangleAlert } from 'lucide-react';
import { aiDraftEmail, listEmailTemplates, sendCandidateEmail } from 'zitejs/api';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@project/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@project/components/ui/dropdown-menu';
import { dateTimeLabel } from '../lib/format';

type Email = {
  id: string;
  subject: string | null;
  direction: string | null;
  status: string | null;
  fromEmail: string | null;
  toEmail: string | null;
  body: string | null;
  sentAt: string | null;
};

const fill = (text: string, vars: Record<string, string>) =>
  text.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => vars[k] ?? `{{${k}}}`);

export function EmailThread({
  emails,
  applicationId,
  candidateName,
  candidateEmail,
  jobTitle,
  recruiterName,
  team,
  emailConfigured,
  onSent,
}: {
  emails: Email[];
  applicationId: string;
  candidateName: string;
  candidateEmail: string | null;
  jobTitle: string | null;
  recruiterName: string;
  team: { name: string; email: string | null }[];
  emailConfigured: boolean;
  onSent: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showProblems, setShowProblems] = useState(false);
  const missing = [
    !subject.trim() ? 'a subject' : null,
    !body.trim() ? 'a message' : null,
  ].filter(Boolean) as string[];

  const templates = useQuery({
    queryKey: ['emailTemplates'],
    queryFn: () => listEmailTemplates({}),
    staleTime: 10 * 60_000,
    enabled: open,
  });

  const vars = {
    firstName: candidateName.split(' ')[0] ?? candidateName,
    job: jobTitle ?? 'the role',
    recruiter: recruiterName,
    company: 'your current company',
  };

  // Outbound rows are labelled with whoever actually sent the message, resolved
  // from the stored fromEmail against the hiring team. recruiterName is only the
  // signed-in user, so it is the fallback rather than a blanket label — a thread
  // usually holds messages several colleagues sent.
  const senderLabel = (fromEmail: string | null) => {
    const from = (fromEmail ?? '').trim().toLowerCase();
    const match = from
      ? team.find((t) => (t.email ?? '').trim().toLowerCase() === from)
      : undefined;
    return match?.name || recruiterName;
  };

  const draft = useMutation({
    mutationFn: (intent: 'screen_invite' | 'schedule_loop' | 'rejection' | 'offer' | 'nudge') =>
      aiDraftEmail({ applicationId, intent }),
    onSuccess: (r) => {
      if (!r.configured) {
        toast('AI drafting is not configured', { description: r.message ?? undefined });
        return;
      }
      if (r.subject) setSubject(r.subject);
      if (r.body) setBody(r.body);
    },
    onError: () => toast.error('Could not draft that email'),
  });

  const send = useMutation({
    mutationFn: () => sendCandidateEmail({ applicationId, subject, body }),
    onSuccess: (r) => {
      setOpen(false);
      setSubject('');
      setBody('');
      onSent();
      if (r.delivered) {
        toast.success(`Sent to ${candidateName}`);
      } else {
        // The message is saved either way — say so plainly instead of
        // pretending it went out.
        toast('Saved to the thread, not sent', {
          description: 'Connect an email account to deliver messages to candidates.',
        });
      }
    },
    onError: () => toast.error('Could not save that message'),
  });

  const undelivered = emails.some((e) => e.status === 'Logged (Not Sent)');

  return (
    <div>
      {(!emailConfigured || undelivered) && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-tone-warning/30 bg-tone-warning/10 p-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-tone-warning" />
          <div className="flex-1 text-[12.5px]">
            <div className="font-medium text-tone-warning">Email delivery is not connected</div>
            <p className="mt-0.5 text-muted-foreground">
              Messages you write are saved to the candidate&rsquo;s thread but will not reach their
              inbox. Everything else in the app works normally.
            </p>
            <Link
              to="/settings"
              className="mt-1.5 inline-block font-medium text-tone-warning underline underline-offset-2"
            >
              How to connect email
            </Link>
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <div className="text-[12.5px] text-muted-foreground">
          {candidateEmail ?? 'No email address on file'}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              disabled={!candidateEmail}
              title={candidateEmail ? undefined : 'Add an email address to this candidate first'}
              className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-[12px] font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
            >
              <Mail className="h-3.5 w-3.5" />
              Compose
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-[14px]">Email {candidateName}</DialogTitle>
            </DialogHeader>

            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger className="rounded-md border border-border px-2 py-1 text-[12px] text-muted-foreground transition hover:bg-accent hover:text-foreground">
                  Use a template
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  {(templates.data?.templates ?? []).map((t) => (
                    <DropdownMenuItem
                      key={t.id}
                      onSelect={() => {
                        setSubject(fill(t.subject ?? '', vars));
                        setBody(fill(t.body ?? '', vars));
                      }}
                    >
                      <span className="truncate">{t.name}</span>
                      <span className="ml-auto text-[10.5px] text-muted-foreground">
                        {t.category}
                      </span>
                    </DropdownMenuItem>
                  ))}
                  {templates.data?.templates.length === 0 && (
                    <DropdownMenuItem disabled>No templates yet</DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px] text-muted-foreground transition hover:bg-accent hover:text-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                  {draft.isPending ? 'Drafting…' : 'Draft with AI'}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onSelect={() => draft.mutate('screen_invite')}>
                    Invite to a screen
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => draft.mutate('schedule_loop')}>
                    Invite to the final loop
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => draft.mutate('nudge')}>
                    Follow up on silence
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => draft.mutate('offer')}>
                    Extend an offer
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => draft.mutate('rejection')}>
                    Let them down kindly
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <input
              value={subject}
              name="subject"
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              aria-invalid={showProblems && !subject.trim()}
              className={`w-full rounded-md border bg-transparent px-2.5 py-1.5 text-[13px] outline-none ${
                showProblems && !subject.trim() ? 'border-destructive' : 'border-input focus:border-primary/60'
              }`}
            />
            <textarea
              value={body}
              name="body"
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              placeholder="Write your message…"
              aria-invalid={showProblems && !body.trim()}
              className={`w-full resize-none rounded-md border bg-transparent px-2.5 py-2 text-[13px] leading-relaxed outline-none ${
                showProblems && !body.trim() ? 'border-destructive' : 'border-input focus:border-primary/60'
              }`}
            />

            <div className="flex items-center justify-end gap-2">
              <span aria-live="polite" className="mr-auto text-[11.5px] text-destructive">
                {showProblems && missing.length > 0 ? `This email still needs ${missing.join(' and ')}.` : ''}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-2.5 py-1.5 text-[12px] text-muted-foreground transition hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={send.isPending}
                onClick={() => {
                  setShowProblems(true);
                  if (missing.length > 0) {
                    document.querySelector<HTMLElement>(!subject.trim() ? '[name="subject"]' : '[name="body"]')?.focus();
                    return;
                  }
                  send.mutate();
                }}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
                {send.isPending ? 'Sending…' : emailConfigured ? 'Send' : 'Save to thread'}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {emails.map((e) => {
          const outbound = e.direction === 'Outbound';
          return (
            <div
              key={e.id}
              className={`rounded-lg border p-3 ${
                outbound ? 'border-border bg-card' : 'border-border bg-muted/40'
              }`}
            >
              <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2">
                <span className="text-[12.5px] font-medium">
                  {outbound ? senderLabel(e.fromEmail) : candidateName}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {outbound ? `to ${e.toEmail ?? '—'}` : `from ${e.fromEmail ?? '—'}`}
                </span>
                {e.status === 'Logged (Not Sent)' && (
                  <span className="rounded border border-tone-warning/30 bg-tone-warning/10 px-1.5 py-px text-[10px] text-tone-warning">
                    not sent
                  </span>
                )}
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {dateTimeLabel(e.sentAt)}
                </span>
              </div>
              <div className="text-[12.5px] font-medium">{e.subject}</div>
              <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted-foreground">
                {e.body}
              </p>
            </div>
          );
        })}
        {emails.length === 0 && (
          <div className="py-8 text-center text-[12.5px] text-muted-foreground">
            No messages yet. Compose the first one.
          </div>
        )}
      </div>
    </div>
  );
}
