import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { resolveActorId, firstId, logActivity } from '../lib/actor';

export default createEndpoint({
  description: 'Update an application: rating, status, owner or rejection reason',
  authenticated: true,
  inputSchema: z.object({
    applicationId: z.string().min(1),
    rating: z.number().int().min(0).max(4).optional(),
    status: z.enum(['Active', 'Hired', 'Rejected', 'Withdrawn', 'On Hold']).optional(),
    ownerId: z.string().nullable().optional(),
    rejectionReason: z.string().nullable().optional(),
  }),
  outputSchema: z.object({ id: z.string() }),
  execute: async ({ input, context }) => {
    const app = await zite.applications.findOne({ id: input.applicationId });
    if (!app) throw new ZiteError('Application not found', 'NOT_FOUND');

    const patch: Record<string, unknown> = {};
    if (input.rating !== undefined) patch.rating = input.rating;
    if (input.ownerId !== undefined) patch.owner = input.ownerId ? [input.ownerId] : null;
    if (input.rejectionReason !== undefined) patch.rejectionReason = input.rejectionReason;
    if (input.status !== undefined) {
      patch.status = input.status;
      patch.rejectedDate =
        input.status === 'Rejected' || input.status === 'Withdrawn'
          ? new Date().toISOString().slice(0, 10)
          : null;
    }
    if (Object.keys(patch).length === 0) {
      throw new ZiteError('Nothing to update', 'BAD_REQUEST');
    }

    await zite.applications.update({ id: app.id, record: patch as never });

    const actorId = await resolveActorId(context.user?.email);
    const candidateId = firstId(app.candidate);
    if (input.status !== undefined && input.status !== app.status) {
      await logActivity({
        applicationId: app.id,
        candidateId,
        authorId: actorId,
        type: 'Status Change',
        summary:
          input.status === 'Rejected'
            ? `Rejected${input.rejectionReason ? ` — ${input.rejectionReason}` : ''}`
            : `Status set to ${input.status}`,
      });
    } else if (input.rating !== undefined && input.rating !== app.rating) {
      await logActivity({
        applicationId: app.id,
        candidateId,
        authorId: actorId,
        type: 'Rating',
        summary: `Rated ${input.rating} out of 4`,
      });
    }

    return { id: app.id };
  },
});
