import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { resolveActorId, firstId, logActivity } from '../lib/actor';

// Scheduling an interview also opens a pending scorecard for every interviewer
// on the panel. That is what makes "feedback you owe" a real queue rather than a
// number that is always zero — and it is how a hiring team notices that one
// panellist never wrote anything up.

export default createEndpoint({
  description: 'Schedule or reschedule an interview and open its scorecards',
  authenticated: true,
  inputSchema: z.object({
    interviewId: z.string().optional(),
    applicationId: z.string().min(1),
    title: z.string().trim().min(1).max(200),
    type: z.string().min(1),
    scheduledAt: z.string().min(1),
    durationMinutes: z.number().int().min(15).max(480),
    interviewerIds: z.array(z.string()).max(10),
    meetingLink: z.string().max(500).optional(),
    status: z.enum(['Unscheduled', 'Scheduled', 'Completed', 'Cancelled', 'No Show']).optional(),
  }),
  outputSchema: z.object({ id: z.string(), scorecardsOpened: z.number() }),
  execute: async ({ input, context }) => {
    const app = await zite.applications.findOne({ id: input.applicationId });
    if (!app) throw new ZiteError('Application not found', 'NOT_FOUND');

    const record = {
      title: input.title,
      type: input.type,
      scheduledAt: input.scheduledAt,
      durationMinutes: input.durationMinutes,
      meetingLink: input.meetingLink || null,
      location: input.meetingLink ? 'Video call' : null,
      status: input.status ?? 'Scheduled',
      application: [app.id],
      stage: firstId(app.currentStage) ? [firstId(app.currentStage)!] : null,
      interviewers: input.interviewerIds.length ? input.interviewerIds : null,
    };

    const id = input.interviewId
      ? (await zite.interviews.update({ id: input.interviewId, record: record as never })).id
      : (await zite.interviews.create({ record: record as never })).id;

    // Open one pending scorecard per interviewer who does not already have one,
    // so rescheduling never duplicates what someone already wrote.
    const existing = input.interviewId
      ? (
          await zite.sql({
            query: `SELECT lt."teamMembersId" AS "memberId"
                    FROM "Scorecards" sc
                    JOIN "InterviewsScorecards" li ON li."scorecardsId" = sc.id
                    LEFT JOIN "ScorecardsTeamMembers" lt ON lt."scorecardsId" = sc.id
                    WHERE li."interviewsId" = $1`,
            params: [id],
          })
        ).rows.map((r) => String(r.memberId))
      : [];

    const missing = input.interviewerIds.filter((m) => !existing.includes(m));
    if (missing.length > 0) {
      await zite.scorecards.bulkCreate({
        records: missing.map((memberId) => ({
          title: `${input.title} feedback`,
          interview: [id],
          application: [app.id],
          interviewer: [memberId],
          status: 'Pending',
          overallRating: 0,
          technicalSkill: 0,
          communication: 0,
          problemSolving: 0,
          cultureAdd: 0,
        })) as never,
      });
    }

    const actorId = await resolveActorId(context.user?.email);
    await logActivity({
      applicationId: app.id,
      candidateId: firstId(app.candidate),
      authorId: actorId,
      type: 'Interview Scheduled',
      summary: input.interviewId ? `Rescheduled ${input.title}` : `Scheduled ${input.title}`,
    });

    return { id, scorecardsOpened: missing.length };
  },
});
