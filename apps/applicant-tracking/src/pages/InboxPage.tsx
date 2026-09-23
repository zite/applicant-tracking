import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlarmClock, CalendarClock, CheckCircle2, FileText, Inbox, Sparkles, Video, Wallet,
} from 'lucide-react';
import { listMyWork } from 'zitejs/api';
import { Avatar } from '../components/Avatar';
import { PageHeader } from '../components/PageHeader';
import { useBootstrap } from '../lib/queries';
import { dateTimeLabel, money, relativeDate } from '../lib/format';

// The morning screen. Five queues, each one actionable, ordered by how much the
// hiring process suffers if you ignore it: feedback blocks a decision, an
// interview is about to start, a stalled candidate is quietly going cold.

function Section({
  icon: Icon,
  title,
  count,
  tone = 'default',
  empty,
  children,
}: {
  icon: typeof Inbox;
  title: string;
  count: number;
  tone?: 'default' | 'warn';
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <Icon
          className={`h-3.5 w-3.5 ${tone === 'warn' ? 'text-tone-warning' : 'text-muted-foreground'}`}
        />
        <h2 className="text-[12px] font-medium">{title}</h2>
        {count > 0 && (
          <span
            className={`rounded px-1.5 text-[11px] tabular-nums ${
              tone === 'warn' ? 'bg-tone-warning/10 text-tone-warning' : 'bg-muted text-muted-foreground'
            }`}
          >
            {count}
          </span>
        )}
      </div>
      {count === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-3 py-5 text-center text-[12px] text-muted-foreground">
          {empty}
        </div>
      ) : (
        <div className="space-y-1.5">{children}</div>
      )}
    </section>
  );
}

