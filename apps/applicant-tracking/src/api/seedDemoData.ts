import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { TEAM, JOBS, STAGE_TEMPLATES, EMAIL_TEMPLATES } from '../lib/seedData';
import { CANDIDATES } from '../lib/seedCandidates';

// Seeding runs in phases because a single pass writes well over a thousand
// records — more than one endpoint invocation should carry. The client walks
// phases until `done`, which also gives it something honest to show a progress
// indicator with. Every phase is idempotent on its own table.

const MS_DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * MS_DAY);
const dateOnly = (d: Date) => d.toISOString().slice(0, 10);
const isoAt = (n: number, hour = 15) => {
  const d = daysAgo(n);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};

async function chunked<T>(rows: T[], write: (batch: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += 100) await write(rows.slice(i, i + 100));
}

const avatar = (email: string) => `https://i.pravatar.cc/160?u=${encodeURIComponent(email)}`;
const emailFor = (name: string) =>
  `${name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z\s]/g, '').trim().replace(/\s+/g, '.')}@example.com`;
const firstName = (name: string) => name.split(' ')[0];

// How long an application has plausibly been alive, given how deep it is.
const appliedDaysFor = (stageIdx: number, i: number) => 8 + stageIdx * 11 + (i % 7);

export default createEndpoint({
  description: 'Load the demo workspace in phases; safe to call repeatedly',
  authenticated: true,
  inputSchema: z.object({ phase: z.number().int().min(1).max(5).optional() }),
  outputSchema: z.object({
    phase: z.number(),
    created: z.number(),
    done: z.boolean(),
    label: z.string(),
  }),
  execute: async ({ input }) => {
    const phase = input.phase ?? 1;

    // ---------------------------------------------------------------- phase 1
    if (phase === 1) {
      const existing = await zite.jobs.findAll({ limit: 1 });
      if (existing.records.length > 0) {
        return { phase: 1, created: 0, done: false, label: 'Foundation already present' };
      }

      const team = await zite.teamMembers.bulkCreate({
        records: TEAM.map((t) => ({
          name: t.name, email: t.email, title: t.title, role: t.role,
          department: t.department, active: true, avatarUrl: avatar(t.email),
        })),
      });
      const byName = new Map(team.records.map((r) => [r.name ?? '', r.id]));

      const jobs = await zite.jobs.bulkCreate({
        records: JOBS.map((j) => ({
          title: j.title, slug: j.slug, team: j.team, location: j.location,
          description: j.description, requirements: j.requirements, benefits: j.benefits,
          openedDate: dateOnly(daysAgo(j.openedDays)),
          targetStartDate: dateOnly(daysAgo(-45)),
          openings: j.openings, salaryMin: j.salaryMin, salaryMax: j.salaryMax,
          department: j.department, workplaceType: j.workplaceType,
          employmentType: j.employmentType, status: j.status, priority: j.priority,
          published: j.published, confidential: false,
          hiringManager: byName.get(j.hiringManager) ? [byName.get(j.hiringManager)!] : null,
          recruiter: byName.get(j.recruiter) ? [byName.get(j.recruiter)!] : null,
        })),
      });
      const jobBySlug = new Map(jobs.records.map((r) => [r.slug ?? '', r.id]));

      const stageRows = JOBS.flatMap((j) => {
        const jobId = jobBySlug.get(j.slug);
        const tpl = STAGE_TEMPLATES[j.template] ?? STAGE_TEMPLATES.general;
        return tpl.map((s, idx) => ({
          name: s.name, order: idx + 1, kind: s.kind, targetDays: s.targetDays,
          interviewKit: s.kit ?? null, job: jobId ? [jobId] : null,
        }));
      });
      await chunked(stageRows, (b) => zite.stages.bulkCreate({ records: b }));

      await zite.emailTemplates.bulkCreate({
        records: EMAIL_TEMPLATES.map((t) => ({
          name: t.name, subject: t.subject, body: t.body, category: t.category,
        })),
      });

      const created = team.records.length + jobs.records.length + stageRows.length + EMAIL_TEMPLATES.length;
      return { phase: 1, created, done: false, label: 'Jobs, stages and team' };
    }

    // ---------------------------------------------------------------- phase 2
    if (phase === 2) {
      const existing = await zite.candidates.findAll({ limit: 1 });
      if (existing.records.length > 0) {
        return { phase: 2, created: 0, done: false, label: 'Candidates already present' };
      }

      const rows = CANDIDATES.map((c) => {
        const email = emailFor(c.n);
        const handle = c.n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z\s]/g, '').trim().replace(/\s+/g, '-');
        const isEng = c.sk.some((s) => ['TypeScript', 'Go', 'Rust', 'Python', 'Kubernetes'].includes(s));
        return {
          fullName: c.n, email, phone: null, headline: c.h, currentCompany: c.c,
          location: c.l, yearsExperience: c.y, source: c.src,
          sourceDetail: c.src === 'Referral' ? 'Referred by a current employee' : c.src === 'Sourced' ? 'LinkedIn outreach' : null,
          skills: c.sk, tags: c.t ?? null, avatarUrl: avatar(email),
          linkedInUrl: `https://www.linkedin.com/in/${handle}`,
          gitHubUrl: isEng ? `https://github.com/${handle}` : null,
          portfolioUrl: c.sk.includes('Figma') ? `https://${handle}.design` : null,
          aiSummary: null, resume: null,
        };
      });
      await chunked(rows, (b) => zite.candidates.bulkCreate({ records: b }));
      return { phase: 2, created: rows.length, done: false, label: 'Candidate profiles' };
    }

    // ---------------------------------------------------------------- phase 3
    if (phase === 3) {
      const existing = await zite.applications.findAll({ limit: 1 });
      if (existing.records.length > 0) {
        return { phase: 3, created: 0, done: false, label: 'Applications already present' };
      }

      const [jobs, stages, cands, team] = await Promise.all([
        zite.jobs.findAll({ limit: 100 }),
        zite.stages.findAll({ limit: 500 }),
        zite.candidates.findAll({ limit: 500 }),
        zite.teamMembers.findAll({ limit: 100 }),
      ]);
      const jobBySlug = new Map(jobs.records.map((r) => [r.slug ?? '', r]));
      const candByName = new Map(cands.records.map((r) => [r.fullName ?? '', r.id]));
      const recruiters = team.records.filter((t) => t.role === 'Recruiter' || t.role === 'Admin');

      // Stage rows keyed by "<jobId>:<order>" so a candidate's stage index maps
      // onto that job's own pipeline rather than a global one.
      const stageByJobOrder = new Map<string, string>();
      for (const s of stages.records) {
        const jobId = Array.isArray(s.job) ? s.job[0] : s.job;
        if (jobId) stageByJobOrder.set(`${jobId}:${s.order}`, s.id);
      }

      const rows = CANDIDATES.map((c, i) => {
        const job = jobBySlug.get(c.j);
        const candidateId = candByName.get(c.n);
        const stageId = job ? stageByJobOrder.get(`${job.id}:${c.s + 1}`) : undefined;
        const appliedDays = appliedDaysFor(c.s, i);
        const owner = recruiters[i % Math.max(recruiters.length, 1)];
        const isClosed = c.st === 'Rejected' || c.st === 'Withdrawn';
        return {
          application: `${c.n} — ${job?.title ?? 'Unknown role'}`,
          candidate: candidateId ? [candidateId] : null,
          job: job ? [job.id] : null,
          currentStage: stageId ? [stageId] : null,
          owner: owner ? [owner.id] : null,
          appliedDate: dateOnly(daysAgo(appliedDays)),
          stageEnteredAt: isoAt(Math.max(1, Math.floor(appliedDays / 3)), 16),
          status: c.st,
          rating: c.st === 'Hired' ? 4 : c.s >= 4 ? 4 : c.s >= 2 ? 3 : c.s >= 1 ? 2 : 0,
          source: c.src,
          rejectionReason: c.st === 'Rejected' ? (c.rr ?? 'Other') : null,
          rejectedDate: isClosed ? dateOnly(daysAgo(Math.max(1, Math.floor(appliedDays / 4)))) : null,
        };
      });
      await chunked(rows, (b) => zite.applications.bulkCreate({ records: b }));
      return { phase: 3, created: rows.length, done: false, label: 'Applications and pipeline placement' };
    }

    // ---------------------------------------------------------------- phase 4
    if (phase === 4) {
      const existing = await zite.interviews.findAll({ limit: 1 });
      if (existing.records.length > 0) {
        return { phase: 4, created: 0, done: false, label: 'Interviews already present' };
      }

      const [apps, stages, team] = await Promise.all([
        zite.applications.findAll({ limit: 500 }),
        zite.stages.findAll({ limit: 500 }),
        zite.teamMembers.findAll({ limit: 100 }),
      ]);
      const stageById = new Map(stages.records.map((s) => [s.id, s]));
      const interviewers = team.records.filter((t) => t.role === 'Interviewer' || t.role === 'Hiring Manager');
      const appFor = (name: string) =>
        apps.records.find((a) => (a.application ?? '').startsWith(`${name} \u2014 `));

      const interviewRows: Record<string, unknown>[] = [];
      const TYPES = ['Recruiter Screen', 'Technical', 'Hiring Manager', 'Onsite', 'Final'];

      CANDIDATES.forEach((c, i) => {
        if (c.s < 1) return; // nobody still at Applied has sat an interview
        const app = appFor(c.n);
        if (!app || interviewers.length === 0) return;
        const stageId = Array.isArray(app.currentStage) ? app.currentStage[0] : app.currentStage;
        const stage = stageId ? stageById.get(stageId) : undefined;

        // One interview per stage cleared, plus the one currently in flight.
        const upTo = Math.min(c.s, 5);
        for (let s = 1; s <= upTo; s++) {
          const isCurrent = s === c.s && c.st === 'Active';
          const daysOut = isCurrent ? -(2 + (i % 6)) : appliedDaysFor(c.s, i) - s * 9;
          const panel = [
            interviewers[(i + s) % interviewers.length].id,
            interviewers[(i + s + 3) % interviewers.length].id,
          ];
          interviewRows.push({
            title: `${TYPES[s - 1] ?? 'Interview'} \u2014 ${c.n}`,
            type: TYPES[s - 1] ?? 'Technical',
            scheduledAt: isoAt(daysOut, 14 + (i % 4)),
            durationMinutes: s === 4 ? 180 : s === 1 ? 30 : 60,
            meetingLink: 'https://meet.google.com/northwind-demo',
            location: 'Google Meet',
            status: isCurrent ? 'Scheduled' : 'Completed',
            notes: stage?.interviewKit ?? null,
            application: [app.id],
            stage: stageId ? [stageId] : null,
            interviewers: Array.from(new Set(panel)),
          });
        }
      });

      await chunked(interviewRows, (b) => zite.interviews.bulkCreate({ records: b }));
      return { phase: 4, created: interviewRows.length, done: false, label: 'Interview history' };
    }

    // ---------------------------------------------------------------- phase 5
    const existingAct = await zite.activities.findAll({ limit: 1 });
    if (existingAct.records.length > 0) {
      return { phase: 5, created: 0, done: true, label: 'Demo data ready' };
    }

    const [apps, interviews, team, cands] = await Promise.all([
      zite.applications.findAll({ limit: 500 }),
      zite.interviews.findAll({ limit: 1000 }),
      zite.teamMembers.findAll({ limit: 100 }),
      zite.candidates.findAll({ limit: 500 }),
    ]);
    const candById = new Map(cands.records.map((c) => [c.id, c]));
    const interviewers = team.records.filter((t) => t.role === 'Interviewer' || t.role === 'Hiring Manager');
    const recruiters = team.records.filter((t) => t.role === 'Recruiter' || t.role === 'Admin');
    const completed = interviews.records.filter((i) => i.status === 'Completed');

    const VERDICTS = [
      { rec: 'Strong Yes', overall: 4, s: 'Exceptional depth. Walked through a migration they led end to end and was candid about what went wrong the first time.', c: 'Will need a real scope challenge early or they will get bored.' },
      { rec: 'Yes', overall: 3, s: 'Solid, methodical problem solver. Asked good clarifying questions before touching code.', c: 'Less experience with our scale than the rest of the pipeline, though the fundamentals are there.' },
      { rec: 'Yes', overall: 3, s: 'Clear communicator. Explained tradeoffs in a way a non-engineer in the room could follow.', c: 'Wanted more specifics on the systems they owned alone versus as part of a team.' },
      { rec: 'No', overall: 2, s: 'Friendly and clearly capable within a familiar stack.', c: 'Struggled once the problem moved outside patterns they had memorised. Not ready for this level.' },
    ];

    // Whoever opens an installed template is not in the seeded roster and falls
    // back to the admin, so the admin needs to actually be on some panels or the
    // inbox greets them with nothing to do.
    const lead = team.records.find((t) => t.role === 'Admin');
    if (lead) {
      const screens = interviews.records.filter((i) => i.type === 'Recruiter Screen').slice(0, 20);
      for (const iv of screens) {
        const current = Array.isArray(iv.interviewers)
          ? iv.interviewers
          : iv.interviewers
            ? [iv.interviewers]
            : [];
        if (!current.includes(lead.id)) {
          await zite.interviews.update({
            id: iv.id,
            record: { interviewers: [...current, lead.id] } as never,
          });
        }
      }
    }

    const scorecardRows = completed.slice(0, 200).map((iv, idx) => {
      const v = VERDICTS[idx % VERDICTS.length];
      const who = interviewers[idx % Math.max(interviewers.length, 1)];
      const appId = Array.isArray(iv.application) ? iv.application[0] : iv.application;
      return {
        title: `${iv.title ?? 'Interview'} feedback`,
        interview: [iv.id],
        application: appId ? [appId] : null,
        interviewer: who ? [who.id] : null,
        overallRating: v.overall,
        technicalSkill: Math.max(1, v.overall - (idx % 2)),
        communication: Math.min(4, v.overall + (idx % 2)),
        problemSolving: v.overall,
        cultureAdd: Math.min(4, v.overall + ((idx + 1) % 2)),
        recommendation: v.rec,
        strengths: v.s,
        concerns: v.c,
        notes: null,
        status: 'Submitted',
        submittedAt: iv.scheduledAt ?? isoAt(10),
      };
    });
    await chunked(scorecardRows, (b) => zite.scorecards.bulkCreate({ records: b }));

    // Leave a realistic backlog: panellists on recent interviews who never wrote
    // anything up. This is what the inbox's "feedback you owe" queue reads.
    const gaps = (
      await zite.sql({
        query: `
          SELECT i.id AS "interviewId", i."title", lt."teamMembersId" AS "memberId",
                 la."applicationsId" AS "appId"
          FROM "Interviews" i
          JOIN "InterviewsTeamMembers" lt ON lt."interviewsId" = i.id
          LEFT JOIN "ApplicationsInterviews" la ON la."interviewsId" = i.id
          WHERE i."status" = 'Completed'
            AND i."scheduledAt" > NOW() - INTERVAL '21 days'
            AND NOT EXISTS (
              SELECT 1 FROM "Scorecards" sc
              JOIN "InterviewsScorecards" li ON li."scorecardsId" = sc.id
              JOIN "ScorecardsTeamMembers" st ON st."scorecardsId" = sc.id
              WHERE li."interviewsId" = i.id AND st."teamMembersId" = lt."teamMembersId"
            )
          ORDER BY i."scheduledAt" DESC
          LIMIT 26`,
      })
    ).rows;

    const pendingRows = gaps.map((g) => ({
      title: `${g.title} feedback`,
      interview: [String(g.interviewId)],
      application: g.appId ? [String(g.appId)] : null,
      interviewer: [String(g.memberId)],
      status: 'Pending',
      overallRating: 0,
      technicalSkill: 0,
      communication: 0,
      problemSolving: 0,
      cultureAdd: 0,
    }));
    await chunked(pendingRows, (b) => zite.scorecards.bulkCreate({ records: b }));

    // Offers for everyone at or past the Offer stage.
    const offerRows = CANDIDATES.filter((c) => c.s >= 5).map((c, i) => {
      const app = apps.records.find((a) => (a.application ?? '').startsWith(`${c.n} —`));
      if (!app) return null;
      const approver = recruiters[i % Math.max(recruiters.length, 1)];
      const accepted = c.st === 'Hired';
      const base = 165000 + ((i * 7919) % 60000);
      return {
        title: `Offer — ${c.n}`,
        application: [app.id],
        approver: approver ? [approver.id] : null,
        status: accepted ? 'Accepted' : i % 2 === 0 ? 'Sent' : 'Pending Approval',
        baseSalary: Math.round(base / 1000) * 1000,
        signingBonus: 15000 + ((i * 3571) % 20000),
        equity: `${(0.05 + (i % 5) * 0.02).toFixed(2)}%`,
        level: c.y >= 10 ? 'L6 — Staff' : c.y >= 7 ? 'L5 — Senior' : 'L4',
        startDate: dateOnly(daysAgo(-30 - i * 5)),
        expiresAt: dateOnly(daysAgo(-7)),
        sentAt: isoAt(6 + i, 17),
        respondedAt: accepted ? isoAt(2 + i, 11) : null,
        notes: accepted ? 'Accepted verbally on the call, signed the same afternoon.' : 'Comp aligned with the band. Waiting on candidate response.',
      };
    }).filter(Boolean) as Record<string, unknown>[];
    await chunked(offerRows, (b) => zite.offers.bulkCreate({ records: b }));

    // Activity feed: creation, stage moves, and a human note on deeper pipelines.
    const activityRows: Record<string, unknown>[] = [];
    CANDIDATES.forEach((c, i) => {
      const app = apps.records.find((a) => (a.application ?? '').startsWith(`${c.n} —`));
      if (!app) return;
      const candId = Array.isArray(app.candidate) ? app.candidate[0] : app.candidate;
      const owner = recruiters[i % Math.max(recruiters.length, 1)];
      const appliedDays = appliedDaysFor(c.s, i);
      const base = { application: [app.id], candidate: candId ? [candId] : null, author: owner ? [owner.id] : null };

      activityRows.push({
        ...base, type: 'Application Created',
        summary: `${c.n} applied via ${c.src === 'Applied' ? 'the careers site' : c.src.toLowerCase()}`,
        body: null, occurredAt: isoAt(appliedDays, 9),
      });

      for (let s = 1; s <= c.s; s++) {
        activityRows.push({
          ...base, type: 'Stage Change',
          summary: `Advanced to stage ${s + 1}`,
          body: null, occurredAt: isoAt(Math.max(1, appliedDays - s * 9), 12),
        });
      }

      if (c.s >= 2) {
        const cand = candId ? candById.get(candId) : undefined;
        activityRows.push({
          ...base, type: 'Note',
          summary: 'Recruiter note',
          body: `Spoke with ${firstName(c.n)} about scope and timing. Currently at ${cand?.currentCompany ?? 'their company'}, motivated by ownership rather than comp. Notice period is four weeks.`,
          occurredAt: isoAt(Math.max(1, appliedDays - c.s * 8), 13),
        });
      }

      if (c.st === 'Rejected') {
        activityRows.push({
          ...base, type: 'Status Change',
          summary: `Rejected — ${c.rr ?? 'Other'}`,
          body: null, occurredAt: isoAt(Math.max(1, Math.floor(appliedDays / 4)), 15),
        });
      }
    });
    await chunked(activityRows, (b) => zite.activities.bulkCreate({ records: b }));

    // A couple of real threads so the email tab is not empty on first open.
    const emailRows: Record<string, unknown>[] = [];
    CANDIDATES.filter((c) => c.s >= 1 && c.st === 'Active').slice(0, 18).forEach((c, i) => {
      const app = apps.records.find((a) => (a.application ?? '').startsWith(`${c.n} —`));
      if (!app) return;
      const candId = Array.isArray(app.candidate) ? app.candidate[0] : app.candidate;
      const cand = candId ? candById.get(candId) : undefined;
      const owner = recruiters[i % Math.max(recruiters.length, 1)];
      const job = (app.application ?? '').split(' — ')[1] ?? 'the role';
      const threadId = `thread-${app.id}`;
      const days = appliedDaysFor(c.s, i);

      emailRows.push({
        subject: `Next step for ${job} at Northwind Labs`,
        threadId, direction: 'Outbound', status: 'Sent',
        fromEmail: owner?.email ?? 'talent@northwindlabs.com', toEmail: cand?.email ?? null,
        body: `Hi ${firstName(c.n)},\n\nThanks for your interest in the ${job} role. I read through your background and would love to set up 30 minutes to walk through what you are looking for.\n\nAre there a couple of windows that work well this week?\n\nBest,\n${owner?.name ?? 'Talent team'}`,
        sentAt: isoAt(Math.max(2, days - 3), 10),
        application: [app.id], candidate: candId ? [candId] : null, author: owner ? [owner.id] : null,
      });
      emailRows.push({
        subject: `Re: Next step for ${job} at Northwind Labs`,
        threadId, direction: 'Inbound', status: 'Received',
        fromEmail: cand?.email ?? null, toEmail: owner?.email ?? 'talent@northwindlabs.com',
        body: `Hi ${owner ? firstName(owner.name ?? '') : 'there'},\n\nThanks for reaching out — definitely interested. Tuesday or Thursday afternoon would both work well on my end.\n\n${firstName(c.n)}`,
        sentAt: isoAt(Math.max(1, days - 4), 16),
        application: [app.id], candidate: candId ? [candId] : null, author: null,
      });
    });
    await chunked(emailRows, (b) => zite.emailMessages.bulkCreate({ records: b }));

    const created =
      scorecardRows.length + pendingRows.length + offerRows.length + activityRows.length + emailRows.length;
    return { phase: 5, created, done: true, label: 'Feedback, offers and activity' };
  },
});
