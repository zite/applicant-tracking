import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { resolveActorId, firstId } from '../lib/actor';

export default createEndpoint({
  description: 'Add a note to an application activity feed',
  authenticated: true,
  inputSchema: z.object({
    applicationId: z.string().min(1),
    body: z.string().trim().min(1).max(5000),
  }),
  outputSchema: z.object({ id: z.string() }),
  execute: async ({ input, context }) => {
    const app = await zite.applications.findOne({ id: input.applicationId });
    if (!app) throw new ZiteError('Application not found', 'NOT_FOUND');

    const actorId = await resolveActorId(context.user?.email);
    // Notes are the one activity type the user typed themselves, so unlike
    // logActivity this one surfaces failures instead of swallowing them.
    const created = await zite.activities.create({
      record: {
        summary: 'Note',
        body: input.body,
        type: 'Note',
        occurredAt: new Date().toISOString(),
        application: [app.id],
        candidate: firstId(app.candidate) ? [firstId(app.candidate)!] : null,
        author: actorId ? [actorId] : null,
      } as never,
    });

    return { id: created.id };
  },
});
