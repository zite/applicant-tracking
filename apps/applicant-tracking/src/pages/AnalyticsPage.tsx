import { useQuery } from '@tanstack/react-query';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { getAnalytics } from 'zitejs/api';
import { PageHeader, EmptyState } from '../components/PageHeader';
import { dayLabel } from '../lib/format';

// Two validated categorical slots, read from CSS so both themes stay correct.
const S1 = 'var(--series-1)';
const S2 = 'var(--series-2)';
const GRID = 'hsl(var(--grid-line))';
const AXIS = 'hsl(var(--muted-foreground))';

function ChartTooltip({
  active,
  payload,
  label,
  suffix = '',
}: {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string }[];
  label?: string | number;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 shadow-lg">
      <div className="mb-0.5 text-[11px] text-muted-foreground">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5 text-[12px]">
          <span
            className="h-2 w-2 shrink-0 rounded-[2px]"
            style={{ background: p.color }}
            aria-hidden
          />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-medium tabular-nums">
            {p.value}
            {suffix}
          </span>
        </div>
      ))}
    </div>
  );
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-[24px] font-semibold leading-none tracking-tight tabular-nums">
        {value}
      </div>
      {hint ? <div className="mt-1.5 text-[11px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3">
        <h2 className="text-[12.5px] font-medium">{title}</h2>
        {note ? <p className="mt-0.5 text-[11px] text-muted-foreground">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

// The pipeline reads as a path, so its stages keep pipeline order rather than
// being sorted by size.
const FUNNEL_ORDER = ['Applied', 'Screen', 'Interview', 'Offer', 'Hired'];

export function AnalyticsPage() {
  const q = useQuery({
    queryKey: ['analytics'],
    queryFn: () => getAnalytics({}),
    staleTime: 60_000,
  });

  if (q.isPending) {
    return (
      <>
        <PageHeader title="Analytics" />
        <div className="flex-1 space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[84px] rounded-lg skeleton-shimmer" />
            ))}
          </div>
          <div className="h-64 rounded-lg skeleton-shimmer" />
          <div className="h-64 rounded-lg skeleton-shimmer" />
        </div>
      </>
    );
  }

  if (!q.data) {
    return (
      <>
        <PageHeader title="Analytics" />
        <EmptyState title="No data yet" body="Analytics appear once candidates move through a pipeline." />
      </>
    );
  }

  const { summary, funnel, bottlenecks, sources, overTime, jobHealth } = q.data;

  const funnelData = FUNNEL_ORDER.map((kind) => ({
    kind,
    count: funnel.find((f) => f.kind === kind)?.count ?? 0,
  })).filter((f) => f.count > 0 || FUNNEL_ORDER.indexOf(f.kind) < 4);

  const timeData = overTime.map((o) => ({ week: dayLabel(o.week), applications: o.applications }));
  const sourceData = [...sources].sort((a, b) => b.total - a.total).slice(0, 6);

  return (
    <>
      <PageHeader title="Analytics" subtitle="Across every pipeline" />

      <div className="min-h-0 flex-1 overflow-y-auto p-4 animate-fade-rise">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Active candidates"
              value={String(summary.activeCandidates)}
              hint={`${summary.totalApplications} applications all time`}
            />
            <StatTile
              label="Hires"
              value={String(summary.hires)}
              hint={`${summary.rejections} rejected`}
            />
            <StatTile
              label="Offer accept rate"
              value={`${summary.offerAcceptRate}%`}
              hint="Of offers that got a response"
            />
            <StatTile
              label="Median days to hire"
              value={summary.medianDaysToHire > 0 ? String(summary.medianDaysToHire) : '—'}
              hint={`${summary.scheduledInterviews} interviews scheduled`}
            />
          </div>

          <Panel title="Pipeline funnel" note="Active candidates by stage type, in pipeline order.">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={funnelData} layout="vertical" margin={{ left: 8, right: 28 }}>
                <CartesianGrid horizontal={false} stroke={GRID} />
                <XAxis type="number" tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="kind"
                  width={78}
                  tick={{ fill: AXIS, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip cursor={{ fill: 'hsl(var(--accent) / 0.5)' }} content={<ChartTooltip />} />
                {/* Single series, so no legend — the panel title names it. */}
                <Bar dataKey="count" name="Candidates" fill={S1} radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel
            title="Where the pipeline jams"
            note="Average time active candidates have been waiting in each stage, against that stage's target."
          >
            {bottlenecks.length === 0 ? (
              <p className="py-6 text-center text-[12.5px] text-muted-foreground">
                No active candidates to measure yet.
              </p>
            ) : (
              <div className="space-y-2.5">
                {bottlenecks.map((b) => {
                  const over = b.targetDays > 0 && b.avgDays > b.targetDays;
                  // Scale bars against the slowest stage so the worst offender
                  // is full width and the rest read relative to it.
                  const max = Math.max(...bottlenecks.map((x) => x.avgDays), 1);
                  return (
                    <div key={b.stage}>
                      <div className="mb-1 flex items-baseline gap-2">
                        <span className="text-[12px] font-medium">{b.stage}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {b.waiting} waiting
                        </span>
                        {over && (
                          <span className="rounded border border-tone-warning/30 bg-tone-warning/10 px-1.5 py-px text-[10px] text-tone-warning">
                            over target
                          </span>
                        )}
                        <span className="ml-auto text-[11.5px] tabular-nums">
                          <span className="font-medium">{b.avgDays}d</span>
                          <span className="text-muted-foreground">
                            {b.targetDays > 0 ? ` avg · ${b.targetDays}d target` : ' avg'}
                          </span>
                        </span>
                      </div>
                      <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.max(2, (b.avgDays / max) * 100)}%`, background: S1 }}
                        />
                        {b.targetDays > 0 && b.targetDays / max <= 1 && (
                          <span
                            className="absolute top-0 h-full w-px bg-foreground/45"
                            style={{ left: `${(b.targetDays / max) * 100}%` }}
                            title={`${b.targetDays}d target`}
                            aria-hidden
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
                <p className="pt-1 text-[11px] text-muted-foreground">
                  The vertical line on each bar marks that stage&rsquo;s target.
                </p>
              </div>
            )}
          </Panel>

          <Panel title="Applications over time" note="Weekly, last 120 days.">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={timeData} margin={{ left: 0, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="appFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={S1} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={S1} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="week" tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                <Tooltip cursor={{ stroke: GRID }} content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="applications"
                  name="Applications"
                  stroke={S1}
                  strokeWidth={2}
                  fill="url(#appFill)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Source effectiveness" note="Applications received against hires made.">
            {/* Two series, so a legend is present and the marks are also
                direct-labeled — identity is never carried by colour alone. */}
            <div className="mb-2 flex items-center gap-4">
              {[
                ['Applications', S1],
                ['Hires', S2],
              ].map(([label, color]) => (
                <span key={label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="h-2 w-2 rounded-[2px]" style={{ background: color }} aria-hidden />
                  {label}
                </span>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={Math.max(160, sourceData.length * 42)}>
              <BarChart data={sourceData} layout="vertical" margin={{ left: 8, right: 32 }} barGap={2}>
                <CartesianGrid horizontal={false} stroke={GRID} />
                <XAxis type="number" tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="source"
                  width={78}
                  tick={{ fill: AXIS, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip cursor={{ fill: 'hsl(var(--accent) / 0.5)' }} content={<ChartTooltip />} />
                <Bar dataKey="total" name="Applications" fill={S1} radius={[0, 4, 4, 0]} barSize={12} />
                <Bar dataKey="hired" name="Hires" fill={S2} radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Open roles" note="Load and outcomes per requisition.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-[12.5px]">
                <thead>
                  <tr className="border-b border-border text-[10.5px] uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 text-left font-medium">Role</th>
                    <th className="pb-2 text-right font-medium">Active</th>
                    <th className="pb-2 text-right font-medium">Hired</th>
                    <th className="pb-2 text-right font-medium">Rejected</th>
                    <th className="pb-2 text-right font-medium">Days open</th>
                  </tr>
                </thead>
                <tbody>
                  {jobHealth.map((j) => (
                    <tr key={j.jobId} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-3">{j.title}</td>
                      <td className="py-2 text-right font-medium tabular-nums">{j.active}</td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">{j.hired}</td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">{j.rejected}</td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">{j.avgDaysOpen}</td>
                    </tr>
                  ))}
                  {jobHealth.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-muted-foreground">
                        No open roles.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
