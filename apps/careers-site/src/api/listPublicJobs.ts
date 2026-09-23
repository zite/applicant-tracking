import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

// Public. Only ever returns jobs explicitly marked Published and in an open
// state — a draft or confidential requisition must never reach this response.

export default createEndpoint({
  description: 'List published roles for the public careers site',
  authenticated: false,
  inputSchema: z.object({}),
  outputSchema: z.object({
    jobs: z.array(
      z.object({
        id: z.string(),
        slug: z.string(),
        title: z.string(),
        department: z.string().nullable(),
        team: z.string().nullable(),
        location: z.string().nullable(),
        workplaceType: z.string().nullable(),
        employmentType: z.string().nullable(),
        salaryMin: z.number().nullable(),
        salaryMax: z.number().nullable(),
        openings: z.number(),
      }),
    ),
  }),
  execute: async () => {
    const rows = (
      await zite.sql({
        query: `
          SELECT id, "slug", "title", "department", "team", "location", "workplaceType",
                 "employmentType", "salaryMin", "salaryMax", "openings"
          FROM "Jobs"
          WHERE "published" = true
            AND COALESCE("confidential", false) = false
            AND "status" IN ('Open', 'Paused')
          ORDER BY "department" ASC, "openedDate" DESC NULLS LAST
          LIMIT 200
        `,
      })
    ).rows;

    return {
      jobs: rows.map((r) => ({
        id: String(r.id),
        slug: r.slug == null ? String(r.id) : String(r.slug),
        title: r.title == null ? 'Open role' : String(r.title),
        department: r.department == null ? null : String(r.department),
        team: r.team == null ? null : String(r.team),
        location: r.location == null ? null : String(r.location),
        workplaceType: r.workplaceType == null ? null : String(r.workplaceType),
        employmentType: r.employmentType == null ? null : String(r.employmentType),
        salaryMin: r.salaryMin == null ? null : Number(r.salaryMin),
        salaryMax: r.salaryMax == null ? null : Number(r.salaryMax),
        openings: Number(r.openings ?? 1),
      })),
    };
  },
});
