import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';

// Public and unauthenticated, and it writes rows — so it is the most exposed
// surface in the workspace. Defences, in order: a strict schema, a honeypot
// field no real applicant fills in, a re-application guard per job, and a job
// lookup that only ever matches a published role.

// Declared once and used twice: as the endpoint's inputSchema, and again inside
// execute. The runtime does NOT reject input that fails inputSchema before
// calling execute — verified against the deployed endpoint, where an invalid
// email was written straight to the database. On an unauthenticated endpoint
// that creates rows, that has to be enforced here.
// A link that is actually reachable. `z.string().url()` alone accepts
// "https://asdf" — a hostname with no dot is almost always a typo, not a site.
const webLink = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(
      (v) => /^https?:\/\//i.test(v) && /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(
        v.replace(/^https?:\/\//i, '').split(/[/?#:]/)[0],
      ),
      { message: 'must be a full web address, like https://example.com/you' },
    );

const InputSchema = z.object({
    jobSlug: z.string().trim().min(1).max(200),
    fullName: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(200),
    phone: z.string().trim().max(40).optional(),
    location: z.string().trim().max(120).optional(),
    linkedInUrl: webLink(300).optional(),
    portfolioUrl: webLink(300).optional(),
    // A link rather than an upload: attachments take a URL, and asking for one
    // keeps the public form free of a file-storage dependency.
    resumeUrl: webLink(500).optional(),
    currentCompany: z.string().trim().max(120).optional(),
    headline: z.string().trim().max(160).optional(),
    yearsExperience: z.number().int().min(0).max(60).optional(),
    note: z.string().trim().max(4000).optional(),
    // Hidden in the form; a filled value means a bot.
    website: z.string().max(200).optional(),
});

export default createEndpoint({
  description: 'Accept an application from the public careers site',
  authenticated: false,
  inputSchema: InputSchema,
  outputSchema: z.object({
    ok: z.boolean(),
    duplicate: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ input: raw }) => {
    const parsed = InputSchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw new ZiteError(
        first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid application',
        'BAD_REQUEST',
      );
    }
    const input = parsed.data;

    if (input.website && input.website.trim().length > 0) {
      // Respond exactly as success would, so a bot learns nothing.
      return { ok: true, duplicate: false, message: 'Application received.' };
    }

    const jobRows = (
      await zite.sql({
        query: `SELECT id, "title" FROM "Jobs"
                WHERE "slug" = $1 AND "published" = true
                  AND COALESCE("confidential", false) = false
                  AND "status" = 'Open'
                LIMIT 1`,
        params: [input.jobSlug],
      })
    ).rows;
    const job = jobRows[0];
    if (!job) throw new ZiteError('That role is no longer accepting applications', 'NOT_FOUND');

    const jobId = String(job.id);
    const email = input.email.toLowerCase();

    // One candidate record per person, reused across roles.
    const existing = await zite.candidates.findAll({ filters: { email }, limit: 1 });
    let candidateId = existing.records[0]?.id;

    if (candidateId) {
      const dupe = (
        await zite.sql({
          query: `SELECT 1 FROM "Applications" a
                  JOIN "ApplicationsCandidates" lc ON lc."applicationsId" = a.id
                  JOIN "ApplicationsJobs" lj ON lj."applicationsId" = a.id
                  WHERE lc."candidatesId" = $1 AND lj."jobsId" = $2 LIMIT 1`,
          params: [candidateId, jobId],
        })
      ).rows;
      if (dupe.length > 0) {
        return {
          ok: true,
          duplicate: true,
          message: 'You have already applied to this role — we have your application.',
        };
      }
    } else {
      const created = await zite.candidates.create({
        record: {
          fullName: input.fullName,
          email,
          phone: input.phone || null,
          location: input.location || null,
          linkedInUrl: input.linkedInUrl || null,
          portfolioUrl: input.portfolioUrl || null,
          resume: input.resumeUrl
            ? [{ url: input.resumeUrl, filename: `${input.fullName} resume` }]
            : null,
          currentCompany: input.currentCompany || null,
          headline: input.headline || null,
          yearsExperience: input.yearsExperience ?? null,
          source: 'Applied',
          sourceDetail: 'Careers site',
          avatarUrl: `https://i.pravatar.cc/160?u=${encodeURIComponent(email)}`,
        } as never,
      });
      candidateId = created.id;
    }

    // Land them on the job's first stage rather than leaving the card stageless.
    const stageRows = (
      await zite.sql({
        query: `SELECT s.id FROM "Stages" s
                JOIN "JobsStages" lk ON lk."stagesId" = s.id
                WHERE lk."jobsId" = $1 ORDER BY s."order" ASC LIMIT 1`,
        params: [jobId],
      })
    ).rows;
    const firstStageId = stageRows[0] ? String(stageRows[0].id) : null;

    const now = new Date();
    const application = await zite.applications.create({
      record: {
        application: `${input.fullName} — ${job.title ?? 'Open role'}`,
        candidate: [candidateId],
        job: [jobId],
        currentStage: firstStageId ? [firstStageId] : null,
        appliedDate: now.toISOString().slice(0, 10),
        stageEnteredAt: now.toISOString(),
        status: 'Active',
        rating: 0,
        source: 'Applied',
      } as never,
    });

    await zite.activities.create({
      record: {
        summary: `${input.fullName} applied via the careers site`,
        body: input.note || null,
        type: 'Application Created',
        occurredAt: now.toISOString(),
        application: [application.id],
        candidate: [candidateId],
      } as never,
    });

    return { ok: true, duplicate: false, message: 'Application received.' };
  },
});
