import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'List reusable candidate email templates',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({
    templates: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        subject: z.string().nullable(),
        body: z.string().nullable(),
        category: z.string().nullable(),
      }),
    ),
  }),
  execute: async () => {
    const { records } = await zite.emailTemplates.findAll({ limit: 100 });
    return {
      templates: records
        .map((t) => ({
          id: t.id,
          name: t.name ?? 'Untitled template',
          subject: t.subject ?? null,
          body: t.body ?? null,
          category: t.category ?? null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  },
});
