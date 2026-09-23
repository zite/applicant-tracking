import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Delete a candidate email template',
  authenticated: true,
  inputSchema: z.object({ templateId: z.string().min(1) }),
  outputSchema: z.object({ id: z.string() }),
  execute: async ({ input }) => {
    const existing = await zite.emailTemplates.findOne({ id: input.templateId });
    if (!existing) throw new ZiteError('Template not found', 'NOT_FOUND');
    await zite.emailTemplates.delete({ id: input.templateId });
    return { id: input.templateId };
  },
});
