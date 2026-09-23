import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import Anthropic from '@anthropic-ai/sdk';
import { firstId, resolveActorId } from '../lib/actor';

export default createEndpoint({
  description: 'Draft a candidate email for the current pipeline context',
  authenticated: true,
  inputSchema: z.object({
    applicationId: z.string().min(1),
    intent: z.enum(['screen_invite', 'schedule_loop', 'rejection', 'offer', 'nudge', 'custom']),
    instructions: z.string().max(1000).optional(),
  }),
  outputSchema: z.object({
    configured: z.boolean(),
    subject: z.string().nullable(),
    body: z.string().nullable(),
    message: z.string().nullable(),
  }),
  execute: async ({ input, context }) => {
    const apiKey = process.env.ZITE_ANTHROPIC_ACCESS_TOKEN;
    if (!apiKey) {
      return {
        configured: false,
        subject: null,
        body: null,
        message: 'Connect an Anthropic account to draft emails automatically.',
      };
    }

    const app = await zite.applications.findOne({ id: input.applicationId });
    if (!app) throw new ZiteError('Application not found', 'NOT_FOUND');

    const candidateId = firstId(app.candidate);
    const candidate = candidateId ? await zite.candidates.findOne({ id: candidateId }) : undefined;
    const jobId = firstId(app.job);
    const job = jobId ? await zite.jobs.findOne({ id: jobId }) : undefined;
    const stageId = firstId(app.currentStage);
    const stage = stageId ? await zite.stages.findOne({ id: stageId }) : undefined;

    const actorId = await resolveActorId(context.user?.email);
    const actor = actorId ? await zite.teamMembers.findOne({ id: actorId }) : undefined;

    const INTENT: Record<string, string> = {
      screen_invite: 'invite them to a 30 minute recruiter screen',
      schedule_loop: 'invite them to the final interview loop and offer scheduling options',
      rejection: 'let them know we are not moving forward, warmly and without false hope',
      offer: 'tell them we are extending an offer and set up a call to walk through it',
      nudge: 'follow up on an earlier unanswered message',
      custom: 'write the email described in the additional instructions',
    };

    const client = new Anthropic({ apiKey });
    // The workspace pins @anthropic-ai/sdk 0.72.1, whose types predate adaptive
    // thinking and output_config. The API accepts both on claude-opus-5, so the
    // request is built as a plain object and cast here rather than falling back
    // to a deprecated budget_tokens config that the model would reject.
    const request = {
      model: 'claude-opus-5',
      max_tokens: 1500,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'medium',
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              subject: { type: 'string' },
              body: { type: 'string' },
            },
            required: ['subject', 'body'],
            additionalProperties: false,
          },
        },
      },
      system:
        'You write recruiting emails on behalf of a talent team. Warm, direct, and specific — never corporate filler, never ' +
        'exclamation marks, never "excited to connect". Short paragraphs. Sign off with the sender name exactly as given. ' +
        'Do not invent interview dates, compensation figures, or commitments that were not supplied.',
      messages: [
        {
          role: 'user',
          content: [
            `Write an email to ${candidate?.fullName ?? 'the candidate'} to ${INTENT[input.intent]}.`,
            `Role: ${job?.title ?? 'an open role'}`,
            `Current stage: ${stage?.name ?? 'Applied'}`,
            candidate?.currentCompany ? `They currently work at ${candidate.currentCompany}.` : '',
            `Sender: ${actor?.name ?? 'the talent team'}`,
            input.instructions ? `Additional instructions: ${input.instructions}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        },
      ],
    } as const;

    const response = await client.messages.create(
      request as unknown as Anthropic.MessageCreateParamsNonStreaming,
    );

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    try {
      const parsed = JSON.parse(text) as { subject?: string; body?: string };
      return {
        configured: true,
        subject: parsed.subject ?? null,
        body: parsed.body ?? null,
        message: null,
      };
    } catch {
      // Structured output should make this unreachable, but a draft the user can
      // edit beats an error dialog.
      return { configured: true, subject: null, body: text || null, message: null };
    }
  },
});
