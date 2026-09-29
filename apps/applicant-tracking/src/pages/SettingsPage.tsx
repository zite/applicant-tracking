import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, CircleSlash, Loader2, Mail, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { deleteEmailTemplate, listEmailTemplates, removeTeamMember, seedDemoData } from 'zitejs/api';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@project/components/ui/alert-dialog';
import { TeamMemberDialog } from '../components/TeamMemberDialog';
import { TemplateDialog, type TemplateRow } from '../components/TemplateDialog';
import type { TeamMember } from '../lib/queries';
import { PageHeader } from '../components/PageHeader';
import { Avatar } from '../components/Avatar';
import { useBootstrap, useIntegrations } from '../lib/queries';
import { SAMPLE_PHASES } from '../lib/seedData';
import { parseApiError } from '../lib/validation';

function IntegrationRow({
  icon: Icon,
  name,
  connected,
  connectedNote,
  disconnectedNote,
  steps,
}: {
  icon: typeof Mail;
  name: string;
  connected: boolean;
  connectedNote: string;
  disconnectedNote: string;
  steps: string[];
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 rounded-md border border-border bg-muted p-1.5 text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium">{name}</span>
            <span
              className={`flex items-center gap-1 rounded border px-1.5 py-px text-[10.5px] font-medium ${
                connected
                  ? 'border-tone-success/30 bg-tone-success/10 text-tone-success'
                  : 'border-tone-warning/30 bg-tone-warning/10 text-tone-warning'
              }`}
            >
              {connected ? <CheckCircle2 className="h-3 w-3" /> : <CircleSlash className="h-3 w-3" />}
              {connected ? 'Connected' : 'Not connected'}
            </span>
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
            {connected ? connectedNote : disconnectedNote}
          </p>
          {!connected && (
            <ol className="mt-2.5 space-y-1 border-l border-border pl-3 text-[12px] text-muted-foreground">
              {steps.map((s, i) => (
                <li key={i}>
                  <span className="mr-1.5 text-muted-foreground">{i + 1}.</span>
                  {s}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

// Kept deliberately quiet at the bottom of Settings. It only renders for an
// admin while the workspace has no jobs or candidates (bootstrap decides, and
// seedDemoData enforces the same rule), and it stays mounted while it runs so a
// refetch mid-load cannot pull it out from under the progress label.
function SampleDataSection() {
  const boot = useBootstrap();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [step, setStep] = useState(0);

  const load = useMutation({
    mutationFn: async () => {
      for (let phase = 1; phase <= SAMPLE_PHASES.length; phase++) {
        setStep(phase);
        const result = await seedDemoData({ phase });
        if (result.done) break;
      }
    },
    onSuccess: () => toast.success('Sample data loaded'),
    onError: (error) => toast.error(parseApiError(error).message || 'Could not load the sample data'),
    onSettled: () => queryClient.invalidateQueries(),
  });

  if (load.isSuccess || (!boot.data?.canLoadSampleData && !load.isPending)) return null;

  return (
    <section>
      <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Sample data
      </h2>
      <p className="mb-2.5 text-[12px] text-muted-foreground">
        Adds a fictional company with jobs, candidates and interviews, so you can try every
        screen.
      </p>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={load.isPending}
        className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11.5px] text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:pointer-events-none"
      >
        {load.isPending ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            {SAMPLE_PHASES[step - 1] ?? 'Starting'} ({step} of {SAMPLE_PHASES.length})
          </>
        ) : (
          'Load sample data'
        )}
      </button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px]">Load the sample data?</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] leading-relaxed">
              This adds Northwind Labs, a fictional company: 9 team members, 8 jobs with their
              pipelines, 72 candidates, and their interviews, feedback, offers and emails. Some of
              its candidates and interview panels are assigned to you, and its 7 published jobs
              appear on your careers site. There is no one-click way to remove it afterwards, so
              only load it into a workspace you are using to try the app.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-[12.5px]">Cancel</AlertDialogCancel>
            <AlertDialogAction className="text-[12.5px]" onClick={() => load.mutate()}>
              Load sample data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export function SettingsPage() {
  const boot = useBootstrap();
  const integrations = useIntegrations();
  const queryClient = useQueryClient();
  const email = integrations.data?.email;
  const ai = integrations.data?.ai;

  const [memberOpen, setMemberOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateRow | null>(null);
  // Deleting used to fire straight off the icon click. Both of these are
  // one-click destructive, so both now ask first.
  const [confirmMember, setConfirmMember] = useState<TeamMember | null>(null);
  const [confirmTemplate, setConfirmTemplate] = useState<TemplateRow | null>(null);

  const templates = useQuery({
    queryKey: ['emailTemplates'],
    queryFn: () => listEmailTemplates({}),
    staleTime: 60_000,
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) => removeTeamMember({ memberId }),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['bootstrap'] });
      toast.success(
        r.deactivatedInstead
          ? `Deactivated — ${r.references} records still reference them, so the history is kept`
          : 'Removed from the team',
      );
    },
    onError: () => toast.error('Could not remove that person'),
  });

  const removeTemplate = useMutation({
    mutationFn: (templateId: string) => deleteEmailTemplate({ templateId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailTemplates'] });
      toast.success('Template deleted');
    },
    onError: () => toast.error('Could not delete that template'),
  });

  return (
    <>
      <PageHeader title="Settings" subtitle="Integrations and team" />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-2xl space-y-6 animate-fade-rise">
          <section>
            <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Integrations
            </h2>
            <p className="mb-3 text-[12.5px] leading-relaxed text-muted-foreground">
              The app is fully usable without either of these. They are additive: without
              email, messages are still written to the candidate&rsquo;s thread; without an AI
              account, every screen works, just without drafting and summarising.
            </p>
            <div className="space-y-2.5">
              <IntegrationRow
                icon={Mail}
                name="Candidate email"
                connected={email?.configured ?? false}
                connectedNote="Messages you compose are delivered to candidates and logged to their thread."
                disconnectedNote={
                  email && email.undeliveredCount > 0
                    ? `${email.undeliveredCount} message${email.undeliveredCount === 1 ? '' : 's'} are saved to threads but were never delivered.`
                    : 'Messages are saved to the candidate thread but not delivered to their inbox.'
                }
                steps={[
                  'Open this workspace in the Zite editor.',
                  'Go to integrations and connect an email account.',
                  'Choose the built-in Zite gateway, or Gmail/Outlook to send from your own address.',
                ]}
              />
              <IntegrationRow
                icon={Sparkles}
                name="AI drafting and summaries"
                connected={ai?.configured ?? false}
                connectedNote={`Connected via ${ai?.provider ?? 'an AI provider'}. Candidate summaries and email drafts are available.`}
                disconnectedNote="Candidate summaries and AI email drafting are unavailable. Everything else works normally."
                steps={[
                  'Open this workspace in the Zite editor.',
                  'Go to integrations and connect an Anthropic account.',
                  'Reload the app — the AI actions become available immediately.',
                ]}
              />
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Hiring team
              </h2>
              <button
                type="button"
                onClick={() => { setEditingMember(null); setMemberOpen(true); }}
                className="ml-auto flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11.5px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>
            <p className="mb-2 text-[12px] text-muted-foreground">
              Who can own an application, sit on a panel, or write feedback. Matched to the
              signed-in user by email.
            </p>
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {(boot.data?.team ?? []).map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Avatar name={m.name} src={m.avatarUrl} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium leading-tight">{m.name}</div>
                    <div className="truncate text-[11.5px] text-muted-foreground">
                      {m.title ?? '—'}
                      {m.email ? ` · ${m.email}` : ''}
                    </div>
                  </div>
                  <span className="rounded border border-border bg-muted px-1.5 py-px text-[10.5px] text-muted-foreground">
                    {m.role ?? 'Member'}
                  </span>
                  <button
                    type="button"
                    aria-label={`Edit ${m.name}`}
                    onClick={() => { setEditingMember(m); setMemberOpen(true); }}
                    className="rounded p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${m.name}`}
                    onClick={() => setConfirmMember(m)}
                    className="rounded p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Email templates
              </h2>
              <button
                type="button"
                onClick={() => { setEditingTemplate(null); setTemplateOpen(true); }}
                className="ml-auto flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11.5px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <Plus className="h-3 w-3" /> New
              </button>
            </div>
            <p className="mb-2 text-[12px] text-muted-foreground">
              Available when composing to a candidate and when rejecting. Placeholders are
              filled in per candidate.
            </p>
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {(templates.data?.templates ?? []).map((tpl) => (
                <div key={tpl.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium leading-tight">{tpl.name}</div>
                    <div className="truncate text-[11.5px] text-muted-foreground">{tpl.subject}</div>
                  </div>
                  <span className="shrink-0 rounded border border-border bg-muted px-1.5 py-px text-[10.5px] text-muted-foreground">
                    {tpl.category}
                  </span>
                  <button
                    type="button"
                    aria-label={`Edit ${tpl.name}`}
                    onClick={() => { setEditingTemplate(tpl); setTemplateOpen(true); }}
                    className="rounded p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${tpl.name}`}
                    onClick={() => setConfirmTemplate(tpl)}
                    className="rounded p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {templates.data?.templates.length === 0 && (
                <p className="px-3 py-6 text-center text-[12.5px] text-muted-foreground">
                  No templates yet.
                </p>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Keyboard
            </h2>
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              {[
                ['⌘K  /', 'Open the command palette'],
                ['G then P', 'Go to Pipeline'],
                ['G then C', 'Go to Candidates'],
                ['G then I', 'Go to Interviews'],
                ['G then J', 'Go to Jobs'],
                ['G then A', 'Go to Analytics'],
                ['J  K', 'Move through a candidate list'],
                ['↵', 'Open the selected candidate'],
                ['⌘↵', 'Post a note'],
              ].map(([keys, what]) => (
                <div
                  key={keys}
                  className="flex items-center gap-3 border-b border-border/60 px-3 py-2 last:border-0"
                >
                  <span className="flex w-24 shrink-0 gap-1">
                    {keys.split(/\s+/).map((k) => (
                      <span key={k} className="kbd">
                        {k}
                      </span>
                    ))}
                  </span>
                  <span className="text-[12.5px] text-muted-foreground">{what}</span>
                </div>
              ))}
            </div>
          </section>

          <SampleDataSection />
        </div>
      </div>

      <AlertDialog open={Boolean(confirmMember)} onOpenChange={(v) => !v && setConfirmMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px]">
              Remove {confirmMember?.name} from the team?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] leading-relaxed">
              If anything still references them — an application they own, a panel they sat
              on, a note they wrote — they are deactivated instead of deleted, so that history
              stays intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-[12.5px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground text-[12.5px] hover:opacity-90"
              onClick={() => {
                if (confirmMember) removeMember.mutate(confirmMember.id);
                setConfirmMember(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(confirmTemplate)} onOpenChange={(v) => !v && setConfirmTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px]">
              Delete the “{confirmTemplate?.name}” template?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] leading-relaxed">
              Emails already sent with it are untouched. This only removes it from the
              template picker, and it cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-[12.5px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground text-[12.5px] hover:opacity-90"
              onClick={() => {
                if (confirmTemplate) removeTemplate.mutate(confirmTemplate.id);
                setConfirmTemplate(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TeamMemberDialog open={memberOpen} onOpenChange={setMemberOpen} member={editingMember} />
      <TemplateDialog open={templateOpen} onOpenChange={setTemplateOpen} template={editingTemplate} />
    </>
  );
}
