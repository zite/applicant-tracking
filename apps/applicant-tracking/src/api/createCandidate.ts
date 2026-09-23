import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { resolveActorId } from '../lib/actor';

// Adding someone by hand — the sourcing path. Reuses an existing candidate
// record when the email already exists, so one person accumulates a history
// across every role they are considered for rather than fragmenting into
// duplicates.

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
  jobId: z.string().min(1),
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional(),
  headline: z.string().trim().max(160).optional(),
  currentCompany: z.string().trim().max(120).optional(),
  location: z.string().trim().max(120).optional(),
  linkedInUrl: webLink(300).optional(),
  resumeUrl: webLink(500).optional(),
  yearsExperience: z.number().int().min(0).max(60).optional(),
  source: z.enum(['Sourced', 'Referral', 'Agency', 'Event', 'Inbound', 'Applied']),
  sourceDetail: z.string().trim().max(200).optional(),
  note: z.string().trim().max(4000).optional(),
});

export default createEndpoint({
  description: 'Add a sourced or referred candidate directly to a pipeline',
  authenticated: true,
  inputSchema: InputSchema,
  outputSchema: z.object({
    applicationId: z.string(),
    candidateId: z.string(),
    reusedExistingCandidate: z.boolean(),
  }),
  execute: async ({ input: raw, context }) => {
    const parsed = InputSchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw new ZiteError(
        first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid candidate',
        'BAD_REQUEST',
      );
    }
    const input = parsed.data;

    const job = await zite.jobs.findOne({ id: input.jobId });
    if (!job) throw new ZiteError('Job not found', 'NOT_FOUND');

    const email = input.email.toLowerCase();
    const existing = await zite.candidates.findAll({ filters: { email }, limit: 1 });
    let candidateId = existing.records[0]?.id;
    const reused = Boolean(candidateId);

    if (candidateId) {
      const dupe = await zite.sql({
        query: `SELECT 1 FROM "Applications" a
                JOIN "ApplicationsCandidates" lc ON lc."applicationsId" = a.id
                JOIN "ApplicationsJobs" lj ON lj."applicationsId" = a.id
                WHERE lc."candidatesId" = $1 AND lj."jobsId" = $2 LIMIT 1`,
        params: [candidateId, input.jobId],
      });
      if (dupe.rows.length > 0) {
        throw new ZiteError('That person is already in this pipeline', 'CONFLICT');
      }
    } else {
      const created = await zite.candidates.create({
        record: {
          fullName: input.fullName,
          email,
          phone: input.phone || null,
          headline: input.headline || null,
          currentCompany: input.currentCompany || null,
          location: input.location || null,
          linkedInUrl: input.linkedInUrl || null,
          yearsExperience: input.yearsExperience ?? null,
          source: input.source,
          sourceDetail: input.sourceDetail || null,
          avatarUrl: `https://i.pravatar.cc/160?u=${encodeURIComponent(email)}`,
          resume: input.resumeUrl
            ? [{ url: input.resumeUrl, filename: `${input.fullName} resume` }]
            : null,
        } as never,
      });
      candidateId = created.id;
    }

    const firstStage = await zite.sql({
      query: `SELECT s.id FROM "Stages" s
              JOIN "JobsStages" lk ON lk."stagesId" = s.id
              WHERE lk."jobsId" = $1 ORDER BY s."order" ASC LIMIT 1`,
      params: [input.jobId],
    });

    const actorId = await resolveActorId(context.user?.email);
    const now = new Date();
    const application = await zite.applications.create({
      record: {
        application: `${input.fullName} — ${job.title ?? 'Open role'}`,
        candidate: [candidateId],
        job: [input.jobId],
        currentStage: firstStage.rows[0] ? [String(firstStage.rows[0].id)] : null,
        owner: actorId ? [actorId] : null,
        appliedDate: now.toISOString().slice(0, 10),
        stageEnteredAt: now.toISOString(),
        status: 'Active',
        rating: 0,
        source: input.source,
      } as never,
    });

    await zite.activities.create({
      record: {
        summary: `${input.fullName} added via ${input.source.toLowerCase()}`,
        body: input.note || null,
        type: 'Application Created',
        occurredAt: now.toISOString(),
        application: [application.id],
        candidate: [candidateId],
        author: actorId ? [actorId] : null,
      } as never,
    });

    return { applicationId: application.id, candidateId, reusedExistingCandidate: reused };
  },
});
