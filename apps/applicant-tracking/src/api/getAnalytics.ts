import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

// Every number here is computed in SQL. Pulling rows and aggregating in JS would
// silently undercount once the workspace grows past the row cap.

const n = (v: unknown) => Number(v ?? 0);

export default createEndpoint({
  description: 'Hiring funnel, sources, velocity and per-job health',
  authenticated: true,
  inputSchema: z.object({ jobId: z.string().optional() }),
  outputSchema: z.object({
    funnel: z.array(z.object({ kind: z.string(), count: z.number() })),
    bottlenecks: z.array(z.object({
      stage: z.string(),
      order: z.number(),
      waiting: z.number(),
      avgDays: z.number(),
      targetDays: z.number(),
    })),
    sources: z.array(z.object({ source: z.string(), total: z.number(), hired: z.number() })),
    overTime: z.array(z.object({ week: z.string(), applications: z.number() })),
    jobHealth: z.array(
      z.object({
        jobId: z.string(),
        title: z.string(),
        active: z.number(),
        hired: z.number(),
        rejected: z.number(),
        avgDaysOpen: z.number(),
      }),
    ),
    summary: z.object({
      totalApplications: z.number(),
      activeCandidates: z.number(),
      hires: z.number(),
      rejections: z.number(),
      offerAcceptRate: z.number(),
      medianDaysToHire: z.number(),
      scheduledInterviews: z.number(),
    }),
  }),
  execute: async ({ input }) => {
    const scope = input.jobId ? `AND lj."jobsId" = $1` : '';
    const params = input.jobId ? [input.jobId] : [];

    const [funnel, bottlenecks, sources, overTime, jobHealth, summary] = await Promise.all([
      zite.sql({
        query: `
          SELECT COALESCE(st."kind", 'Unassigned') AS "kind", COUNT(*) AS "c"
          FROM "Applications" a
          LEFT JOIN "ApplicationsStages" ls ON ls."applicationsId" = a.id
          LEFT JOIN "Stages" st ON st.id = ls."stagesId"
          LEFT JOIN "ApplicationsJobs" lj ON lj."applicationsId" = a.id
          WHERE a."status" = 'Active' ${scope}
          GROUP BY st."kind"
        `,
        params,
      }),
      // Where the pipeline actually jams: how long people have been sitting in
      // each stage against what that stage was supposed to take. Averaged across
      // jobs by stage name, since every pipeline names its stages itself.
      zite.sql({
        query: `
          SELECT st."name" AS "stage", MIN(st."order") AS "ord",
                 COUNT(*) AS "waiting",
                 AVG(EXTRACT(EPOCH FROM (NOW() - a."stageEnteredAt")) / 86400) AS "avgDays",
                 MAX(COALESCE(st."targetDays", 0)) AS "targetDays"
          FROM "Applications" a
          JOIN "ApplicationsStages" ls ON ls."applicationsId" = a.id
          JOIN "Stages" st ON st.id = ls."stagesId"
          LEFT JOIN "ApplicationsJobs" lj ON lj."applicationsId" = a.id
          WHERE a."status" = 'Active'
            AND a."stageEnteredAt" IS NOT NULL
            AND st."kind" NOT IN ('Hired', 'Rejected')
            ${scope}
          GROUP BY st."name"
          ORDER BY MIN(st."order") ASC
        `,
        params,
      }),
      zite.sql({
        query: `
          SELECT COALESCE(a."source", 'Unknown') AS "source",
                 COUNT(*) AS "total",
                 COUNT(*) FILTER (WHERE a."status" = 'Hired') AS "hired"
          FROM "Applications" a
          LEFT JOIN "ApplicationsJobs" lj ON lj."applicationsId" = a.id
          WHERE TRUE ${scope}
          GROUP BY a."source"
          ORDER BY COUNT(*) DESC
        `,
        params,
      }),
      zite.sql({
        query: `
          SELECT TO_CHAR(DATE_TRUNC('week', a."appliedDate"), 'YYYY-MM-DD') AS "week",
                 COUNT(*) AS "c"
          FROM "Applications" a
          LEFT JOIN "ApplicationsJobs" lj ON lj."applicationsId" = a.id
          WHERE a."appliedDate" IS NOT NULL
            AND a."appliedDate" >= CURRENT_DATE - INTERVAL '120 days' ${scope}
          GROUP BY DATE_TRUNC('week', a."appliedDate")
          ORDER BY DATE_TRUNC('week', a."appliedDate") ASC
        `,
        params,
      }),
      zite.sql({
        query: `
          SELECT j.id AS "jobId", j."title",
                 COUNT(*) FILTER (WHERE a."status" = 'Active') AS "active",
                 COUNT(*) FILTER (WHERE a."status" = 'Hired') AS "hired",
                 COUNT(*) FILTER (WHERE a."status" = 'Rejected') AS "rejected",
                 COALESCE(AVG(EXTRACT(EPOCH FROM (NOW() - j."openedDate")) / 86400), 0) AS "avgDaysOpen"
          FROM "Jobs" j
          LEFT JOIN "ApplicationsJobs" lj ON lj."jobsId" = j.id
          LEFT JOIN "Applications" a ON a.id = lj."applicationsId"
          WHERE j."status" IN ('Open', 'Paused')
          GROUP BY j.id, j."title"
          ORDER BY COUNT(*) FILTER (WHERE a."status" = 'Active') DESC
        `,
      }),
      zite.sql({
        query: `
          SELECT
            (SELECT COUNT(*) FROM "Applications") AS "totalApplications",
            (SELECT COUNT(*) FROM "Applications" WHERE "status" = 'Active') AS "activeCandidates",
            (SELECT COUNT(*) FROM "Applications" WHERE "status" = 'Hired') AS "hires",
            (SELECT COUNT(*) FROM "Applications" WHERE "status" = 'Rejected') AS "rejections",
            (SELECT COUNT(*) FROM "Offers" WHERE "status" = 'Accepted') AS "offersAccepted",
            (SELECT COUNT(*) FROM "Offers" WHERE "status" IN ('Accepted','Declined')) AS "offersResolved",
            (SELECT COUNT(*) FROM "Interviews" WHERE "status" = 'Scheduled' AND "scheduledAt" >= NOW()) AS "scheduledInterviews",
            (SELECT COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (
                ORDER BY EXTRACT(EPOCH FROM (a."stageEnteredAt" - a."appliedDate")) / 86400), 0)
              FROM "Applications" a
              WHERE a."status" = 'Hired' AND a."appliedDate" IS NOT NULL AND a."stageEnteredAt" IS NOT NULL
            ) AS "medianDaysToHire"
        `,
      }),
    ]);

    const s = summary.rows[0] ?? {};
    const resolved = n(s.offersResolved);

    return {
      funnel: funnel.rows.map((r) => ({ kind: String(r.kind), count: n(r.c) })),
      bottlenecks: bottlenecks.rows.map((r) => ({
        stage: String(r.stage),
        order: n(r.ord),
        waiting: n(r.waiting),
        avgDays: Math.round(n(r.avgDays) * 10) / 10,
        targetDays: n(r.targetDays),
      })),
      sources: sources.rows.map((r) => ({
        source: String(r.source),
        total: n(r.total),
        hired: n(r.hired),
      })),
      overTime: overTime.rows.map((r) => ({ week: String(r.week), applications: n(r.c) })),
      jobHealth: jobHealth.rows.map((r) => ({
        jobId: String(r.jobId),
        title: r.title == null ? 'Untitled' : String(r.title),
        active: n(r.active),
        hired: n(r.hired),
        rejected: n(r.rejected),
        avgDaysOpen: Math.round(n(r.avgDaysOpen)),
      })),
      summary: {
        totalApplications: n(s.totalApplications),
        activeCandidates: n(s.activeCandidates),
        hires: n(s.hires),
        rejections: n(s.rejections),
        offerAcceptRate: resolved > 0 ? Math.round((n(s.offersAccepted) / resolved) * 100) : 0,
        medianDaysToHire: Math.round(n(s.medianDaysToHire)),
        scheduledInterviews: n(s.scheduledInterviews),
      },
    };
  },
});