function Row({
  onClick,
  children,
}: {
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`card-hover flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      {children}
    </div>
  );
}

export function InboxPage() {
  const navigate = useNavigate();
  const boot = useBootstrap();
  const q = useQuery({
    queryKey: ['myWork'],
    queryFn: () => listMyWork({}),
    staleTime: 20_000,
  });

  const open = (applicationId: string | null, tab?: string) => {
    if (!applicationId) return;
    navigate(`/candidate/${applicationId}${tab ? `?tab=${tab}` : ''}`);
  };

  const firstName = (boot.data?.me?.name ?? '').split(' ')[0];
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  if (q.isPending) {
    return (
      <>
        <PageHeader title="Inbox" />
        <div className="flex-1 space-y-6 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-40 rounded skeleton-shimmer" />
              {Array.from({ length: 3 }).map((__, j) => (
                <div key={j} className="h-12 rounded-lg skeleton-shimmer" style={{ opacity: 1 - j * 0.2 }} />
              ))}
            </div>
          ))}
        </div>
      </>
    );
  }

  const d = q.data;
  const total =
    (d?.feedbackDue.length ?? 0) +
    (d?.interviewsToday.length ?? 0) +
    (d?.stale.length ?? 0) +
    (d?.unreviewed.length ?? 0) +
    (d?.offersToApprove.length ?? 0);

  return (
    <>
      <PageHeader
        title={firstName ? `${greeting}, ${firstName}` : 'Inbox'}
        subtitle={total === 0 ? 'Nothing needs you right now' : `${total} things need you`}
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4 animate-fade-rise">
        <div className="mx-auto max-w-3xl space-y-7">
          {total === 0 && (
            <div className="rounded-lg border border-border bg-card px-4 py-14 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-7 w-7 text-tone-success" />
              <div className="text-[14px] font-medium">You are all caught up</div>
              <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">
                No feedback outstanding, nothing stalled, and no offers waiting on you.
                The pipeline is where you left it.
              </p>
            </div>
          )}

          <Section
            icon={FileText}
            title="Feedback you owe"
            count={d?.feedbackDue.length ?? 0}
            tone="warn"
            empty="No outstanding scorecards."
          >
            {d?.feedbackDue.map((f) => (
              <Row key={f.scorecardId} onClick={() => open(f.applicationId, 'Feedback')}>
                <Avatar name={f.candidateName ?? '?'} src={f.candidateAvatar} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium leading-tight">
                    {f.candidateName ?? 'Unknown candidate'}
                  </div>
                  <div className="truncate text-[11.5px] text-muted-foreground">
                    {f.interviewType} · {f.jobTitle ?? '—'}
                  </div>
                </div>
                <span className="shrink-0 text-[11.5px] text-tone-warning">
                  interviewed {relativeDate(f.scheduledAt)}
                </span>
              </Row>
            ))}
          </Section>

          <Section
            icon={CalendarClock}
            title="Your next interviews"
            count={d?.interviewsToday.length ?? 0}
            empty="Nothing on your calendar in the next three days."
          >
            {d?.interviewsToday.map((iv) => (
              <Row key={iv.id} onClick={() => open(iv.applicationId)}>
                <Avatar name={iv.candidateName ?? '?'} src={iv.candidateAvatar} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium leading-tight">
                    {iv.candidateName ?? 'Unknown candidate'}
                  </div>
                  <div className="truncate text-[11.5px] text-muted-foreground">
                    {iv.type} · {iv.jobTitle ?? '—'}
                  </div>
                </div>
                {iv.meetingLink && (
                  <a
                    href={iv.meetingLink}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  >
                    <Video className="h-3 w-3" /> Join
                  </a>
                )}
                <span className="w-[92px] shrink-0 text-right text-[11.5px] tabular-nums text-tone-info">
                  {relativeDate(iv.scheduledAt)}
                </span>
              </Row>
            ))}
          </Section>

          <Section
            icon={Sparkles}
            title="New applications to review"
            count={d?.unreviewed.length ?? 0}
            empty="Everything inbound has been looked at."
          >
            {d?.unreviewed.map((u) => (
              <Row key={u.applicationId} onClick={() => open(u.applicationId)}>
                <Avatar name={u.candidateName ?? '?'} src={u.candidateAvatar} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium leading-tight">
                    {u.candidateName ?? 'Unknown candidate'}
                  </div>
                  <div className="truncate text-[11.5px] text-muted-foreground">
                    {u.headline ?? '—'} · {u.jobTitle ?? '—'}
                  </div>
                </div>
                <span className="shrink-0 rounded border border-border bg-muted px-1.5 py-px text-[10.5px] text-muted-foreground">
                  {u.source}
                </span>
                <span className="w-[72px] shrink-0 text-right text-[11.5px] text-muted-foreground">
                  {relativeDate(u.appliedDate)}
                </span>
              </Row>
            ))}
          </Section>

          <Section
            icon={AlarmClock}
            title="Stalled past their stage target"
            count={d?.stale.length ?? 0}
            tone="warn"
            empty="Nothing is sitting too long."
          >
            {d?.stale.map((st) => (
              <Row key={st.applicationId} onClick={() => open(st.applicationId)}>
                <Avatar name={st.candidateName ?? '?'} src={st.candidateAvatar} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium leading-tight">
                    {st.candidateName ?? 'Unknown candidate'}
                  </div>
                  <div className="truncate text-[11.5px] text-muted-foreground">
                    {st.stageName} · {st.jobTitle ?? '—'}
                  </div>
                </div>
                <span className="shrink-0 text-[11.5px] font-medium text-tone-danger">
                  {st.daysInStage}d
                  <span className="ml-1 font-normal text-muted-foreground">
                    / {st.targetDays}d target
                  </span>
                </span>
              </Row>
            ))}
          </Section>

          <Section
            icon={Wallet}
            title="Offers waiting on approval"
            count={d?.offersToApprove.length ?? 0}
            empty="No offers pending approval."
          >
            {d?.offersToApprove.map((o) => (
              <Row key={o.offerId} onClick={() => open(o.applicationId, 'Offer')}>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium leading-tight">
                    {o.candidateName ?? 'Unknown candidate'}
                  </div>
                  <div className="truncate text-[11.5px] text-muted-foreground">{o.jobTitle ?? '—'}</div>
                </div>
                <span className="shrink-0 text-[12.5px] font-medium tabular-nums">
                  {money(o.baseSalary)}
                </span>
                <span className="shrink-0 rounded border border-tone-warning/30 bg-tone-warning/10 px-1.5 py-px text-[10.5px] text-tone-warning">
                  {o.status}
                </span>
              </Row>
            ))}
          </Section>
        </div>
      </div>
    </>
  );
}
