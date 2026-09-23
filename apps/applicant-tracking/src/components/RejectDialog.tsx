import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { TriangleAlert } from 'lucide-react';
import { bulkUpdateApplications, listEmailTemplates } from 'zitejs/api';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@project/components/ui/dialog';
import { useIntegrations } from '../lib/queries';

const REASONS = [
  'Lacking Experience', 'Skills Mismatch', 'Compensation', 'Location',
  'Culture Fit', 'Accepted Other Offer', 'Unresponsive', 'Role Closed', 'Other',
];

// Rejecting without a reason is how a pipeline stops being able to explain
// itself six months later, so the reason is required. The email is optional and
// off by default — a bulk reject that silently mails 40 people would be a bad
// surprise, so it is always an explicit opt-in and capped server-side at 25.
const EMAIL_CAP = 25;

export function RejectDialog({
  open,
  onOpenChange,
  applicationIds,
  candidateName,
  jobTitle,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  applicationIds: string[];
  candidateName?: string;
  jobTitle?: string | null;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const integrations = useIntegrations();
  const [reason, setReason] = useState(REASONS[0]);
  const [sendEmail, setSendEmail] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const templates = useQuery({
    queryKey: ['emailTemplates'],
    queryFn: () => listEmailTemplates({}),
    staleTime: 10 * 60_000,
    enabled: open,
  });

  const many = applicationIds.length > 1;
  const canEmail = applicationIds.length <= EMAIL_CAP;

  useEffect(() => {
    if (!open) return;
    setReason(REASONS[0]);
    setSendEmail(false);
    const tpl = templates.data?.templates.find((t) => t.category === 'Rejection');
    const job = jobTitle ?? 'the role';
    setSubject((tpl?.subject ?? 'Update on your application').replace(/\{\{job\}\}/g, job));
    setBody(
      (tpl?.body ?? 'Hi {{firstName}},\n\nThank you for your time. We have decided not to move forward at this stage.\n\nAll the best.')
        .replace(/\{\{job\}\}/g, job)
        .replace(/\{\{recruiter\}\}/g, 'the talent team'),
    );
  }, [open, templates.data, jobTitle]);

  const reject = useMutation({
    mutationFn: () =>
      bulkUpdateApplications({
        applicationIds,
        op: 'reject',
        rejectionReason: reason,
        sendRejectionEmail: sendEmail && canEmail,
        emailSubject: subject,
        emailBody: body,
      }),
    onSuccess: (r) => {
      onOpenChange(false);
      queryClient.invalidateQueries();
      onDone();
      const who = many ? `${r.updated} candidates` : (candidateName ?? 'Candidate');
      if (r.emailsLogged > 0) {
        toast(`${who} rejected — ${r.emailsLogged} email${r.emailsLogged === 1 ? '' : 's'} saved, not sent`, {
          description: 'Connect an email account to deliver them.',
        });
      } else if (r.emailsSent > 0) {
        toast.success(`${who} rejected, ${r.emailsSent} email${r.emailsSent === 1 ? '' : 's'} sent`);
      } else {
        toast.success(`${who} rejected`);
      }
      if (r.failed > 0) toast.error(`${r.failed} could not be updated`);
    },
    onError: () => toast.error('Could not reject'),
  });

  const input =
    'w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-[12.5px] outline-none focus:border-primary/60';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[14px]">
            {many ? `Reject ${applicationIds.length} candidates` : `Reject ${candidateName ?? 'candidate'}`}
          </DialogTitle>
        </DialogHeader>

        <label className="block">
          <span className="mb-1 block text-[11px] text-muted-foreground">Reason</span>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className={input}>
            {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Recorded on the application and visible in source and funnel reporting.
          </span>
        </label>

        <label className="flex items-start gap-2 rounded-md border border-border px-3 py-2">
          <input
            type="checkbox"
            checked={sendEmail}
            disabled={!canEmail}
            onChange={(e) => setSendEmail(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 accent-[hsl(var(--primary))]"
          />
          <span className="flex-1">
            <span className="block text-[12.5px]">Send a rejection email</span>
            <span className="block text-[11px] text-muted-foreground">
              {canEmail
                ? 'Off by default. {{firstName}} is filled in per candidate.'
                : `Disabled above ${EMAIL_CAP} candidates — send those in smaller batches.`}
            </span>
          </span>
        </label>

        {sendEmail && (
          <>
            {integrations.data?.email.configured === false && (
              <div className="flex items-start gap-2 rounded-md border border-tone-warning/30 bg-tone-warning/10 p-2.5">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-tone-warning" />
                <span className="text-[11.5px] text-muted-foreground">
                  Email delivery is not connected. These will be saved to each thread but not sent.
                </span>
              </div>
            )}
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className={input} placeholder="Subject" />
            <textarea
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className={`${input} resize-none leading-relaxed`}
            />
          </>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className="rounded-md px-2.5 py-1.5 text-[12px] text-muted-foreground transition hover:bg-accent">
            Cancel
          </button>
          <button
            type="button"
            disabled={reject.isPending || (sendEmail && (!subject.trim() || !body.trim()))}
            onClick={() => reject.mutate()}
            className="rounded-md bg-destructive px-3 py-1.5 text-[12px] font-medium text-destructive-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            {reject.isPending ? 'Rejecting…' : many ? `Reject ${applicationIds.length}` : 'Reject'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
