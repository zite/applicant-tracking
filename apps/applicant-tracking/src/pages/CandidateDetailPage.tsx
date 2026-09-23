import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft, Briefcase, FileText, Github, Globe, Linkedin, Mail, MapPin, Pencil,
  Phone, Sparkles,
} from 'lucide-react';
import {
  addNote, aiParseResume, aiSummarizeCandidate, getApplication, getCandidate,
  moveApplication, updateApplication, type GetApplicationOutputType,
} from 'zitejs/api';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@project/components/ui/dropdown-menu';
import { Avatar } from '../components/Avatar';
import { Rating } from '../components/Rating';
import { StageStepper } from '../components/StageStepper';
import { ActivityFeed } from '../components/ActivityFeed';
import { EmailThread } from '../components/EmailThread';
import { FeedbackPanel } from '../components/FeedbackPanel';
import { OfferPanel } from '../components/OfferPanel';
import { RejectDialog } from '../components/RejectDialog';
import { EditCandidateDialog } from '../components/EditCandidateDialog';
import { useBootstrap, useIntegrations, memberMap } from '../lib/queries';
import { dayLabel, statusTone } from '../lib/format';

const TABS = ['Activity', 'Feedback', 'Email', 'Offer'] as const;
type Tab = (typeof TABS)[number];

