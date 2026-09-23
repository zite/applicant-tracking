import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { resolveActorId, firstId, logActivity } from '../lib/actor';

export default createEndpoint({
  description: 'Create or update an offer, including approval and response state',
  authenticated: true,
  inputSchema: z.object({
    offerId: z.string().optional(),
    applicationId: z.string().min(1),
    status: z.enum(['Draft', 'Pending Approval', 'Approved', 'Sent', 'Accepted', 'Declined', 'Rescinded']),
    baseSalary: z.number().min(0).max(10_000_000).optional(),
    signingBonus: z.number().min(0).max(10_000_000).optional(),
    equity: z.string().max(50).optional(),
    level: z.string().max(100).optional(),
    startDate: z.string().optional(),
    expiresAt: z.string().optional(),
    notes: z.string().max(5000).optional(),
  }),
  outputSchema: z.object({ id: z.string() }),
  execute: async ({ input, context }) => {
    const app = await zite.applications.findOne({ id: input.applicationId });
    if (!app) throw new ZiteError('Application not found', 'NOT_FOUND');

    const candidateId = firstId(app.candidate);
    const candidate = candidateId ? await zite.candidates.findOne({ id: candidateId }) : undefined;
    const actorId = await resolveActorId(context.user?.email);

    const terminal = input.status === 'Accepted' || input.status === 'Declined';
    const record = {
      title: `Offer — ${candidate?.fullName ?? 'Candidate'}`,
      application: [app.id],
      approver: actorId ? [actorId] : null,
      status: input.status,
      baseSalary: input.baseSalary ?? null,
      signingBonus: input.signingBonus ?? null,
      equity: input.equity ?? null,
      level: input.level ?? null,
      startDate: input.startDate || null,
      expiresAt: input.expiresAt || null,
      notes: input.notes ?? null,
      sentAt: input.status === 'Sent' ? new Date().toISOString() : null,
      respondedAt: terminal ? new Date().toISOString() : null,
    };

    const id = input.offerId
      ? (await zite.offers.update({ id: input.offerId, record: record as never })).id
      : (await zite.offers.create({ record: record as never })).id;

    // An accepted offer is a hire — keep the pipeline honest about that rather
    // than leaving the candidate sitting in Offer forever.
    if (input.status === 'Accepted' && app.status !== 'Hired') {
      await zite.applications.update({ id: app.id, record: { status: 'Hired' } as never });
    }

    await logActivity({
      applicationId: app.id,
      candidateId,
      authorId: actorId,
      type: 'Offer',
      summary: `Offer ${input.status.toLowerCase()}`,
      body: input.baseSalary ? `Base ${input.baseSalary.toLocaleString('en-US')}` : null,
    });

    return { id };
  },
});
