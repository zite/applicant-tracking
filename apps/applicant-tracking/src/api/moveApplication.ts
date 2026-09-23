import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { resolveActorId, firstId, logActivity } from '../lib/actor';

// The board's hot path. Ordering matters: the stage write lands before the
// activity row, so a failure in logging can never leave the card visually moved
// but actually unmoved.

export default createEndpoint({
  description: 'Move an application to a different stage in its pipeline',
  authenticated: true,
  inputSchema: z.object({
    applicationId: z.string().min(1),
    stageId: z.string().min(1),
  }),
  outputSchema: z.object({
    id: z.string(),
    stageId: z.string(),
    status: z.string(),
  }),
  execute: async ({ input, context }) => {
    const app = await zite.applications.findOne({ id: input.applicationId });
    if (!app) throw new ZiteError('Application not found', 'NOT_FOUND');

    const stage = await zite.stages.findOne({ id: input.stageId });
    if (!stage) throw new ZiteError('Stage not found', 'NOT_FOUND');

    // A stage belongs to exactly one job; refuse a move that would land a
    // candidate on another job's pipeline.
    const stageJobId = firstId(stage.job);
    const appJobId = firstId(app.job);
    if (stageJobId && appJobId && stageJobId !== appJobId) {
      throw new ZiteError('That stage belongs to a different job', 'BAD_REQUEST');
    }

    const fromStageId = firstId(app.currentStage);
    if (fromStageId === input.stageId) {
      return { id: app.id, stageId: input.stageId, status: app.status ?? 'Active' };
    }

    // Terminal stages carry the status with them, so the board and the
    // candidate list cannot disagree about whether someone is still in play.
    const kind = stage.kind ?? '';
    const nextStatus = kind === 'Hired' ? 'Hired' : kind === 'Rejected' ? 'Rejected' : 'Active';

    await zite.applications.update({
      id: app.id,
      record: {
        currentStage: [input.stageId],
        stageEnteredAt: new Date().toISOString(),
        status: nextStatus,
        ...(nextStatus === 'Hired' || nextStatus === 'Rejected'
          ? { rejectedDate: nextStatus === 'Rejected' ? new Date().toISOString().slice(0, 10) : null }
          : { rejectedDate: null }),
      } as never,
    });

    const fromStage = fromStageId ? await zite.stages.findOne({ id: fromStageId }) : null;
    const actorId = await resolveActorId(context.user?.email);
    await logActivity({
      applicationId: app.id,
      candidateId: firstId(app.candidate),
      authorId: actorId,
      type: 'Stage Change',
      summary: fromStage?.name
        ? `Moved from ${fromStage.name} to ${stage.name ?? 'a new stage'}`
        : `Moved to ${stage.name ?? 'a new stage'}`,
    });

    return { id: app.id, stageId: input.stageId, status: nextStatus };
  },
});
