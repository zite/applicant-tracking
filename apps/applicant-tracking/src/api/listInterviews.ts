import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Upcoming and recent interviews across every pipeline',
  authenticated: true,
  inputSchema: z.object({
    range: z.enum(['upcoming', 'past', 'all']).optional(),
    interviewerId: z.string().optional(),
    limit: z.number().int().min(1).max(200).optional(),
  }),
  outputSchema: z.object({
    interviews: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        type: z.string().nullable(),
        status: z.string().nullable(),
        scheduledAt: z.string().nullable(),
        durationMinutes: z.number(),
        meetingLink: z.string().nullable(),
        applicationId: z.string().nullable(),
        candidateName: z.string().nullable(),
        candidateAvatar: z.string().nullable(),
        jobTitle: z.string().nullable(),
        interviewerIds: z.array(z.string()),
        hasFeedback: z.boolean(),
      }),
    ),
  }),
  execute: async ({ input }) => {
    const range = input.range ?? 'upcoming';
    const params: unknown[] = [];
    const where: string[] = ['TRUE'];

    if (range === 'upcoming') where.push(`i."scheduledAt" >= NOW() - INTERVAL '1 day'`);
    if (range === 'past') where.push(`i."scheduledAt" < NOW()`);
    if (input.interviewerId) {
      params.push(input.interviewerId);
      where.push(`EXISTS (SELECT 1 FROM "InterviewsTeamMembers" x
                  WHERE x."interviewsId" = i.id AND x."teamMembersId" = $${params.length})`);
    }

    const order = range === 'past' ? 'DESC' : 'ASC';
    const rows = (
      await zite.sql({
        query: `
          SELECT i.id, i."title", i."type", i."status", i."scheduledAt", i."durationMinutes", i."meetingLink",
                 la."applicationsId" AS "applicationId",
                 c."fullName" AS "candidateName", c."avatarUrl" AS "candidateAvatar",
                 j."title" AS "jobTitle",
                 EXISTS (SELECT 1 FROM "InterviewsScorecards" isc WHERE isc."interviewsId" = i.id) AS "hasFeedback"
          FROM "Interviews" i
          LEFT JOIN "ApplicationsInterviews" la ON la."interviewsId" = i.id
          LEFT JOIN "ApplicationsCandidates" lc ON lc."applicationsId" = la."applicationsId"
          LEFT JOIN "Candidates" c ON c.id = lc."candidatesId"
          LEFT JOIN "ApplicationsJobs" lj ON lj."applicationsId" = la."applicationsId"
          LEFT JOIN "Jobs" j ON j.id = lj."jobsId"
          WHERE ${where.join(' AND ')}
          ORDER BY i."scheduledAt" ${order} NULLS LAST
          LIMIT ${input.limit ?? 100}
        `,
        params,
      })
    ).rows;

    const ids = rows.map((r) => String(r.id));
    const panel = ids.length
      ? (
          await zite.sql({
            query: `SELECT lk."interviewsId" AS "i", lk."teamMembersId" AS "m"
                    FROM "InterviewsTeamMembers" lk WHERE lk."interviewsId" = ANY($1::uuid[])`,
            params: [ids],
          })
        ).rows
      : [];
    const by = new Map<string, string[]>();
    for (const p of panel) {
      const k = String(p.i);
      by.set(k, [...(by.get(k) ?? []), String(p.m)]);
    }

    return {
      interviews: rows.map((r) => ({
        id: String(r.id),
        title: r.title == null ? 'Interview' : String(r.title),
        type: r.type == null ? null : String(r.type),
        status: r.status == null ? null : String(r.status),
        scheduledAt: r.scheduledAt == null ? null : String(r.scheduledAt),
        durationMinutes: Number(r.durationMinutes ?? 60),
        meetingLink: r.meetingLink == null ? null : String(r.meetingLink),
        applicationId: r.applicationId == null ? null : String(r.applicationId),
        candidateName: r.candidateName == null ? null : String(r.candidateName),
        candidateAvatar: r.candidateAvatar == null ? null : String(r.candidateAvatar),
        jobTitle: r.jobTitle == null ? null : String(r.jobTitle),
        interviewerIds: by.get(String(r.id)) ?? [],
        hasFeedback: r.hasFeedback === true,
      })),
    };
  },
});