export function CandidateDetailPage() {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  // The tab lives in the URL so the inbox can link straight to the feedback a
  // recruiter owes, and so a shared link opens where the sender was looking.
  const tabParam = params.get('tab');
  const tab: Tab = (TABS as readonly string[]).includes(tabParam ?? '') ? (tabParam as Tab) : 'Activity';
  const setTab = (next: Tab) => {
    const p = new URLSearchParams(params);
    if (next === 'Activity') p.delete('tab');
    else p.set('tab', next);
    setParams(p, { replace: true });
  };

  const boot = useBootstrap();
  const integrations = useIntegrations();
  const members = memberMap(boot.data?.team);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const key = ['application', applicationId] as const;
  const detail = useQuery({
    queryKey: key,
    queryFn: () => getApplication({ applicationId: applicationId! }),
    enabled: Boolean(applicationId),
  });

  const candidateId = detail.data?.candidate.id || null;
  const otherAppsQuery = useQuery({
    queryKey: ['candidateApplications', candidateId],
    queryFn: () => getCandidate({ candidateId: candidateId! }),
    enabled: Boolean(candidateId),
    staleTime: 60_000,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    queryClient.invalidateQueries({ queryKey: ['candidates'] });
    queryClient.invalidateQueries({ queryKey: ['bootstrap'] });
  };

  // Rating is a one-click action, so it applies locally and reconciles after.
  const rate = useMutation({
    mutationFn: (rating: number) => updateApplication({ applicationId: applicationId!, rating }),
    onMutate: async (rating) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<GetApplicationOutputType>(key);
      queryClient.setQueryData<GetApplicationOutputType>(key, (old) =>
        old ? { ...old, application: { ...old.application, rating } } : old,
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      toast.error('Could not save that rating');
    },
    onSettled: refresh,
  });

  const setStatus = useMutation({
    mutationFn: (status: 'Active' | 'Hired' | 'Rejected' | 'Withdrawn' | 'On Hold') =>
      updateApplication({ applicationId: applicationId!, status }),
    onSuccess: (_d, status) => {
      refresh();
      toast.success(`Marked as ${status.toLowerCase()}`);
    },
    onError: () => toast.error('Could not update status'),
  });

  // Moving someone is one click and easy to misfire, so every move offers the
  // way back rather than making the user hunt for the previous stage.
  const move = useMutation({
    mutationFn: (vars: { stageId: string; fromStageId?: string | null; silent?: boolean }) =>
      moveApplication({ applicationId: applicationId!, stageId: vars.stageId }),
    onSuccess: (_d, vars) => {
      refresh();
      if (vars.silent || !vars.fromStageId) return;
      const back = vars.fromStageId;
      toast.success('Moved', {
        action: {
          label: 'Undo',
          onClick: () => move.mutate({ stageId: back, silent: true }),
        },
      });
    },
    onError: () => toast.error('Could not move that candidate'),
  });

  const assign = useMutation({
    mutationFn: (ownerId: string | null) =>
      updateApplication({ applicationId: applicationId!, ownerId }),
    onSuccess: () => {
      refresh();
      toast.success('Owner updated');
    },
    onError: () => toast.error('Could not change the owner'),
  });

  const note = useMutation({
    mutationFn: (body: string) => addNote({ applicationId: applicationId!, body }),
    onSuccess: () => {
      refresh();
      toast.success('Note added');
    },
    onError: () => toast.error('Could not add that note'),
  });

  const parseResume = useMutation({
    mutationFn: () => aiParseResume({ applicationId: applicationId! }),
    onSuccess: (r) => {
      if (!r.configured || !r.parsed) {
        toast('Could not read that resume', { description: r.message ?? undefined });
        return;
      }
      refresh();
      toast.success(
        r.fieldsUpdated.length > 0
          ? `Filled ${r.fieldsUpdated.length} empty field${r.fieldsUpdated.length === 1 ? '' : 's'}`
          : 'Resume read — nothing was missing',
      );
    },
    onError: () => toast.error('Could not read that resume'),
  });

  const summarize = useMutation({
    mutationFn: () => aiSummarizeCandidate({ applicationId: applicationId! }),
    onSuccess: (r) => {
      if (!r.configured) {
        toast('AI summaries are not configured', { description: r.message ?? undefined });
        return;
      }
      refresh();
      toast.success('Summary generated');
    },
    onError: () => toast.error('Could not generate a summary'),
  });

  if (detail.isPending) {
    return (
      <div className="flex-1 p-6">
        <div className="mb-4 h-6 w-64 rounded skeleton-shimmer" />
        <div className="mb-6 h-8 w-full max-w-xl rounded skeleton-shimmer" />
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <div className="h-72 rounded-lg skeleton-shimmer" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-lg skeleton-shimmer" style={{ opacity: 1 - i * 0.18 }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (detail.isError || !detail.data) {
    return (
      <div className="grid flex-1 place-items-center text-[13px] text-muted-foreground">
        That candidate could not be loaded.
      </div>
    );
  }

  const { application: app, candidate, stages, interviews, scorecards, activities, emails, offer } =
    detail.data;
  const owner = app.ownerId ? members.get(app.ownerId) : undefined;
  const otherApps = (otherAppsQuery.data?.applications ?? []).filter(
    (o) => o.applicationId !== app.id,
  );

  const links = [
    candidate.linkedInUrl && { icon: Linkedin, href: candidate.linkedInUrl, label: 'LinkedIn' },
    candidate.gitHubUrl && { icon: Github, href: candidate.gitHubUrl, label: 'GitHub' },
    candidate.portfolioUrl && { icon: Globe, href: candidate.portfolioUrl, label: 'Portfolio' },
  ].filter(Boolean) as { icon: typeof Github; href: string; label: string }[];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <header className="sticky top-0 z-10 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <Avatar name={candidate.fullName} src={candidate.avatarUrl} size={30} />
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold tracking-tight">
              {candidate.fullName}
            </h1>
            <p className="truncate text-[11.5px] text-muted-foreground">
              {candidate.headline ?? '—'}
              {candidate.currentCompany ? ` · ${candidate.currentCompany}` : ''}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Rating value={app.rating} size={15} onChange={(v) => rate.mutate(v)} />
            <span
              className={`rounded border px-2 py-0.5 text-[11px] font-medium ${statusTone(app.status)}`}
            >
              {app.status}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger className="rounded-md border border-border px-2 py-1 text-[11.5px] text-muted-foreground transition hover:bg-accent hover:text-foreground">
                Actions
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setStatus.mutate('Active')}>
                  Mark active
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setStatus.mutate('On Hold')}>
                  Put on hold
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setStatus.mutate('Hired')}>
                  Mark hired
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setRejectOpen(true)} className="text-tone-danger">
                  Reject…
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setStatus.mutate('Withdrawn')}>
                  Mark withdrawn
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <StageStepper
          stages={stages}
          currentStageId={app.stageId}
          status={app.status}
          onMove={(id) => move.mutate({ stageId: id, fromStageId: app.stageId })}
          disabled={move.isPending}
        />
      </header>

      <div className="grid flex-1 gap-6 p-4 lg:grid-cols-[264px_1fr]">
        <aside className="space-y-4">
          <section className="rounded-lg border border-border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">Contact</span>
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="flex items-center gap-1 rounded px-1 py-0.5 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
            </div>
            <div className="space-y-2 text-[12.5px]">
              {candidate.email && (
                <a
                  href={`mailto:${candidate.email}`}
                  className="flex items-center gap-2 text-muted-foreground transition hover:text-foreground"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{candidate.email}</span>
                </a>
              )}
              {candidate.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  {candidate.phone}
                </div>
              )}
              {candidate.location && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {candidate.location}
                </div>
              )}
            </div>
            {links.length > 0 && (
              <div className="mt-3 flex gap-1.5 border-t border-border pt-3">
                {links.map(({ icon: Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    title={label}
                    className="rounded-md border border-border p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </a>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-border bg-card p-3">
            <dl className="space-y-2.5">
              {[
                ['Applied for', app.jobTitle ?? '—'],
                ['Stage', app.stageName ?? '—'],
                ['Source', app.source ?? '—'],
                ['Applied', dayLabel(app.appliedDate)],
                ['Experience', candidate.yearsExperience ? `${candidate.yearsExperience} years` : '—'],
                ...(app.rejectionReason ? [['Rejected for', app.rejectionReason]] : []),
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3">
                  <dt className="shrink-0 text-[11px] text-muted-foreground">{k}</dt>
                  <dd className="truncate text-right text-[12.5px]">{v}</dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-3">
                <dt className="shrink-0 text-[11px] text-muted-foreground">Owner</dt>
                <dd className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger className="rounded px-1 py-0.5 text-[12.5px] outline-none transition hover:bg-accent">
                      {owner?.name ?? 'Unassigned'}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                      <DropdownMenuItem onSelect={() => assign.mutate(null)}>Unassigned</DropdownMenuItem>
                      {[...members.values()].map((m) => (
                        <DropdownMenuItem key={m.id} onSelect={() => assign.mutate(m.id)}>
                          {m.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </dd>
              </div>
            </dl>
          </section>

          {otherApps.length > 0 && (
            <section className="rounded-lg border border-border bg-card p-3">
              <div className="mb-2 flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-medium">Also considered for</span>
              </div>
              <div className="space-y-1.5">
                {otherApps.map((o) => (
                  <Link
                    key={o.applicationId}
                    to={`/candidate/${o.applicationId}`}
                    className="block rounded-md border border-border px-2 py-1.5 transition hover:bg-accent"
                  >
                    <div className="truncate text-[12px] font-medium">{o.jobTitle ?? 'Unknown role'}</div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className={`rounded border px-1 py-px text-[10px] ${statusTone(o.status)}`}>
                        {o.status}
                      </span>
                      <span className="truncate text-[10.5px] text-muted-foreground">
                        {o.rejectionReason ?? o.stageName ?? ''}
                      </span>
                      <span className="ml-auto shrink-0"><Rating value={o.rating} size={9} /></span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {candidate.skills.length > 0 && (
            <section className="rounded-lg border border-border bg-card p-3">
              <div className="mb-2 text-[11px] text-muted-foreground">Skills</div>
              <div className="flex flex-wrap gap-1">
                {candidate.skills.map((s) => (
                  <span
                    key={s}
                    className="rounded border border-border bg-muted px-1.5 py-0.5 text-[11px]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-lg border border-border bg-card p-3">
            <div className="mb-2 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] font-medium">Resume</span>
              {candidate.resumeUrl && (
                <button
                  type="button"
                  onClick={() => parseResume.mutate()}
                  disabled={parseResume.isPending}
                  className="ml-auto text-[11px] text-primary transition hover:underline disabled:opacity-50"
                >
                  {parseResume.isPending ? 'Reading…' : 'Read with AI'}
                </button>
              )}
            </div>
            {candidate.resumeUrl ? (
              <a
                href={candidate.resumeUrl}
                target="_blank"
                rel="noreferrer"
                className="block truncate text-[12.5px] text-primary hover:underline"
              >
                Open resume
              </a>
            ) : (
              <p className="text-[12px] text-muted-foreground">
                No resume on file. Candidates can attach one when they apply.
              </p>
            )}
          </section>

          <section className="rounded-lg border border-border bg-card p-3">
            <div className="mb-2 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-medium">AI summary</span>
              <button
                type="button"
                onClick={() => summarize.mutate()}
                disabled={summarize.isPending}
                className="ml-auto text-[11px] text-primary transition hover:underline disabled:opacity-50"
              >
                {summarize.isPending ? 'Thinking…' : candidate.aiSummary ? 'Regenerate' : 'Generate'}
              </button>
            </div>
            {candidate.aiSummary ? (
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                {candidate.aiSummary}
              </p>
            ) : (
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                {integrations.data?.ai.configured === false
                  ? 'Connect an Anthropic account to summarise this candidate from their profile and interview feedback.'
                  : 'Synthesise the profile and every submitted scorecard into a short brief.'}
              </p>
            )}
          </section>
        </aside>

        <div className="min-w-0">
          <div className="mb-4 flex items-center gap-1 border-b border-border">
            {TABS.map((t) => {
              const count =
                t === 'Feedback' ? scorecards.length
                : t === 'Email' ? emails.length
                : t === 'Activity' ? activities.length
                : offer ? 1 : 0;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`-mb-px border-b-2 px-2.5 py-2 text-[12.5px] transition ${
                    tab === t
                      ? 'border-primary font-medium text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t}
                  {count > 0 && (
                    <span className="ml-1.5 rounded bg-muted px-1.5 text-[10.5px] tabular-nums text-muted-foreground">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="animate-fade-rise">
            {tab === 'Activity' && (
              <ActivityFeed
                activities={activities}
                members={members}
                onAddNote={(b) => note.mutate(b)}
                pending={note.isPending}
              />
            )}
            {tab === 'Feedback' && (
              <FeedbackPanel
                interviews={interviews}
                scorecards={scorecards}
                members={members}
                team={boot.data?.team ?? []}
                applicationId={app.id}
                candidateName={candidate.fullName}
                onSubmitted={refresh}
              />
            )}
            {tab === 'Email' && (
              <EmailThread
                emails={emails}
                applicationId={app.id}
                candidateName={candidate.fullName}
                candidateEmail={candidate.email}
                jobTitle={app.jobTitle}
                recruiterName={boot.data?.me?.name || 'Talent team'}
                team={boot.data?.team ?? []}
                emailConfigured={integrations.data?.email.configured ?? true}
                onSent={refresh}
              />
            )}
            {tab === 'Offer' && (
              <OfferPanel offer={offer} applicationId={app.id} onChanged={refresh} />
            )}
          </div>
        </div>
      </div>

      <RejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        applicationIds={[app.id]}
        candidateName={candidate.fullName}
        jobTitle={app.jobTitle}
        onDone={refresh}
      />

      <EditCandidateDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        candidate={{
          id: candidate.id,
          fullName: candidate.fullName,
          email: candidate.email,
          phone: candidate.phone,
          headline: candidate.headline,
          currentCompany: candidate.currentCompany,
          location: candidate.location,
          linkedInUrl: candidate.linkedInUrl,
          gitHubUrl: candidate.gitHubUrl,
          portfolioUrl: candidate.portfolioUrl,
          resumeUrl: candidate.resumeUrl,
          yearsExperience: candidate.yearsExperience,
          tags: candidate.tags,
          skills: candidate.skills,
        }}
        onSaved={refresh}
      />
    </div>
  );
}

