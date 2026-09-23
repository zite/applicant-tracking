import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { resolveActorId } from '../lib/actor';

// "What needs me today." A recruiter's first screen of the morning: feedback
// they owe, interviews they are sitting on, candidates rotting in a stage past
// its target, offers waiting on an approval, and applications nobody has looked
// at yet. Everything here is actionable — nothing is a vanity count.

const s = (v: unknown) => (v == null ? null : String(v));
const n = (v: unknown) => Number(v ?? 0);

export default createEndpoint({
  description: 'The signed-in user’s actionable queue across every pipeline',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({
    meId: z.string().nullable(),
    feedbackDue: z.array(z.object({
      scorecardId: z.string(),
      interviewId: z.string(),
      applicationId: z.string().nullable(),
      interviewTitle: z.string().nullable(),
      interviewType: z.string().nullable(),
      scheduledAt: z.string().nullable(),
      candidateName: z.string().nullable(),
      candidateAvatar: z.string().nullable(),
      jobTitle: z.string().nullable(),
    })),
    interviewsToday: z.array(z.object({
      id: z.string(),
      applicationId: z.string().nullable(),
      title: z.string(),
      type: z.string().nullable(),
      scheduledAt: z.string().nullable(),
      meetingLink: z.string().nullable(),
      candidateName: z.string().nullable(),
      candidateAvatar: z.string().nullable(),
      jobTitle: z.string().nullable(),
    })),
    stale: z.array(z.object({
      applicationId: z.string(),
      candidateName: z.string().nullable(),
      candidateAvatar: z.string().nullable(),
      jobTitle: z.string().nullable(),
      stageName: z.string().nullable(),
      daysInStage: z.number(),
      targetDays: z.number(),
    })),
    unreviewed: z.array(z.object({
      applicationId: z.string(),
      candidateName: z.string().nullable(),
      candidateAvatar: z.string().nullable(),
      headline: z.string().nullable(),
      jobTitle: z.string().nullable(),
      appliedDate: z.string().nullable(),
      source: z.string().nullable(),
    })),
    offersToApprove: z.array(z.object({
      offerId: z.string(),
      applicationId: z.string().nullable(),
      candidateName: z.string().nullable(),
      jobTitle: z.string().nullable(),
      baseSalary: z.number().nullable(),
      status: z.string().nullable(),
    })),
  }),
  execute: async ({ context }) => {
    const meId = await resolveActorId(context.user?.email);
    const me = meId ?? '00000000-0000-0000-0000-000000000000';

    const [feedback, interviews, stale, unreviewed, offers] = await Promise.all([
      zite.sql({
        query: `
          SELECT sc.id AS "scorecardId", i.id AS "interviewId", i."title", i."type", i."scheduledAt",
                 la."applicationsId" AS "applicationId",
                 c."fullName", c."avatarUrl", j."title" AS "jobTitle"
          FROM "Scorecards" sc
          JOIN "ScorecardsTeamMembers" lt ON lt."scorecardsId" = sc.id AND lt."teamMembersId" = $1
          JOIN "InterviewsScorecards" li ON li."scorecardsId" = sc.id
          JOIN "Interviews" i ON i.id = li."interviewsId"
          LEFT JOIN "ApplicationsInterviews" la ON la."interviewsId" = i.id
          LEFT JOIN "ApplicationsCandidates" lc ON lc."applicationsId" = la."applicationsId"
          LEFT JOIN "Candidates" c ON c.id = lc."candidatesId"
          LEFT JOIN "ApplicationsJobs" lj ON lj."applicationsId" = la."applicationsId"
          LEFT JOIN "Jobs" j ON j.id = lj."jobsId"
          WHERE sc."status" = 'Pending' AND i."scheduledAt" < NOW()
          ORDER BY i."scheduledAt" DESC
          LIMIT 25`,
        params: [me],
      }),
      zite.sql({
        query: `
          SELECT i.id, i."title", i."type", i."scheduledAt", i."meetingLink",
                 la."applicationsId" AS "applicationId",
                 c."fullName", c."avatarUrl", j."title" AS "jobTitle"
          FROM "Interviews" i
          JOIN "InterviewsTeamMembers" lt ON lt."interviewsId" = i.id AND lt."teamMembersId" = $1
          LEFT JOIN "ApplicationsInterviews" la ON la."interviewsId" = i.id
          LEFT JOIN "ApplicationsCandidates" lc ON lc."applicationsId" = la."applicationsId"
          LEFT JOIN "Candidates" c ON c.id = lc."candidatesId"
          LEFT JOIN "ApplicationsJobs" lj ON lj."applicationsId" = la."applicationsId"
          LEFT JOIN "Jobs" j ON j.id = lj."jobsId"
          WHERE i."status" = 'Scheduled' AND i."scheduledAt" >= NOW()
            AND i."scheduledAt" < NOW() + INTERVAL '3 days'
          ORDER BY i."scheduledAt" ASC
          LIMIT 25`,
        params: [me],
      }),
      zite.sql({
        query: `
          SELECT a.id AS "applicationId", c."fullName", c."avatarUrl",
                 j."title" AS "jobTitle", st."name" AS "stageName",
                 COALESCE(st."targetDays", 0) AS "targetDays",
                 FLOOR(EXTRACT(EPOCH FROM (NOW() - a."stageEnteredAt")) / 86400) AS "daysInStage"
          FROM "Applications" a
          JOIN "ApplicationsTeamMembers" lo ON lo."applicationsId" = a.id AND lo."teamMembersId" = $1
          LEFT JOIN "ApplicationsCandidates" lc ON lc."applicationsId" = a.id
          LEFT JOIN "Candidates" c ON c.id = lc."candidatesId"
          LEFT JOIN "ApplicationsJobs" lj ON lj."applicationsId" = a.id
          LEFT JOIN "Jobs" j ON j.id = lj."jobsId"
          LEFT JOIN "ApplicationsStages" ls ON ls."applicationsId" = a.id
          LEFT JOIN "Stages" st ON st.id = ls."stagesId"
          WHERE a."status" = 'Active'
            AND a."stageEnteredAt" IS NOT NULL
            AND COALESCE(st."targetDays", 0) > 0
            AND st."kind" NOT IN ('Hired', 'Rejected')
            AND EXTRACT(EPOCH FROM (NOW() - a."stageEnteredAt")) / 86400 > st."targetDays"
          ORDER BY EXTRACT(EPOCH FROM (NOW() - a."stageEnteredAt")) DESC
          LIMIT 25`,
        params: [me],
      }),
      zite.sql({
        query: `
          SELECT a.id AS "applicationId", a."appliedDate", a."source",
                 c."fullName", c."avatarUrl", c."headline", j."title" AS "jobTitle"
          FROM "Applications" a
          JOIN "ApplicationsTeamMembers" lo ON lo."applicationsId" = a.id AND lo."teamMembersId" = $1
          LEFT JOIN "ApplicationsCandidates" lc ON lc."applicationsId" = a.id
          LEFT JOIN "Candidates" c ON c.id = lc."candidatesId"
          LEFT JOIN "ApplicationsJobs" lj ON lj."applicationsId" = a.id
          LEFT JOIN "Jobs" j ON j.id = lj."jobsId"
          LEFT JOIN "ApplicationsStages" ls ON ls."applicationsId" = a.id
          LEFT JOIN "Stages" st ON st.id = ls."stagesId"
          WHERE a."status" = 'Active' AND st."kind" = 'Applied'
            AND COALESCE(a."rating", 0) = 0
          ORDER BY a."appliedDate" DESC NULLS LAST
          LIMIT 25`,
        params: [me],
      }),
      zite.sql({
        query: `
          SELECT o.id AS "offerId", o."baseSalary", o."status",
                 lk."applicationsId" AS "applicationId",
                 c."fullName", j."title" AS "jobTitle"
          FROM "Offers" o
          JOIN "ApplicationsOffers" lk ON lk."offersId" = o.id
          LEFT JOIN "ApplicationsCandidates" lc ON lc."applicationsId" = lk."applicationsId"
          LEFT JOIN "Candidates" c ON c.id = lc."candidatesId"
          LEFT JOIN "ApplicationsJobs" lj ON lj."applicationsId" = lk."applicationsId"
          LEFT JOIN "Jobs" j ON j.id = lj."jobsId"
          WHERE o."status" = 'Pending Approval'
          ORDER BY o."sentAt" DESC NULLS LAST
          LIMIT 15`,
      }),
    ]);

    return {
      meId,
      feedbackDue: feedback.rows.map((r) => ({
        scorecardId: String(r.scorecardId),
        interviewId: String(r.interviewId),
        applicationId: s(r.applicationId),
        interviewTitle: s(r.title),
        interviewType: s(r.type),
        scheduledAt: s(r.scheduledAt),
        candidateName: s(r.fullName),
        candidateAvatar: s(r.avatarUrl),
        jobTitle: s(r.jobTitle),
      })),
      interviewsToday: interviews.rows.map((r) => ({
        id: String(r.id),
        applicationId: s(r.applicationId),
        title: r.title == null ? 'Interview' : String(r.title),
        type: s(r.type),
        scheduledAt: s(r.scheduledAt),
        meetingLink: s(r.meetingLink),
        candidateName: s(r.fullName),
        candidateAvatar: s(r.avatarUrl),
        jobTitle: s(r.jobTitle),
      })),
      stale: stale.rows.map((r) => ({
        applicationId: String(r.applicationId),
        candidateName: s(r.fullName),
        candidateAvatar: s(r.avatarUrl),
        jobTitle: s(r.jobTitle),
        stageName: s(r.stageName),
        daysInStage: n(r.daysInStage),
        targetDays: n(r.targetDays),
      })),
      unreviewed: unreviewed.rows.map((r) => ({
        applicationId: String(r.applicationId),
        candidateName: s(r.fullName),
        candidateAvatar: s(r.avatarUrl),
        headline: s(r.headline),
        jobTitle: s(r.jobTitle),
        appliedDate: r.appliedDate == null ? null : String(r.appliedDate).slice(0, 10),
        source: s(r.source),
      })),
      offersToApprove: offers.rows.map((r) => ({
        offerId: String(r.offerId),
        applicationId: s(r.applicationId),
        candidateName: s(r.fullName),
        jobTitle: s(r.jobTitle),
        baseSalary: r.baseSalary == null ? null : Number(r.baseSalary),
        status: s(r.status),
      })),
    };
  },
});
