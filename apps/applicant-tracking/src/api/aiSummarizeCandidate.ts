import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import Anthropic from '@anthropic-ai/sdk';
import { firstId } from '../lib/actor';

// Synthesises the profile and every submitted scorecard into a short brief for
// whoever picks the candidate up next. Returns `configured: false` rather than
// throwing when no AI account is attached, so the UI can show a connect prompt
// instead of an error.

export default createEndpoint({
  description: 'Summarise a candidate from their profile and interview feedback',
  authenticated: true,
  inputSchema: z.object({ applicationId: z.string().min(1) }),
  outputSchema: z.object({
    configured: z.boolean(),
    summary: z.string().nullable(),
    message: z.string().nullable(),
  }),
  execute: async ({ input }) => {
    const apiKey = process.env.ZITE_ANTHROPIC_ACCESS_TOKEN;
    if (!apiKey) {
      return {
        configured: false,
        summary: null,
        message: 'Connect an Anthropic account to generate candidate summaries.',
      };
    }

    const app = await zite.applications.findOne({ id: input.applicationId });
    if (!app) throw new ZiteError('Application not found', 'NOT_FOUND');

    const candidateId = firstId(app.candidate);
    const candidate = candidateId ? await zite.candidates.findOne({ id: candidateId }) : undefined;
    if (!candidate) throw new ZiteError('Candidate not found', 'NOT_FOUND');

    const jobId = firstId(app.job);
    const job = jobId ? await zite.jobs.findOne({ id: jobId }) : undefined;

    const feedback = (
      await zite.sql({
        query: `
          SELECT sc."overallRating", sc."recommendation", sc."strengths", sc."concerns", i."type"
          FROM "Scorecards" sc
          JOIN "ApplicationsScorecards" lk ON lk."scorecardsId" = sc.id
          LEFT JOIN "InterviewsScorecards" li ON li."scorecardsId" = sc.id
          LEFT JOIN "Interviews" i ON i.id = li."interviewsId"
          WHERE lk."applicationsId" = $1 AND sc."status" = 'Submitted'
          ORDER BY sc."submittedAt" ASC
          LIMIT 30
        `,
        params: [input.applicationId],
      })
    ).rows;

    const profile = [
      `Name: ${candidate.fullName ?? 'Unknown'}`,
      candidate.headline ? `Current title: ${candidate.headline}` : null,
      candidate.currentCompany ? `Company: ${candidate.currentCompany}` : null,
      candidate.yearsExperience ? `Years of experience: ${candidate.yearsExperience}` : null,
      candidate.location ? `Location: ${candidate.location}` : null,
      Array.isArray(candidate.skills) && candidate.skills.length
        ? `Skills: ${candidate.skills.join(', ')}`
        : null,
      `Applying for: ${job?.title ?? 'an open role'}`,
      `Source: ${app.source ?? 'Unknown'}`,
    ]
      .filter(Boolean)
      .join('\n');

    const feedbackText = feedback.length
      ? feedback
          .map(
            (f, i) =>
              `Interview ${i + 1} (${f.type ?? 'unknown type'}) — ${f.recommendation ?? 'no recommendation'}, rated ${f.overallRating ?? '?'}/4\n` +
              `  Strengths: ${f.strengths ?? 'none recorded'}\n` +
              `  Concerns: ${f.concerns ?? 'none recorded'}`,
          )
          .join('\n\n')
      : 'No interview feedback has been submitted yet.';

    const client = new Anthropic({ apiKey });
    // The workspace pins @anthropic-ai/sdk 0.72.1, whose types predate adaptive
    // thinking and output_config. The API accepts both on claude-opus-5, so the
    // request is built as a plain object and cast here rather than falling back
    // to a deprecated budget_tokens config that the model would reject.
    const request = {
      model: 'claude-opus-5',
      max_tokens: 1200,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      system:
        'You brief hiring teams on candidates. Write 3-5 sentences of plain prose — no headings, no bullet points, no preamble. ' +
        'Lead with the strongest evidence for or against moving forward. Name concrete specifics from the feedback rather than ' +
        'restating ratings. If the feedback conflicts, say so plainly. If there is no feedback yet, say what the profile suggests ' +
        'and what the first conversation should test. Never invent detail that is not in the input.',
      messages: [
        {
          role: 'user',
          content: `Candidate profile:\n${profile}\n\nInterview feedback:\n${feedbackText}`,
        },
      ],
    } as const;

    const response = await client.messages.create(
      request as unknown as Anthropic.MessageCreateParamsNonStreaming,
    );

    const summary = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    if (summary && candidateId) {
      await zite.candidates.update({ id: candidateId, record: { aiSummary: summary } as never });
    }

    return { configured: true, summary: summary || null, message: null };
  },
});
