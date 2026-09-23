import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { resolveActorId, firstId, logActivity } from '../lib/actor';

// Triage in bulk — the thing recruiters actually do with a morning's inbound.
// There are no transactions here, so each application is applied independently
// and the endpoint reports what succeeded rather than pretending the batch is
// atomic. A partial failure leaves the rest correctly applied.

const InputSchema = z.object({
  applicationIds: z.array(z.string().min(1)).min(1).max(100),
  op: z.enum(['reject', 'move', 'assign', 'status', 'rate']),
  stageId: z.string().optional(),
  ownerId: z.string().nullable().optional(),
  status: z.enum(['Active', 'Hired', 'Rejected', 'Withdrawn', 'On Hold']).optional(),
  rating: z.number().int().min(0).max(4).optional(),
  rejectionReason: z.string().max(100).optional(),
  // Rejection email is opt-in and capped; sending 100 at once is a mistake, not
  // a feature.
  sendRejectionEmail: z.boolean().optional(),
  emailSubject: z.string().max(300).optional(),
  emailBody: z.string().max(20000).optional(),
});

export default createEndpoint({
  description: 'Apply one change across many applications at once',
  authenticated: true,
  inputSchema: InputSchema,
  outputSchema: z.object({
    updated: z.number(),
    failed: z.number(),
    emailsSent: z.number(),
    emailsLogged: z.number(),
  }),
  execute: async ({ input: raw, context }) => {
    const parsed = InputSchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw new ZiteError(first ? `${first.path.join('.')}: ${first.message}` : 'Invalid request', 'BAD_REQUEST');
    }
    const input = parsed.data;

    if (input.op === 'move' && !input.stageId) {
      throw new ZiteError('A stage is required to move applications', 'BAD_REQUEST');
    }

    const actorId = await resolveActorId(context.user?.email);
    const now = new Date().toISOString();
    const stage = input.stageId ? await zite.stages.findOne({ id: input.stageId }) : null;

    let updated = 0;
    let failed = 0;
    let emailsSent = 0;
    let emailsLogged = 0;
    const wantsEmail =
      input.op === 'reject' &&
      input.sendRejectionEmail === true &&
      Boolean(input.emailSubject?.trim()) &&
      Boolean(input.emailBody?.trim()) &&
      input.applicationIds.length <= 25;

    for (const id of input.applicationIds) {
      try {
        const app = await zite.applications.findOne({ id });
        if (!app) {
          failed += 1;
          continue;
        }
        const candidateId = firstId(app.candidate);

        if (input.op === 'reject') {
          await zite.applications.update({
            id,
            record: {
              status: 'Rejected',
              rejectionReason: input.rejectionReason ?? 'Other',
              rejectedDate: now.slice(0, 10),
            } as never,
          });
          await logActivity({
            applicationId: id,
            candidateId,
            authorId: actorId,
            type: 'Status Change',
            summary: `Rejected — ${input.rejectionReason ?? 'Other'}`,
          });

          if (wantsEmail && candidateId) {
            const candidate = await zite.candidates.findOne({ id: candidateId });
            const to = candidate?.email;
            if (to) {
              const first = (candidate?.fullName ?? '').split(' ')[0] || 'there';
              const body = input.emailBody!.replace(/\{\{firstName\}\}/g, first);
              let delivered = false;
              try {
                const { Email } = await import('zitejs/email');
                await Email.send({ to, subject: input.emailSubject!, body: [{ type: 'text', content: body }] });
                delivered = true;
              } catch {
                delivered = false;
              }
              await zite.emailMessages.create({
                record: {
                  subject: input.emailSubject,
                  body,
                  direction: 'Outbound',
                  status: delivered ? 'Sent' : 'Logged (Not Sent)',
                  toEmail: to,
                  sentAt: now,
                  threadId: `thread-${id}`,
                  application: [id],
                  candidate: [candidateId],
                  author: actorId ? [actorId] : null,
                } as never,
              });
              if (delivered) emailsSent += 1;
              else emailsLogged += 1;
            }
          }
        } else if (input.op === 'move') {
          const kind = stage?.kind ?? '';
          const nextStatus = kind === 'Hired' ? 'Hired' : kind === 'Rejected' ? 'Rejected' : 'Active';
          await zite.applications.update({
            id,
            record: {
              currentStage: [input.stageId!],
              stageEnteredAt: now,
              status: nextStatus,
            } as never,
          });
          await logActivity({
            applicationId: id,
            candidateId,
            authorId: actorId,
            type: 'Stage Change',
            summary: `Moved to ${stage?.name ?? 'a new stage'}`,
          });
        } else if (input.op === 'assign') {
          await zite.applications.update({
            id,
            record: { owner: input.ownerId ? [input.ownerId] : null } as never,
          });
        } else if (input.op === 'status' && input.status) {
          await zite.applications.update({
            id,
            record: {
              status: input.status,
              rejectedDate:
                input.status === 'Rejected' || input.status === 'Withdrawn' ? now.slice(0, 10) : null,
            } as never,
          });
          await logActivity({
            applicationId: id,
            candidateId,
            authorId: actorId,
            type: 'Status Change',
            summary: `Status set to ${input.status}`,
          });
        } else if (input.op === 'rate' && input.rating !== undefined) {
          await zite.applications.update({ id, record: { rating: input.rating } as never });
        }

        updated += 1;
      } catch {
        failed += 1;
      }
    }

    return { updated, failed, emailsSent, emailsLogged };
  },
});
