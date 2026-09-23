import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';

// The candidate detail view. Everything on the page in one round trip: profile,
// role, pipeline position, interview history with feedback, the activity feed,
// the email thread, and any offer.

const toStringArray = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string' && v.trim().startsWith('[')) {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
};
const s = (v: unknown) => (v == null ? null : String(v));
const n = (v: unknown) => (v == null ? 0 : Number(v));

export default createEndpoint({
  description: 'Full detail for one application: candidate, feedback, activity and email',
  authenticated: true,
  inputSchema: z.object({ applicationId: z.string().min(1) }),
  outputSchema: z.object({
    application: z.object({
      id: z.string(),
      status: z.string(),
      rating: z.number(),
      source: z.string().nullable(),
      appliedDate: z.string().nullable(),
      stageEnteredAt: z.string().nullable(),
      rejectionReason: z.string().nullable(),
      ownerId: z.string().nullable(),
      stageId: z.string().nullable(),
      stageName: z.string().nullable(),
      jobId: z.string().nullable(),
      jobTitle: z.string().nullable(),
      interviewKit: z.string().nullable(),
    }),
    candidate: z.object({
      id: z.string(),
      fullName: z.string(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
      headline: z.string().nullable(),
      currentCompany: z.string().nullable(),
      location: z.string().nullable(),
      linkedInUrl: z.string().nullable(),
      gitHubUrl: z.string().nullable(),
      portfolioUrl: z.string().nullable(),
      avatarUrl: z.string().nullable(),
      yearsExperience: z.number().nullable(),
      aiSummary: z.string().nullable(),
      resumeUrl: z.string().nullable(),
      skills: z.array(z.string()),
      tags: z.array(z.string()),
    }),
    stages: z.array(z.object({ id: z.string(), name: z.string(), order: z.number(), kind: z.string().nullable() })),
    interviews: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        type: z.string().nullable(),
        status: z.string().nullable(),
        scheduledAt: z.string().nullable(),
        durationMinutes: z.number(),
        meetingLink: z.string().nullable(),
        interviewerIds: z.array(z.string()),
      }),
    ),
    scorecards: z.array(
      z.object({
        id: z.string(),
        interviewId: z.string().nullable(),
        interviewerId: z.string().nullable(),
        title: z.string().nullable(),
        overallRating: z.number(),
        technicalSkill: z.number(),
        communication: z.number(),
        problemSolving: z.number(),
        cultureAdd: z.number(),
        recommendation: z.string().nullable(),
        strengths: z.string().nullable(),
        concerns: z.string().nullable(),
        submittedAt: z.string().nullable(),
        status: z.string().nullable(),
      }),
    ),
    activities: z.array(
      z.object({
        id: z.string(),
        type: z.string().nullable(),
        summary: z.string().nullable(),
        body: z.string().nullable(),
        occurredAt: z.string().nullable(),
        authorId: z.string().nullable(),
      }),
    ),
    emails: z.array(
      z.object({
        id: z.string(),
        subject: z.string().nullable(),
        direction: z.string().nullable(),
        status: z.string().nullable(),
        fromEmail: z.string().nullable(),
        toEmail: z.string().nullable(),
        body: z.string().nullable(),
        sentAt: z.string().nullable(),
      }),
    ),
    offer: z
      .object({
        id: z.string(),
        status: z.string().nullable(),
        baseSalary: z.number().nullable(),
        signingBonus: z.number().nullable(),
        equity: z.string().nullable(),
        level: z.string().nullable(),
        startDate: z.string().nullable(),
        expiresAt: z.string().nullable(),
        notes: z.string().nullable(),
      })
      .nullable(),
  }),
  execute: async ({ input }) => {
    const id = input.applicationId;

    const appRows = (
      await zite.sql({
        query: `
          SELECT a.id, a."status", a."rating", a."source", a."appliedDate", a."stageEnteredAt",
                 a."rejectionReason",
                 lo."teamMembersId" AS "ownerId",
                 st.id AS "stageId", st."name" AS "stageName", st."interviewKit" AS "interviewKit",
                 j.id AS "jobId", j."title" AS "jobTitle",
                 c.id AS "candidateId"
          FROM "Applications" a
          LEFT JOIN "ApplicationsTeamMembers" lo ON lo."applicationsId" = a.id
          LEFT JOIN "ApplicationsStages" lst ON lst."applicationsId" = a.id
          LEFT JOIN "Stages" st ON st.id = lst."stagesId"
          LEFT JOIN "ApplicationsJobs" lj ON lj."applicationsId" = a.id
          LEFT JOIN "Jobs" j ON j.id = lj."jobsId"
          LEFT JOIN "ApplicationsCandidates" lc ON lc."applicationsId" = a.id
          LEFT JOIN "Candidates" c ON c.id = lc."candidatesId"
          WHERE a.id = $1
          LIMIT 1
        `,
        params: [id],
      })
    ).rows;

    const row = appRows[0];
    if (!row) throw new ZiteError('Application not found', 'NOT_FOUND');

    const candidateId = s(row.candidateId);
    const jobId = s(row.jobId);

    const [candRec, stageRows, interviewRows, scorecardRows, activityRows, emailRows, offerRows] =
      await Promise.all([
        candidateId ? zite.candidates.findOne({ id: candidateId }) : Promise.resolve(undefined),
        jobId
          ? zite.sql({
              query: `SELECT s.id, s."name", s."order", s."kind" FROM "Stages" s
                      JOIN "JobsStages" lk ON lk."stagesId" = s.id
                      WHERE lk."jobsId" = $1 ORDER BY s."order" ASC`,
              params: [jobId],
            })
          : Promise.resolve({ rows: [] as Record<string, unknown>[] }),
        zite.sql({
          query: `
            SELECT i.id, i."title", i."type", i."status", i."scheduledAt", i."durationMinutes", i."meetingLink"
            FROM "Interviews" i
            JOIN "ApplicationsInterviews" lk ON lk."interviewsId" = i.id
            WHERE lk."applicationsId" = $1
            ORDER BY i."scheduledAt" DESC NULLS LAST
            LIMIT 100
          `,
          params: [id],
        }),
        zite.sql({
          query: `
            SELECT sc.id, sc."title", sc."overallRating", sc."technicalSkill", sc."communication",
                   sc."problemSolving", sc."cultureAdd", sc."recommendation", sc."strengths",
                   sc."concerns", sc."submittedAt", sc."status",
                   li."interviewsId" AS "interviewId",
                   lt."teamMembersId" AS "interviewerId"
            FROM "Scorecards" sc
            JOIN "ApplicationsScorecards" lk ON lk."scorecardsId" = sc.id
            LEFT JOIN "InterviewsScorecards" li ON li."scorecardsId" = sc.id
            LEFT JOIN "ScorecardsTeamMembers" lt ON lt."scorecardsId" = sc.id
            WHERE lk."applicationsId" = $1
            ORDER BY sc."submittedAt" DESC NULLS LAST
            LIMIT 100
          `,
          params: [id],
        }),
        zite.sql({
          query: `
            SELECT ac.id, ac."type", ac."summary", ac."body", ac."occurredAt",
                   lt."teamMembersId" AS "authorId"
            FROM "Activities" ac
            JOIN "ActivitiesApplications" lk ON lk."activitiesId" = ac.id
            LEFT JOIN "ActivitiesTeamMembers" lt ON lt."activitiesId" = ac.id
            WHERE lk."applicationsId" = $1
            ORDER BY ac."occurredAt" DESC NULLS LAST
            LIMIT 200
          `,
          params: [id],
        }),
        zite.sql({
          query: `
            SELECT em.id, em."subject", em."direction", em."status", em."fromEmail",
                   em."toEmail", em."body", em."sentAt"
            FROM "EmailMessages" em
            JOIN "ApplicationsEmailMessages" lk ON lk."emailMessagesId" = em.id
            WHERE lk."applicationsId" = $1
            ORDER BY em."sentAt" ASC NULLS LAST
            LIMIT 200
          `,
          params: [id],
        }),
        zite.sql({
          query: `
            SELECT o.id, o."status", o."baseSalary", o."signingBonus", o."equity",
                   o."level", o."startDate", o."expiresAt", o."notes"
            FROM "Offers" o
            JOIN "ApplicationsOffers" lk ON lk."offersId" = o.id
            WHERE lk."applicationsId" = $1
            ORDER BY o."sentAt" DESC NULLS LAST
            LIMIT 1
          `,
          params: [id],
        }),
      ]);

    // Interviewers are many-per-interview, so they come back as their own rows
    // and get folded in rather than multiplying the interview query.
    const panelRows = interviewRows.rows.length
      ? (
          await zite.sql({
            query: `
              SELECT lk."interviewsId" AS "interviewId", lk."teamMembersId" AS "memberId"
              FROM "InterviewsTeamMembers" lk
              WHERE lk."interviewsId" = ANY($1::uuid[])
            `,
            params: [interviewRows.rows.map((r) => String(r.id))],
          })
        ).rows
      : [];
    const panelBy = new Map<string, string[]>();
    for (const p of panelRows) {
      const k = String(p.interviewId);
      panelBy.set(k, [...(panelBy.get(k) ?? []), String(p.memberId)]);
    }

    const offer = offerRows.rows[0];

    return {
      application: {
        id: String(row.id),
        status: row.status == null ? 'Active' : String(row.status),
        rating: n(row.rating),
        source: s(row.source),
        appliedDate: row.appliedDate ? String(row.appliedDate).slice(0, 10) : null,
        stageEnteredAt: s(row.stageEnteredAt),
        rejectionReason: s(row.rejectionReason),
        ownerId: s(row.ownerId),
        stageId: s(row.stageId),
        stageName: s(row.stageName),
        jobId,
        jobTitle: s(row.jobTitle),
        interviewKit: s(row.interviewKit),
      },
      candidate: {
        id: candRec?.id ?? '',
        fullName: candRec?.fullName ?? 'Unknown candidate',
        email: candRec?.email ?? null,
        phone: candRec?.phone ?? null,
        headline: candRec?.headline ?? null,
        currentCompany: candRec?.currentCompany ?? null,
        location: candRec?.location ?? null,
        linkedInUrl: candRec?.linkedInUrl ?? null,
        gitHubUrl: candRec?.gitHubUrl ?? null,
        portfolioUrl: candRec?.portfolioUrl ?? null,
        avatarUrl: candRec?.avatarUrl ?? null,
        yearsExperience: candRec?.yearsExperience == null ? null : Number(candRec.yearsExperience),
        aiSummary: candRec?.aiSummary ?? null,
        resumeUrl: candRec?.resume?.[0]?.url ?? null,
        skills: toStringArray(candRec?.skills),
        tags: toStringArray(candRec?.tags),
      },
      stages: stageRows.rows.map((r) => ({
        id: String(r.id),
        name: r.name == null ? 'Stage' : String(r.name),
        order: n(r.order),
        kind: s(r.kind),
      })),
      interviews: interviewRows.rows.map((r) => ({
        id: String(r.id),
        title: r.title == null ? 'Interview' : String(r.title),
        type: s(r.type),
        status: s(r.status),
        scheduledAt: s(r.scheduledAt),
        durationMinutes: n(r.durationMinutes),
        meetingLink: s(r.meetingLink),
        interviewerIds: panelBy.get(String(r.id)) ?? [],
      })),
      scorecards: scorecardRows.rows.map((r) => ({
        id: String(r.id),
        interviewId: s(r.interviewId),
        interviewerId: s(r.interviewerId),
        title: s(r.title),
        overallRating: n(r.overallRating),
        technicalSkill: n(r.technicalSkill),
        communication: n(r.communication),
        problemSolving: n(r.problemSolving),
        cultureAdd: n(r.cultureAdd),
        recommendation: s(r.recommendation),
        strengths: s(r.strengths),
        concerns: s(r.concerns),
        submittedAt: s(r.submittedAt),
        status: s(r.status),
      })),
      activities: activityRows.rows.map((r) => ({
        id: String(r.id),
        type: s(r.type),
        summary: s(r.summary),
        body: s(r.body),
        occurredAt: s(r.occurredAt),
        authorId: s(r.authorId),
      })),
      emails: emailRows.rows.map((r) => ({
        id: String(r.id),
        subject: s(r.subject),
        direction: s(r.direction),
        status: s(r.status),
        fromEmail: s(r.fromEmail),
        toEmail: s(r.toEmail),
        body: s(r.body),
        sentAt: s(r.sentAt),
      })),
      offer: offer
        ? {
            id: String(offer.id),
            status: s(offer.status),
            baseSalary: offer.baseSalary == null ? null : Number(offer.baseSalary),
            signingBonus: offer.signingBonus == null ? null : Number(offer.signingBonus),
            equity: s(offer.equity),
            level: s(offer.level),
            startDate: offer.startDate ? String(offer.startDate).slice(0, 10) : null,
            expiresAt: offer.expiresAt ? String(offer.expiresAt).slice(0, 10) : null,
            notes: s(offer.notes),
          }
        : null,
    };
  },
});
