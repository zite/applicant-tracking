import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Create or update a candidate email template',
  authenticated: true,
  inputSchema: z.object({
    templateId: z.string().optional(),
    name: z.string().trim().min(1).max(120),
    subject: z.string().trim().min(1).max(300),
    body: z.string().trim().min(1).max(20000),
    category: z.enum(['Outreach', 'Screening', 'Scheduling', 'Rejection', 'Offer', 'Follow-up']),
  }),
  outputSchema: z.object({ id: z.string() }),
  execute: async ({ input }) => {
    const record = {
      name: input.name,
      subject: input.subject,
      body: input.body,
      category: input.category,
    };
    if (input.templateId) {
      const existing = await zite.emailTemplates.findOne({ id: input.templateId });
      if (!existing) throw new ZiteError('Template not found', 'NOT_FOUND');
      await zite.emailTemplates.update({ id: input.templateId, record: record as never });
      return { id: input.templateId };
    }
    const created = await zite.emailTemplates.create({ record: record as never });
    return { id: created.id };
  },
});
