import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { resolveActorId, firstId, logActivity } from '../lib/actor';

// Sending is best-effort by design. If the email integration is not connected —
// which is the default for a freshly installed template — the message is still
// written to the thread and marked "Logged (Not Sent)" so the conversation
// history stays complete and the UI can offer a connect prompt. Losing the
// message because the gateway is missing would be the worse failure.

export default createEndpoint({
  description: 'Send an email to a candidate, logging it to the thread either way',
  authenticated: true,
  inputSchema: z.object({
    applicationId: z.string().min(1),
    subject: z.string().trim().min(1).max(300),
    body: z.string().trim().min(1).max(20000),
  }),
  outputSchema: z.object({
    id: z.string(),
    delivered: z.boolean(),
    status: z.string(),
    reason: z.string().nullable(),
  }),
  execute: async ({ input, context }) => {
    const app = await zite.applications.findOne({ id: input.applicationId });
    if (!app) throw new ZiteError('Application not found', 'NOT_FOUND');

    const candidateId = firstId(app.candidate);
    const candidate = candidateId ? await zite.candidates.findOne({ id: candidateId }) : undefined;
    const to = candidate?.email;
    if (!to) throw new ZiteError('That candidate has no email address on file', 'BAD_REQUEST');

    const actorId = await resolveActorId(context.user?.email);
    const actor = actorId ? await zite.teamMembers.findOne({ id: actorId }) : undefined;

    let delivered = false;
    let reason: string | null = null;
    try {
      const { Email } = await import('zitejs/email');
      await Email.send({
        to,
        subject: input.subject,
        body: [{ type: 'text', content: input.body }],
      });
      delivered = true;
    } catch (error) {
      reason = error instanceof Error ? error.message : 'Email integration is not connected';
    }

    const status = delivered ? 'Sent' : 'Logged (Not Sent)';
    const created = await zite.emailMessages.create({
      record: {
        subject: input.subject,
        body: input.body,
        direction: 'Outbound',
        status,
        fromEmail: actor?.email ?? null,
        toEmail: to,
        sentAt: new Date().toISOString(),
        threadId: `thread-${app.id}`,
        application: [app.id],
        candidate: candidateId ? [candidateId] : null,
        author: actorId ? [actorId] : null,
      } as never,
    });

    await logActivity({
      applicationId: app.id,
      candidateId,
      authorId: actorId,
      type: 'Email',
      summary: delivered ? `Emailed ${candidate?.fullName ?? 'candidate'}` : `Drafted email (not sent)`,
      body: input.subject,
    });

    return { id: created.id, delivered, status, reason };
  },
});
