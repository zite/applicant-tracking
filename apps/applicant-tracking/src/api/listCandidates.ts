import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

// The cross-job candidate table. Search, filter and sort all happen in SQL —
// `findAll` ignores sort and caps out, so paging in JS would quietly lie.

export default createEndpoint({
  description: 'Search and filter candidates across every pipeline',
  authenticated: true,
  inputSchema: z.object({
    search: z.string().optional(),
    jobId: z.string().optional(),
    status: z.string().optional(),
    stageKind: z.string().optional(),
    ownerId: z.string().optional(),
    source: z.string().optional(),
    sort: z.enum(['recent', 'name', 'rating', 'stage']).optional(),
    limit: z.number().int().min(1).max(200).optional(),
    offset: z.number().int().min(0).optional(),
  }),
  outputSchema: z.object({
    total: z.number(),
    rows: z.array(
      z.object({
        applicationId: z.string(),
        candidateId: z.string().nullable(),
        name: z.string(),
        email: z.string().nullable(),
        headline: z.string().nullable(),
        company: z.string().nullable(),
        location: z.string().nullable(),
        avatarUrl: z.string().nullable(),
        jobId: z.string().nullable(),
        jobTitle: z.string().nullable(),
        stageId: z.string().nullable(),
        stageName: z.string().nullable(),
        stageOrder: z.number(),
        status: z.string(),
        rating: z.number(),
        source: z.string().nullable(),
        ownerId: z.string().nullable(),
        appliedDate: z.string().nullable(),
        daysInStage: z.number(),
      }),
    ),
  }),
  execute: async ({ input }) => {
    const where: string[] = ['TRUE'];
    const params: unknown[] = [];

    // Bind a value and return its placeholder, so clauses read in one direction
    // and the parameter index can never drift from the array.
    const bind = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (input.search?.trim()) {
      const p = bind(`%${input.search.trim()}%`);
      where.push(`(c."fullName" ILIKE ${p} OR c."email" ILIKE ${p} OR c."currentCompany" ILIKE ${p} OR c."headline" ILIKE ${p})`);
    }
    if (input.jobId) where.push(`lj."jobsId" = ${bind(input.jobId)}`);
    if (input.status) where.push(`a."status" = ${bind(input.status)}`);
    if (input.stageKind) where.push(`st."kind" = ${bind(input.stageKind)}`);
    if (input.ownerId) where.push(`lo."teamMembersId" = ${bind(input.ownerId)}`);
    if (input.source) where.push(`a."source" = ${bind(input.source)}`);

    // Ordering comes from a closed set — never interpolated from user input.
    const order =
      input.sort === 'name' ? `c."fullName" ASC`
      : input.sort === 'rating' ? `a."rating" DESC NULLS LAST, a."stageEnteredAt" DESC NULLS LAST`
      : input.sort === 'stage' ? `st."order" DESC NULLS LAST, a."stageEnteredAt" DESC NULLS LAST`
      : `a."appliedDate" DESC NULLS LAST`;

    const from = `
      FROM "Applications" a
      LEFT JOIN "ApplicationsCandidates" lc ON lc."applicationsId" = a.id
      LEFT JOIN "Candidates" c ON c.id = lc."candidatesId"
      LEFT JOIN "ApplicationsJobs" lj ON lj."applicationsId" = a.id
      LEFT JOIN "Jobs" j ON j.id = lj."jobsId"
      LEFT JOIN "ApplicationsStages" ls ON ls."applicationsId" = a.id
      LEFT JOIN "Stages" st ON st.id = ls."stagesId"
      LEFT JOIN "ApplicationsTeamMembers" lo ON lo."applicationsId" = a.id
      WHERE ${where.join(' AND ')}
    `;

    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;

    const [countRes, rowRes] = await Promise.all([
      zite.sql({ query: `SELECT COUNT(*) AS "n" ${from}`, params }),
      zite.sql({
        query: `
          SELECT a.id AS "applicationId", a."status", a."rating", a."source", a."appliedDate", a."stageEnteredAt",
                 c.id AS "candidateId", c."fullName", c."email", c."headline", c."currentCompany",
                 c."location", c."avatarUrl",
                 j.id AS "jobId", j."title" AS "jobTitle",
                 st.id AS "stageId", st."name" AS "stageName", st."order" AS "stageOrder",
                 lo."teamMembersId" AS "ownerId"
          ${from}
          ORDER BY ${order}
          LIMIT ${limit} OFFSET ${offset}
        `,
        params,
      }),
    ]);

    const now = Date.now();
    return {
      total: Number(countRes.rows[0]?.n ?? 0),
      rows: rowRes.rows.map((r) => {
        const entered = r.stageEnteredAt ? new Date(String(r.stageEnteredAt)).getTime() : null;
        return {
          applicationId: String(r.applicationId),
          candidateId: r.candidateId == null ? null : String(r.candidateId),
          name: r.fullName == null ? 'Unknown candidate' : String(r.fullName),
          email: r.email == null ? null : String(r.email),
          headline: r.headline == null ? null : String(r.headline),
          company: r.currentCompany == null ? null : String(r.currentCompany),
          location: r.location == null ? null : String(r.location),
          avatarUrl: r.avatarUrl == null ? null : String(r.avatarUrl),
          jobId: r.jobId == null ? null : String(r.jobId),
          jobTitle: r.jobTitle == null ? null : String(r.jobTitle),
          stageId: r.stageId == null ? null : String(r.stageId),
          stageName: r.stageName == null ? null : String(r.stageName),
          stageOrder: Number(r.stageOrder ?? 0),
          status: r.status == null ? 'Active' : String(r.status),
          rating: Number(r.rating ?? 0),
          source: r.source == null ? null : String(r.source),
          ownerId: r.ownerId == null ? null : String(r.ownerId),
          appliedDate: r.appliedDate == null ? null : String(r.appliedDate).slice(0, 10),
          daysInStage: entered ? Math.max(0, Math.floor((now - entered) / 86_400_000)) : 0,
        };
      }),
    };
  },
});
