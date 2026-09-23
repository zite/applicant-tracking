import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { resolveActorId, firstId, logActivity } from '../lib/actor';

export default createEndpoint({
  description: 'Create or update interview feedback',
  authenticated: true,
  inputSchema: z.object({
    scorecardId: z.string().optional(),
    interviewId: z.string().min(1),
    overallRating: z.number().int().min(1).max(4),
    technicalSkill: z.number().int().min(0).max(4).optional(),
    communication: z.number().int().min(0).max(4).optional(),
    problemSolving: z.number().int().min(0).max(4).optional(),
    cultureAdd: z.number().int().min(0).max(4).optional(),
    recommendation: z.enum(['Strong Yes', 'Yes', 'No', 'Strong No']),
    strengths: z.string().max(5000).optional(),
    concerns: z.string().max(5000).optional(),
    notes: z.string().max(5000).optional(),
  }),
  outputSchema: z.object({ id: z.string() }),
  execute: async ({ input, context }) => {
    const interview = await zite.interviews.findOne({ id: input.interviewId });
    if (!interview) throw new ZiteError('Interview not found', 'NOT_FOUND');

    const applicationId = firstId(interview.application);
    const actorId = await resolveActorId(context.user?.email);

    const record = {
      title: `${interview.title ?? 'Interview'} feedback`,
      interview: [interview.id],
      application: applicationId ? [applicationId] : null,
      interviewer: actorId ? [actorId] : null,
      overallRating: input.overallRating,
      technicalSkill: input.technicalSkill ?? 0,
      communication: input.communication ?? 0,
      problemSolving: input.problemSolving ?? 0,
      cultureAdd: input.cultureAdd ?? 0,
      recommendation: input.recommendation,
      strengths: input.strengths ?? null,
      concerns: input.concerns ?? null,
      notes: input.notes ?? null,
      status: 'Submitted',
      submittedAt: new Date().toISOString(),
    };

    // Fill the pending scorecard already opened for this person on this
    // interview, rather than creating a second one beside it.
    let targetId = input.scorecardId;
    if (!targetId && actorId) {
      const pending = await zite.sql({
        query: `SELECT sc.id FROM "Scorecards" sc
                JOIN "InterviewsScorecards" li ON li."scorecardsId" = sc.id
                JOIN "ScorecardsTeamMembers" lt ON lt."scorecardsId" = sc.id
                WHERE li."interviewsId" = $1 AND lt."teamMembersId" = $2 AND sc."status" = 'Pending'
                LIMIT 1`,
        params: [interview.id, actorId],
      });
      targetId = pending.rows[0] ? String(pending.rows[0].id) : undefined;
    }

    const id = targetId
      ? (await zite.scorecards.update({ id: targetId, record: record as never })).id
      : (await zite.scorecards.create({ record: record as never })).id;

    // Feedback usually means the interview is behind us.
    if (interview.status === 'Scheduled') {
      await zite.interviews.update({ id: interview.id, record: { status: 'Completed' } as never });
    }

    if (applicationId) {
      await logActivity({
        applicationId,
        authorId: actorId,
        type: 'Scorecard',
        summary: `Feedback submitted — ${input.recommendation}`,
        body: input.strengths ?? null,
      });
    }

    return { id };
  },
});
