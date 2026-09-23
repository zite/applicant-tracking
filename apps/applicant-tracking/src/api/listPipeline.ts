import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';

// The board. One query for the stages, one for every card on them — the card
// carries enough to render without a follow-up fetch per column.

const Card = z.object({
  id: z.string(),
  candidateId: z.string().nullable(),
  name: z.string(),
  headline: z.string().nullable(),
  company: z.string().nullable(),
  location: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  stageId: z.string().nullable(),
  status: z.string(),
  rating: z.number(),
  source: z.string().nullable(),
  appliedDate: z.string().nullable(),
  daysInStage: z.number(),
  tags: z.array(z.string()),
  upcomingInterviewAt: z.string().nullable(),
  scorecardsDue: z.number(),
  ownerId: z.string().nullable(),
});

const toStringArray = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string' && v.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
};

export default createEndpoint({
  description: 'Stages and candidate cards for one job pipeline',
  authenticated: true,
  inputSchema: z.object({
    jobId: z.string().min(1),
    include: z.enum(['active', 'all']).optional(),
  }),
  outputSchema: z.object({
    stages: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        order: z.number(),
        kind: z.string().nullable(),
        targetDays: z.number().nullable(),
        interviewKit: z.string().nullable(),
      }),
    ),
    cards: z.array(Card),
  }),
  execute: async ({ input }) => {
    const job = await zite.jobs.findOne({ id: input.jobId });
    if (!job) throw new ZiteError('Job not found', 'NOT_FOUND');

    const stageRows = (
      await zite.sql({
        query: `
          SELECT s.id, s."name", s."order", s."kind", s."targetDays", s."interviewKit"
          FROM "Stages" s
          JOIN "JobsStages" lk ON lk."stagesId" = s.id
          WHERE lk."jobsId" = $1
          ORDER BY s."order" ASC
        `,
        params: [input.jobId],
      })
    ).rows;

    // Active-only by default: a board that also renders every rejection reads as
    // a graveyard rather than a pipeline.
    const statusClause = input.include === 'all' ? '' : `AND a."status" = 'Active'`;

    const cardRows = (
      await zite.sql({
        query: `
          SELECT
            a.id, a."status", a."rating", a."appliedDate", a."stageEnteredAt", a."source",
            ls."stagesId" AS "stageId",
            lo."teamMembersId" AS "ownerId",
            c.id AS "candidateId", c."fullName", c."headline", c."currentCompany",
            c."location", c."avatarUrl", c."tags",
            (
              SELECT MIN(i."scheduledAt") FROM "Interviews" i
              JOIN "ApplicationsInterviews" li ON li."interviewsId" = i.id
              WHERE li."applicationsId" = a.id
                AND i."status" = 'Scheduled' AND i."scheduledAt" >= NOW()
            ) AS "upcomingInterviewAt",
            (
              SELECT COUNT(*) FROM "Scorecards" sc
              JOIN "ApplicationsScorecards" lsc ON lsc."scorecardsId" = sc.id
              WHERE lsc."applicationsId" = a.id AND sc."status" = 'Pending'
            ) AS "scorecardsDue"
          FROM "Applications" a
          JOIN "ApplicationsJobs" lj ON lj."applicationsId" = a.id AND lj."jobsId" = $1
          LEFT JOIN "ApplicationsStages" ls ON ls."applicationsId" = a.id
          LEFT JOIN "ApplicationsTeamMembers" lo ON lo."applicationsId" = a.id
          LEFT JOIN "ApplicationsCandidates" lc ON lc."applicationsId" = a.id
          LEFT JOIN "Candidates" c ON c.id = lc."candidatesId"
          WHERE TRUE ${statusClause}
          ORDER BY a."rating" DESC NULLS LAST, a."stageEnteredAt" DESC NULLS LAST
          LIMIT 1000
        `,
        params: [input.jobId],
      })
    ).rows;

    const now = Date.now();
    return {
      stages: stageRows.map((s) => ({
        id: String(s.id),
        name: s.name == null ? 'Stage' : String(s.name),
        order: Number(s.order ?? 0),
        kind: s.kind == null ? null : String(s.kind),
        targetDays: s.targetDays == null ? null : Number(s.targetDays),
        interviewKit: s.interviewKit == null ? null : String(s.interviewKit),
      })),
      cards: cardRows.map((r) => {
        const entered = r.stageEnteredAt ? new Date(String(r.stageEnteredAt)).getTime() : null;
        return {
          id: String(r.id),
          candidateId: r.candidateId == null ? null : String(r.candidateId),
          name: r.fullName == null ? 'Unknown candidate' : String(r.fullName),
          headline: r.headline == null ? null : String(r.headline),
          company: r.currentCompany == null ? null : String(r.currentCompany),
          location: r.location == null ? null : String(r.location),
          avatarUrl: r.avatarUrl == null ? null : String(r.avatarUrl),
          stageId: r.stageId == null ? null : String(r.stageId),
          status: r.status == null ? 'Active' : String(r.status),
          rating: Number(r.rating ?? 0),
          source: r.source == null ? null : String(r.source),
          appliedDate: r.appliedDate == null ? null : String(r.appliedDate).slice(0, 10),
          daysInStage: entered ? Math.max(0, Math.floor((now - entered) / 86_400_000)) : 0,
          tags: toStringArray(r.tags),
          upcomingInterviewAt: r.upcomingInterviewAt == null ? null : String(r.upcomingInterviewAt),
          scorecardsDue: Number(r.scorecardsDue ?? 0),
          ownerId: r.ownerId == null ? null : String(r.ownerId),
        };
      }),
    };
  },
});
