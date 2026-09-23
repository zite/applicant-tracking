import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, CheckCircle2, Video } from 'lucide-react';
import { listInterviews } from 'zitejs/api';
import { Avatar, AvatarStack } from '../components/Avatar';
import { PageHeader, EmptyState } from '../components/PageHeader';
import { useBootstrap, memberMap, type TeamMember } from '../lib/queries';
import { dayHeading, dateTimeLabel } from '../lib/format';

export function InterviewsPage() {
  const navigate = useNavigate();
  const [range, setRange] = useState<'upcoming' | 'past'>('upcoming');
  const boot = useBootstrap();
  const members = memberMap(boot.data?.team);

  const list = useQuery({
    queryKey: ['interviews', range],
    queryFn: () => listInterviews({ range, limit: 150 }),
    staleTime: 30_000,
  });

  const interviews = list.data?.interviews ?? [];

  // Group by calendar day so the page reads like a schedule rather than a table.
  const groups: { day: string; items: typeof interviews }[] = [];
  for (const iv of interviews) {
    if (!iv.scheduledAt) continue;
    const day = dayHeading(iv.scheduledAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(iv);
    else groups.push({ day, items: [iv] });
  }

  return (
    <>
      <PageHeader title="Interviews" subtitle={`${interviews.length} ${range}`}>
        <div className="flex items-center rounded-md border border-border p-0.5">
          {(['upcoming', 'past'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded px-2 py-1 text-[11.5px] capitalize transition ${
                range === r
                  ? 'bg-accent font-medium text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {list.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-14 rounded-lg skeleton-shimmer" style={{ opacity: 1 - i * 0.1 }} />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <EmptyState
            title={range === 'upcoming' ? 'Nothing scheduled' : 'No past interviews'}
            body={
              range === 'upcoming'
                ? 'Interviews you schedule from a candidate will appear here, grouped by day.'
                : 'Completed interviews and their feedback will show up here.'
            }
          />
        ) : (
          <div className="mx-auto max-w-3xl space-y-6 animate-fade-rise">
            {groups.map((g) => (
              <section key={g.day}>
                <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {g.day}
                </h2>
                <div className="space-y-1.5">
                  {g.items.map((iv) => {
                    const panel = iv.interviewerIds
                      .map((id) => members.get(id))
                      .filter((m): m is TeamMember => Boolean(m));
                    return (
                      <div
                        key={iv.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Open ${iv.candidateName ?? 'candidate'}`}
                        onClick={() =>
                          iv.applicationId && navigate(`/candidate/${iv.applicationId}`)
                        }
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ' ') && iv.applicationId) {
                            e.preventDefault();
                            navigate(`/candidate/${iv.applicationId}`);
                          }
                        }}
                        className="card-hover flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
                      >
                        <Avatar name={iv.candidateName ?? '?'} src={iv.candidateAvatar} size={30} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-medium leading-tight">
                            {iv.candidateName ?? 'Unknown candidate'}
                          </div>
                          <div className="truncate text-[11.5px] text-muted-foreground">
                            {iv.type} · {iv.jobTitle ?? '—'}
                          </div>
                        </div>

                        {panel.length > 0 && <AvatarStack people={panel} size={20} />}

                        {iv.hasFeedback && (
                          <span
                            className="text-tone-success"
                            title="Feedback submitted"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </span>
                        )}

                        {iv.meetingLink && range === 'upcoming' && (
                          <a
                            href={iv.meetingLink}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
                          >
                            <Video className="h-3 w-3" /> Join
                          </a>
                        )}

                        <span className="flex w-[110px] shrink-0 items-center justify-end gap-1 text-[11.5px] tabular-nums text-muted-foreground">
                          <CalendarClock className="h-3 w-3" />
                          {dateTimeLabel(iv.scheduledAt).split(', ').pop()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
