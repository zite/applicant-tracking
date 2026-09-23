import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';

// One person, every role they have been considered for. A candidate who was a
// near miss last quarter is the cheapest hire available, and that is invisible
// if the app only ever shows one application at a time.

export default createEndpoint({
  description: 'A candidate and every application they have across all jobs',
  authenticated: true,
  inputSchema: z.object({ candidateId: z.string().min(1) }),
  outputSchema: z.object({
    applications: z.array(z.object({
      applicationId: z.string(),
      jobId: z.string().nullable(),
      jobTitle: z.string().nullable(),
      stageName: z.string().nullable(),
      status: z.string(),
      rating: z.number(),
      appliedDate: z.string().nullable(),
      rejectionReason: z.string().nullable(),
    })),
  }),
  execute: async ({ input }) => {
    const candidate = await zite.candidates.findOne({ id: input.candidateId });
    if (!candidate) throw new ZiteError('Candidate not found', 'NOT_FOUND');

    const rows = (
      await zite.sql({
        query: `
          SELECT a.id AS "applicationId", a."status", a."rating", a."appliedDate", a."rejectionReason",
                 j.id AS "jobId", j."title" AS "jobTitle", st."name" AS "stageName"
          FROM "Applications" a
          JOIN "ApplicationsCandidates" lc ON lc."applicationsId" = a.id AND lc."candidatesId" = $1
          LEFT JOIN "ApplicationsJobs" lj ON lj."applicationsId" = a.id
          LEFT JOIN "Jobs" j ON j.id = lj."jobsId"
          LEFT JOIN "ApplicationsStages" ls ON ls."applicationsId" = a.id
          LEFT JOIN "Stages" st ON st.id = ls."stagesId"
          ORDER BY a."appliedDate" DESC NULLS LAST`,
        params: [input.candidateId],
      })
    ).rows;

    return {
      applications: rows.map((r) => ({
        applicationId: String(r.applicationId),
        jobId: r.jobId == null ? null : String(r.jobId),
        jobTitle: r.jobTitle == null ? null : String(r.jobTitle),
        stageName: r.stageName == null ? null : String(r.stageName),
        status: r.status == null ? 'Active' : String(r.status),
        rating: Number(r.rating ?? 0),
        appliedDate: r.appliedDate == null ? null : String(r.appliedDate).slice(0, 10),
        rejectionReason: r.rejectionReason == null ? null : String(r.rejectionReason),
      })),
    };
  },
});
