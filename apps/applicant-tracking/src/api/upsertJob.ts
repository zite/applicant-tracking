import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';

// Creating a job also creates its pipeline. A job without stages produces an
// empty board and a careers post nobody can actually progress through, so the
// two are never separate operations.

const DEFAULT_STAGES: { name: string; kind: string; targetDays: number; kit: string }[] = [
  { name: 'Applied', kind: 'Applied', targetDays: 3, kit: 'Screen for relevant scope and measurable outcomes.' },
  { name: 'Recruiter Screen', kind: 'Screen', targetDays: 5, kit: '30 min. Motivation, comp expectations, and timeline.' },
  { name: 'Working Session', kind: 'Interview', targetDays: 7, kit: '60 min applied exercise drawn from real work on the team.' },
  { name: 'Hiring Manager', kind: 'Interview', targetDays: 5, kit: '45 min. Ownership, judgement, and how they prioritise.' },
  { name: 'Final Loop', kind: 'Interview', targetDays: 7, kit: 'Cross-functional partners plus a values conversation.' },
  { name: 'Offer', kind: 'Offer', targetDays: 5, kit: 'Align on level and start date before extending.' },
  { name: 'Hired', kind: 'Hired', targetDays: 0, kit: '' },
];

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 80);

const InputSchema = z.object({
  jobId: z.string().optional(),
  title: z.string().trim().min(2).max(150),
  department: z.string().min(1).max(50),
  team: z.string().trim().max(80).optional(),
  location: z.string().trim().max(120).optional(),
  workplaceType: z.enum(['Remote', 'Hybrid', 'On-site']),
  employmentType: z.enum(['Full-time', 'Part-time', 'Contract', 'Internship']),
  status: z.enum(['Draft', 'Open', 'Paused', 'Closed', 'Filled']),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']),
  published: z.boolean(),
  confidential: z.boolean().optional(),
  openings: z.number().int().min(1).max(99),
  salaryMin: z.number().min(0).max(10_000_000).optional(),
  salaryMax: z.number().min(0).max(10_000_000).optional(),
  description: z.string().max(20000).optional(),
  requirements: z.string().max(20000).optional(),
  benefits: z.string().max(20000).optional(),
  hiringManagerId: z.string().nullable().optional(),
  recruiterId: z.string().nullable().optional(),
});

export default createEndpoint({
  description: 'Create or update a job, seeding its pipeline stages on creation',
  authenticated: true,
  inputSchema: InputSchema,
  outputSchema: z.object({ id: z.string(), slug: z.string(), stagesCreated: z.number() }),
  execute: async ({ input: raw }) => {
    // The runtime does not enforce inputSchema before execute, so validate here.
    const parsed = InputSchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw new ZiteError(
        first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid job',
        'BAD_REQUEST',
      );
    }
    const input = parsed.data;

    if (
      input.salaryMin != null &&
      input.salaryMax != null &&
      input.salaryMin > input.salaryMax
    ) {
      throw new ZiteError('Minimum salary cannot exceed the maximum', 'BAD_REQUEST');
    }

    // Slugs are public URLs, so they must stay unique across jobs.
    const base = slugify(input.title) || 'role';
    let slug = base;
    if (!input.jobId) {
      const taken = await zite.sql({
        query: `SELECT "slug" FROM "Jobs" WHERE "slug" = $1 OR "slug" LIKE $2`,
        params: [base, `${base}-%`],
      });
      if (taken.rows.some((r) => String(r.slug) === base)) {
        slug = `${base}-${taken.rows.length + 1}`;
      }
    }

    const record = {
      title: input.title,
      department: input.department,
      team: input.team || null,
      location: input.location || null,
      workplaceType: input.workplaceType,
      employmentType: input.employmentType,
      status: input.status,
      priority: input.priority,
      published: input.published,
      confidential: input.confidential ?? false,
      openings: input.openings,
      salaryMin: input.salaryMin ?? null,
      salaryMax: input.salaryMax ?? null,
      description: input.description ?? null,
      requirements: input.requirements ?? null,
      benefits: input.benefits ?? null,
      hiringManagerId: undefined,
      hiringManager: input.hiringManagerId ? [input.hiringManagerId] : null,
      recruiter: input.recruiterId ? [input.recruiterId] : null,
    } as Record<string, unknown>;
    delete record.hiringManagerId;

    if (input.jobId) {
      const existing = await zite.jobs.findOne({ id: input.jobId });
      if (!existing) throw new ZiteError('Job not found', 'NOT_FOUND');
      await zite.jobs.update({ id: input.jobId, record: record as never });
      return { id: input.jobId, slug: existing.slug ?? slug, stagesCreated: 0 };
    }

    const created = await zite.jobs.create({
      record: { ...record, slug, openedDate: new Date().toISOString().slice(0, 10) } as never,
    });

    const stages = await zite.stages.bulkCreate({
      records: DEFAULT_STAGES.map((s, i) => ({
        name: s.name,
        order: i + 1,
        kind: s.kind,
        targetDays: s.targetDays,
        interviewKit: s.kit || null,
        job: [created.id],
      })) as never,
    });

    return { id: created.id, slug, stagesCreated: stages.records.length };
  },
});
