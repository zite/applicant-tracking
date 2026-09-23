import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';

// Editing a pipeline in place. Order comes from array position, so reordering is
// just sending the list in the order you want.
//
// Removing a stage is the dangerous half: a deleted stage would leave every
// application sitting on it with no position at all. So a stage that still holds
// applications is refused by name rather than silently orphaning anyone.

const StageSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(60),
  kind: z.enum(['Lead', 'Applied', 'Screen', 'Interview', 'Offer', 'Hired', 'Rejected']),
  targetDays: z.number().int().min(0).max(120),
  interviewKit: z.string().max(4000).nullable().optional(),
});

const InputSchema = z.object({
  jobId: z.string().min(1),
  stages: z.array(StageSchema).min(1).max(20),
});

export default createEndpoint({
  description: 'Rename, reorder, add or remove the stages of one pipeline',
  authenticated: true,
  inputSchema: InputSchema,
  outputSchema: z.object({ created: z.number(), updated: z.number(), removed: z.number() }),
  execute: async ({ input: raw }) => {
    const parsed = InputSchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw new ZiteError(first ? `${first.path.join('.')}: ${first.message}` : 'Invalid pipeline', 'BAD_REQUEST');
    }
    const input = parsed.data;

    const job = await zite.jobs.findOne({ id: input.jobId });
    if (!job) throw new ZiteError('Job not found', 'NOT_FOUND');

    const existing = (
      await zite.sql({
        query: `SELECT s.id, s."name" FROM "Stages" s
                JOIN "JobsStages" lk ON lk."stagesId" = s.id
                WHERE lk."jobsId" = $1`,
        params: [input.jobId],
      })
    ).rows.map((r) => ({ id: String(r.id), name: String(r.name ?? '') }));

    const keptIds = new Set(input.stages.map((s) => s.id).filter(Boolean) as string[]);
    const toRemove = existing.filter((e) => !keptIds.has(e.id));

    if (toRemove.length > 0) {
      const occupied = (
        await zite.sql({
          query: `SELECT st."name", COUNT(*) AS "n"
                  FROM "Applications" a
                  JOIN "ApplicationsStages" ls ON ls."applicationsId" = a.id
                  JOIN "Stages" st ON st.id = ls."stagesId"
                  WHERE ls."stagesId" = ANY($1::uuid[])
                  GROUP BY st."name"`,
          params: [toRemove.map((r) => r.id)],
        })
      ).rows;
      if (occupied.length > 0) {
        const detail = occupied
          .map((o) => `${o.name} (${Number(o.n)})`)
          .join(', ');
        throw new ZiteError(
          `Move candidates out of these stages before removing them: ${detail}`,
          'CONFLICT',
        );
      }
    }

    let created = 0;
    let updated = 0;

    for (let i = 0; i < input.stages.length; i++) {
      const s = input.stages[i];
      const record = {
        name: s.name,
        order: i + 1,
        kind: s.kind,
        targetDays: s.targetDays,
        interviewKit: s.interviewKit ?? null,
        job: [input.jobId],
      };
      if (s.id) {
        await zite.stages.update({ id: s.id, record: record as never });
        updated += 1;
      } else {
        await zite.stages.create({ record: record as never });
        created += 1;
      }
    }

    for (const r of toRemove) await zite.stages.delete({ id: r.id });

    return { created, updated, removed: toRemove.length };
  },
});
