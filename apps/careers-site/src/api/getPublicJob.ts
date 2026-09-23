import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Fetch one published role by slug',
  authenticated: false,
  inputSchema: z.object({ slug: z.string().trim().min(1).max(200) }),
  outputSchema: z.object({
    job: z.object({
      id: z.string(),
      slug: z.string(),
      title: z.string(),
      department: z.string().nullable(),
      team: z.string().nullable(),
      location: z.string().nullable(),
      workplaceType: z.string().nullable(),
      employmentType: z.string().nullable(),
      description: z.string().nullable(),
      requirements: z.string().nullable(),
      benefits: z.string().nullable(),
      salaryMin: z.number().nullable(),
      salaryMax: z.number().nullable(),
    }),
  }),
  execute: async ({ input }) => {
    // The published / non-confidential filter lives in the query itself so an
    // unpublished slug is indistinguishable from one that does not exist.
    const rows = (
      await zite.sql({
        query: `
          SELECT id, "slug", "title", "department", "team", "location", "workplaceType",
                 "employmentType", "description", "requirements", "benefits",
                 "salaryMin", "salaryMax"
          FROM "Jobs"
          WHERE "slug" = $1
            AND "published" = true
            AND COALESCE("confidential", false) = false
            AND "status" IN ('Open', 'Paused')
          LIMIT 1
        `,
        params: [input.slug],
      })
    ).rows;

    const r = rows[0];
    if (!r) throw new ZiteError('Role not found', 'NOT_FOUND');

    return {
      job: {
        id: String(r.id),
        slug: String(r.slug ?? r.id),
        title: r.title == null ? 'Open role' : String(r.title),
        department: r.department == null ? null : String(r.department),
        team: r.team == null ? null : String(r.team),
        location: r.location == null ? null : String(r.location),
        workplaceType: r.workplaceType == null ? null : String(r.workplaceType),
        employmentType: r.employmentType == null ? null : String(r.employmentType),
        description: r.description == null ? null : String(r.description),
        requirements: r.requirements == null ? null : String(r.requirements),
        benefits: r.benefits == null ? null : String(r.benefits),
        salaryMin: r.salaryMin == null ? null : Number(r.salaryMin),
        salaryMax: r.salaryMax == null ? null : Number(r.salaryMax),
      },
    };
  },
});
