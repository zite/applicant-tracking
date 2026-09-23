import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

// Drives the connect prompts in the UI. Every AI and email surface checks this
// first so an unconfigured workspace shows an honest call to action instead of
// a broken button.

export default createEndpoint({
  description: 'Report which optional integrations are connected',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({
    ai: z.object({ configured: z.boolean(), provider: z.string().nullable() }),
    email: z.object({ configured: z.boolean(), undeliveredCount: z.number() }),
  }),
  execute: async () => {
    const anthropic = Boolean(process.env.ZITE_ANTHROPIC_ACCESS_TOKEN);
    const openai = Boolean(process.env.ZITE_OPENAI_ACCESS_TOKEN);

    let emailConfigured = false;
    try {
      await import('zitejs/email');
      emailConfigured = true;
    } catch {
      emailConfigured = false;
    }

    // A backlog of unsent mail is the honest signal that the gateway is missing,
    // even when the module itself loaded.
    const undelivered = await zite.sql({
      query: `SELECT COUNT(*) AS "n" FROM "EmailMessages" WHERE "status" = 'Logged (Not Sent)'`,
    });

    return {
      ai: {
        configured: anthropic || openai,
        provider: anthropic ? 'anthropic' : openai ? 'openai' : null,
      },
      email: {
        configured: emailConfigured,
        undeliveredCount: Number(undelivered.rows[0]?.n ?? 0),
      },
    };
  },
});
