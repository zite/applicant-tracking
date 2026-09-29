import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { ensureFirstAdmin } from '../lib/actor';
import { sampleDataBlocker } from '../lib/sampleEligibility';

// One call that paints the whole shell: the signed-in user, the team, every job
// with its live pipeline count, and the handful of totals the sidebar shows.
// Splitting these into separate endpoints made the app waterfall on load.

const JobSummary = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  department: z.string().nullable(),
  location: z.string().nullable(),
  status: z.string().nullable(),
  priority: z.string().nullable(),
  workplaceType: z.string().nullable(),
  employmentType: z.string().nullable(),
  published: z.boolean(),
  openings: z.number(),
  openedDate: z.string().nullable(),
  salaryMin: z.number().nullable(),
  salaryMax: z.number().nullable(),
  activeCount: z.number(),
  totalCount: z.number(),
  hiringManagerId: z.string().nullable(),
  recruiterId: z.string().nullable(),
});

const Member = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  title: z.string().nullable(),
  role: z.string().nullable(),
  department: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

const firstId = (v: unknown): string | null =>
  Array.isArray(v) ? (v[0] ?? null) : typeof v === 'string' && v ? v : null;

export default createEndpoint({
  description: 'Everything the app shell needs on first paint',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({
    // Whether Settings shows "Load sample data" to this person.
    canLoadSampleData: z.boolean(),
    me: Member.nullable(),
    team: z.array(Member),
    jobs: z.array(JobSummary),
    totals: z.object({
      activeCandidates: z.number(),
      openJobs: z.number(),
      interviewsThisWeek: z.number(),
      pendingScorecards: z.number(),
      offersOut: z.number(),
    }),
  }),
  execute: async ({ context }) => {
    const [jobRes, firstTeamRes] = await Promise.all([
      zite.jobs.findAll({ limit: 200 }),
      zite.teamMembers.findAll({ limit: 200 }),
    ]);

    // A fresh install starts with an empty hiring team. The first person in
    // becomes its Admin, so the app has an identity to attribute work to.
    const teamRes =
      firstTeamRes.records.length === 0 && (await ensureFirstAdmin(context.user))
        ? await zite.teamMembers.findAll({ limit: 200 })
        : firstTeamRes;

    // Unset text reads as '' rather than null, so `||` rather than `??`: a
    // member added without a title should fall back like one with no title.
    const team = teamRes.records.map((t) => ({
      id: t.id,
      name: t.name || 'Unnamed',
      email: t.email || null,
      title: t.title || null,
      role: t.role || null,
      department: t.department || null,
      avatarUrl: t.avatarUrl || null,
    }));

    // Match the signed-in Zite user to a team member by email. Someone the
    // admin has not added to the team yet falls back to an admin rather than
    // rendering the app with no identity at all.
    const email = (context.user?.email ?? '').toLowerCase();
    const me =
      team.find((t) => (t.email ?? '').toLowerCase() === email) ??
      team.find((t) => t.role === 'Admin') ??
      team[0] ??
      null;

    // Counts per job in one pass rather than one query per card.
    const countRows = jobRes.records.length
      ? (
          await zite.sql({
            query: `
              SELECT lk."jobsId" AS "jobId",
                COUNT(*) FILTER (WHERE a."status" = 'Active') AS "activeTotal",
                COUNT(*) AS "allTotal"
              FROM "Applications" a
              JOIN "ApplicationsJobs" lk ON lk."applicationsId" = a.id
              GROUP BY lk."jobsId"
            `,
          })
        ).rows
      : [];
    const counts = new Map(
      countRows.map((r) => [
        String(r.jobId),
        { active: Number(r.activeTotal ?? 0), all: Number(r.allTotal ?? 0) },
      ]),
    );

    const jobs = jobRes.records
      .map((j) => {
        const c = counts.get(j.id) ?? { active: 0, all: 0 };
        return {
          id: j.id,
          title: j.title ?? 'Untitled role',
          slug: j.slug ?? j.id,
          department: j.department ?? null,
          location: j.location ?? null,
          status: j.status ?? null,
          priority: j.priority ?? null,
          workplaceType: j.workplaceType ?? null,
          employmentType: j.employmentType ?? null,
          published: j.published === true,
          openings: Number(j.openings ?? 1),
          openedDate: j.openedDate ? String(j.openedDate).slice(0, 10) : null,
          salaryMin: j.salaryMin == null ? null : Number(j.salaryMin),
          salaryMax: j.salaryMax == null ? null : Number(j.salaryMax),
          activeCount: c.active,
          totalCount: c.all,
          // Jobs links to Team Members twice (hiring manager and recruiter) and
          // both share one link table, so these resolve through the record
          // rather than a SQL join that cannot tell the two apart.
          hiringManagerId: firstId(j.hiringManager),
          recruiterId: firstId(j.recruiter),
        };
      })
      .sort((a, b) => {
        const rank = (s: string | null) => (s === 'Open' ? 0 : s === 'Draft' ? 1 : s === 'Paused' ? 2 : 3);
        return rank(a.status) - rank(b.status) || b.activeCount - a.activeCount;
      });

    const totalRows = (
      await zite.sql({
        query: `
          SELECT
            (SELECT COUNT(*) FROM "Applications" WHERE "status" = 'Active') AS "activeCandidates",
            (SELECT COUNT(*) FROM "Jobs" WHERE "status" = 'Open') AS "openJobs",
            (SELECT COUNT(*) FROM "Interviews"
               WHERE "status" = 'Scheduled'
                 AND "scheduledAt" >= NOW()
                 AND "scheduledAt" < NOW() + INTERVAL '7 days') AS "interviewsThisWeek",
            (SELECT COUNT(*) FROM "Scorecards" WHERE "status" = 'Pending') AS "pendingScorecards",
            (SELECT COUNT(*) FROM "Offers" WHERE "status" IN ('Sent', 'Pending Approval')) AS "offersOut"
        `,
      })
    ).rows[0] ?? {};

    // Only a workspace with no jobs can be eligible, so the common case skips
    // the extra lookups entirely.
    const canLoadSampleData =
      jobRes.records.length === 0 && (await sampleDataBlocker(context.user?.email)) === null;

    return {
      canLoadSampleData,
      me,
      team,
      jobs,
      totals: {
        activeCandidates: Number(totalRows.activeCandidates ?? 0),
        openJobs: Number(totalRows.openJobs ?? 0),
        interviewsThisWeek: Number(totalRows.interviewsThisWeek ?? 0),
        pendingScorecards: Number(totalRows.pendingScorecards ?? 0),
        offersOut: Number(totalRows.offersOut ?? 0),
      },
    };
  },
});
